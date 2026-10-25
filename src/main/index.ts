import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { execFile, spawn } from 'node:child_process';
import path from 'node:path';
import type { AppState, Phase, Profile, Server } from '../shared/types';
import { fetchSteamNotices, kakaoNotices } from './notices';
import { isHttpsUrl, normalizeProfile, splitArgs, validateProfile } from './profile';
import { accrue, emptyRecords, loadRecords, markPlayed } from './records';
import { loadSettings, saveSettings, writeJson } from './settings';
import { detectSteam, findPubgLibrary, isSteamDir } from './steam';

const settingsFile = path.join(app.getPath('userData'), 'settings.json');
const recordsFile = path.join(app.getPath('userData'), 'records.json');
let settings = loadSettings(settingsFile);
let win: BrowserWindow | null = null;
let deadline = 0; // Steam 실행 후 게임 프로세스를 기다리는 마감 시각
let launchedServer: Server | null = null; // 마지막으로 "게임 시작"을 누른 서버. 플레이 기록을 어느 서버에 쌓을지 정한다.
let playServer: Server = settings.lastServer;
let lastSeenAt: number | null = null; // 게임 프로세스를 마지막으로 본 시각
let recordsSavedAt = 0;
let state: AppState = {
  server: settings.lastServer,
  steamPath: null,
  pubgLibrary: null,
  phase: 'idle',
  message: '',
  notices: { steam: { status: 'loading', links: [] }, kakao: kakaoNotices(settings.notices) },
  records: loadRecords(recordsFile),
};

function detect(): void {
  state.steamPath = detectSteam(settings.steamPath);
  state.pubgLibrary = state.steamPath ? findPubgLibrary(state.steamPath, settings.launch.steamAppId) : null;
}

/** PUBG 설치 폴더. 실행 전·후 프로그램으로 이 안의 파일을 고르지 못하게 막는 데 쓴다. */
function gameDir(): string | null {
  return state.pubgLibrary && path.join(state.pubgLibrary, 'steamapps', 'common', 'PUBG');
}

function currentProfile(): Profile {
  return { ...settings.profile, kakaoUrl: settings.launch.kakaoUrl };
}

function push(): AppState {
  win?.webContents.send('state', state);
  return state;
}

function set(phase: Phase, message: string): AppState {
  state = { ...state, phase, message };
  return push();
}

function saveRecords(now: number): void {
  writeJson(recordsFile, state.records);
  recordsSavedAt = now;
  push();
}

/** 사용자가 실행 옵션에서 직접 지정한 프로그램만 실행한다. 인자는 넘기지 않는다. */
function runProgram(file: string, label: string): void {
  if (!file) return;
  const fail = (e: Error) => set(state.phase, `${label}을 실행하지 못했습니다: ${e.message}`);
  try {
    const child = spawn(file, [], { cwd: path.dirname(file), detached: true, stdio: 'ignore' });
    child.on('error', fail);
    child.unref();
  } catch (e) {
    fail(e as Error);
  }
}

/** 프로세스 목록만 조회한다(tasklist). 게임 프로세스의 메모리나 모듈은 건드리지 않는다. */
function isRunning(image: string): Promise<boolean> {
  return new Promise((resolve) =>
    execFile('tasklist', ['/FI', `IMAGENAME eq ${image}`, '/NH', '/FO', 'CSV'], { windowsHide: true }, (err, out) =>
      resolve(!err && out.toLowerCase().includes(`"${image.toLowerCase()}"`)),
    ),
  );
}

let polling = false;
async function poll(): Promise<void> {
  if (polling) return;
  polling = true;
  try {
    const running = await isRunning(settings.launch.gameProcess);
    const now = Date.now();
    if (running) {
      if (state.phase !== 'game') {
        playServer = launchedServer ?? state.server;
        state.records = markPlayed(state.records, playServer, now);
        set('game', '게임 실행 중입니다.');
      }
      state.records = accrue(state.records, playServer, lastSeenAt, now);
      lastSeenAt = now;
      if (now - recordsSavedAt > 60_000) saveRecords(now);
    } else if (state.phase === 'game') {
      lastSeenAt = null;
      launchedServer = null;
      saveRecords(now);
      set('idle', '게임이 종료되었습니다.');
      runProgram(settings.profile.afterProgram, '실행 후 프로그램');
    } else if (state.phase === 'client' && now > deadline) {
      set(
        'failed',
        state.pubgLibrary
          ? `${settings.launch.timeoutSec}초 안에 게임이 뜨지 않았습니다. Steam 로그인 상태와 PUBG 업데이트 진행 여부를 확인하세요.`
          : 'Steam 라이브러리에서 PUBG를 찾지 못했습니다. Steam에서 PUBG를 설치한 뒤 다시 시도하세요.',
      );
    }
  } finally {
    polling = false;
  }
}

async function refreshNotices(): Promise<void> {
  const steam = await fetchSteamNotices(settings.notices, settings.launch.steamAppId);
  state = { ...state, notices: { ...state.notices, steam } };
  push();
}

async function launchSteam(): Promise<AppState> {
  detect();
  if (!state.steamPath)
    return set('failed', 'Steam이 설치되어 있지 않습니다. Steam을 설치하거나 [Steam 폴더 선택]으로 경로를 지정하세요.');
  const { steamAppId, steamMethod, steamUrl, steamUrlWithArgs, timeoutSec } = settings.launch;
  const args = splitArgs(settings.profile.steamArgs);
  runProgram(settings.profile.beforeProgram, '실행 전 프로그램');
  // 실행 인자는 Steam 공식 경로(-applaunch 명령줄, steam://run URL)로만 넘긴다. 게임 파일·Steam 설정 파일은 고치지 않는다.
  if (steamMethod === 'applaunch') {
    spawn(path.join(state.steamPath, 'steam.exe'), ['-applaunch', steamAppId, ...args], { detached: true, stdio: 'ignore' }).unref();
  } else {
    const url = args.length
      ? steamUrlWithArgs.replace('{appId}', steamAppId).replace('{args}', encodeURIComponent(args.join(' ')))
      : steamUrl.replace('{appId}', steamAppId);
    await shell.openExternal(url);
  }
  launchedServer = 'steam';
  deadline = Date.now() + timeoutSec * 1000;
  return set('client', 'Steam 클라이언트 실행 중 — 게임이 뜨기를 기다리고 있습니다.');
}

async function launchKakao(): Promise<AppState> {
  runProgram(settings.profile.beforeProgram, '실행 전 프로그램');
  await shell.openExternal(settings.launch.kakaoUrl);
  launchedServer = 'kakao';
  return set('web', '카카오 공식 웹사이트를 열었습니다. 로그인 후 웹에서 "게임시작"을 눌러 주세요.');
}

ipcMain.handle('getState', () => state);

ipcMain.handle('selectServer', (_e, server: Server) => {
  if (server !== 'steam' && server !== 'kakao') return state;
  settings.lastServer = server;
  saveSettings(settingsFile, settings);
  state = { ...state, server };
  return state;
});

ipcMain.handle('chooseSteamFolder', async () => {
  const r = await dialog.showOpenDialog(win!, { title: 'Steam 폴더 선택', properties: ['openDirectory'] });
  const dir = r.filePaths[0];
  if (r.canceled || !dir) return state;
  if (!isSteamDir(dir)) return set('failed', '선택한 폴더에 steam.exe가 없습니다. Steam이 설치된 폴더를 골라 주세요.');
  settings.steamPath = dir;
  saveSettings(settingsFile, settings);
  detect();
  return set('idle', 'Steam 폴더를 저장했습니다.');
});

ipcMain.handle('launch', async () => {
  if (state.phase === 'game') return set('game', '이미 게임이 실행 중입니다.');
  // settings.json을 손으로 고쳤거나 지정한 프로그램이 지워졌을 수 있으니 실행 직전에 다시 검사한다.
  const errors = validateProfile(currentProfile(), gameDir());
  if (errors.length) return set('failed', `실행 옵션을 확인하세요: ${errors[0]}`);
  try {
    return await (state.server === 'steam' ? launchSteam() : launchKakao());
  } catch (e) {
    return set('failed', `실행하지 못했습니다: ${(e as Error).message}`);
  }
});

ipcMain.handle('getProfile', () => currentProfile());

ipcMain.handle('saveProfile', async (_e, input: Profile) => {
  const p = normalizeProfile(input);
  const errors = validateProfile(p, gameDir());
  if (errors.length) return { ok: false, errors };
  const changed = [
    p.beforeProgram !== settings.profile.beforeProgram && p.beforeProgram && `실행 전 (게임 시작을 누를 때): ${p.beforeProgram}`,
    p.afterProgram !== settings.profile.afterProgram && p.afterProgram && `실행 후 (게임이 종료될 때): ${p.afterProgram}`,
  ].filter(Boolean);
  if (changed.length) {
    const { response } = await dialog.showMessageBox(win!, {
      type: 'warning',
      title: '실행할 프로그램 확인',
      message: '다음 프로그램이 자동으로 실행됩니다. 직접 지정한 프로그램이 맞습니까?',
      detail: changed.join('\n'),
      buttons: ['저장', '취소'],
      defaultId: 1,
      cancelId: 1,
    });
    if (response !== 0) return { ok: false, errors: ['저장을 취소했습니다.'] };
  }
  const { kakaoUrl, ...profile } = p;
  settings.profile = profile;
  settings.launch.kakaoUrl = kakaoUrl;
  saveSettings(settingsFile, settings);
  return { ok: true, errors: [] };
});

ipcMain.handle('pickProgram', async () => {
  const r = await dialog.showOpenDialog(win!, {
    title: '실행할 프로그램 선택',
    properties: ['openFile'],
    filters: [{ name: '프로그램', extensions: ['exe'] }],
  });
  return r.canceled ? null : (r.filePaths[0] ?? null);
});

ipcMain.handle('resetRecords', async () => {
  const { response } = await dialog.showMessageBox(win!, {
    type: 'question',
    title: '기록 초기화',
    message: 'Steam·카카오의 플레이 기록을 모두 지울까요? 되돌릴 수 없습니다.',
    buttons: ['초기화', '취소'],
    defaultId: 1,
    cancelId: 1,
  });
  if (response !== 0) return state;
  state.records = emptyRecords();
  saveRecords(Date.now());
  return state;
});

ipcMain.handle('openLink', (_e, url: string) => {
  // 화면에 보여 준 공지 링크만 연다.
  const known = Object.values(state.notices).flatMap((n) => [...n.links.map((l) => l.url), n.patch?.url, n.maintenance?.url]);
  if (isHttpsUrl(url) && known.includes(url)) return shell.openExternal(url);
});

app.whenReady().then(() => {
  detect();
  win = new BrowserWindow({
    width: 540,
    height: 560,
    resizable: false,
    autoHideMenuBar: true,
    backgroundColor: '#15171c',
    title: 'PUBG 통합 런처 (비공식)',
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.loadFile(path.join(__dirname, '../renderer/index.html'));
  setInterval(poll, 2000);
  poll();
  refreshNotices();
  setInterval(refreshNotices, 30 * 60_000);
});

app.on('before-quit', () => writeJson(recordsFile, state.records));
app.on('window-all-closed', () => app.quit());
