import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { execFile, spawn } from 'node:child_process';
import path from 'node:path';
import type { AppState, Phase, Profile, Server } from '../shared/types';
import { launchBlockReason, pollEvent, steamFailMessage, steamTarget } from './launch';
import { fetchSteamNotices, kakaoNotices } from './notices';
import { isHttpsUrl, normalizeProfile, validateProfile } from './profile';
import { accrue, emptyRecords, loadRecords, markPlayed } from './records';
import { DEFAULTS, loadSettings, recoverJson, saveSettings, writeJson } from './settings';
import { SHORTCUT_NAMES, parseServerArg, shortcutSpec } from './shortcuts';
import { detectSteam, findPubgLibrary, isSteamDir } from './steam';
import { checkUpdate, downloadUpdate, getUpdate, initUpdater, installUpdate } from './updater';

/** 바로가기(--server=…)로 켜졌을 때 카카오 웹에서 게임을 시작하기를 기다리는 최대 시간. 지나면 조용히 종료. */
const HEADLESS_WEB_WAIT_MS = 10 * 60_000;

// 설치본은 productName으로 폴더가 바뀌므로, 개발 실행과 같은 위치로 고정한다.
app.setPath('userData', path.join(app.getPath('appData'), 'pubg-unified-launcher'));
const settingsFile = path.join(app.getPath('userData'), 'settings.json');
const recordsFile = path.join(app.getPath('userData'), 'records.json');
const settingsRecovered = recoverJson(settingsFile, DEFAULTS);
const recordsRecovered = recoverJson(recordsFile, emptyRecords());
let settings = loadSettings(settingsFile);
let win: BrowserWindow | null = null;
let deadline = 0; // Steam 실행 후 게임 프로세스를 기다리는 마감 시각
let webDeadline = 0;
let launching = false; // 연타·동시 호출 방지
let launchedServer: Server | null = null; // 마지막으로 실행한 서버. 플레이 기록을 어느 서버에 쌓을지 정한다.
let playServer: Server = settings.lastServer;
let lastSeenAt: number | null = null; // 게임 프로세스를 마지막으로 본 시각
let recordsSavedAt = 0;
let state: AppState = {
  server: settings.lastServer,
  steamPath: null,
  pubgLibrary: null,
  phase: 'idle',
  message:
    settingsRecovered || recordsRecovered
      ? '설정 또는 기록 파일이 손상되어 기본값으로 복구했습니다. (원본은 .broken 파일로 보관)'
      : '',
  notices: { steam: { status: 'loading', links: [] }, kakao: kakaoNotices(settings.notices) },
  records: loadRecords(recordsFile),
  version: app.getVersion(),
  update: getUpdate(),
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

function persist(): boolean {
  try {
    saveSettings(settingsFile, settings);
    return true;
  } catch (e) {
    set(state.phase, `설정을 저장하지 못했습니다: ${(e as Error).message}`);
    return false;
  }
}

function saveRecords(now: number): void {
  try {
    writeJson(recordsFile, state.records);
  } catch {
    // 디스크 문제 등. 다음 저장 때 다시 시도한다.
  }
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

/** 창 없이(바로가기로) 실행 중일 때만 종료한다. 창이 열려 있으면 아무것도 안 한다. */
function endHeadless(error?: string): void {
  if (win) return;
  // 창이 없을 때 비동기 showMessageBox는 바로 끝나 버려서 동기 버전을 쓴다.
  if (error) dialog.showMessageBoxSync({ type: 'error', title: 'PUBG 통합 런처 (비공식)', message: error });
  app.quit();
}

let polling = false;
async function poll(): Promise<void> {
  if (polling) return;
  polling = true;
  try {
    const running = await isRunning(settings.launch.gameProcess);
    const now = Date.now();
    const ev = pollEvent(state.phase, running, now, deadline);
    if (ev === 'started') {
      playServer = launchedServer ?? state.server;
      state.records = markPlayed(state.records, playServer, now);
      set('game', '게임 실행 중입니다.');
    }
    if (running) {
      state.records = accrue(state.records, playServer, lastSeenAt, now);
      lastSeenAt = now;
      if (now - recordsSavedAt > 60_000) saveRecords(now);
    } else if (ev === 'ended') {
      lastSeenAt = null;
      launchedServer = null;
      saveRecords(now);
      set('idle', '게임이 종료되었습니다.');
      runProgram(settings.profile.afterProgram, '실행 후 프로그램');
      endHeadless();
    } else if (ev === 'timeout') {
      const msg = steamFailMessage(state.pubgLibrary, settings.launch.timeoutSec);
      set('failed', msg);
      endHeadless(msg);
    } else if (!win && state.phase === 'web' && now > webDeadline) {
      endHeadless();
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

function selectServer(server: Server): void {
  settings.lastServer = server;
  persist();
  state = { ...state, server };
}

async function launch(server: Server): Promise<AppState> {
  if (launching) return state;
  launching = true;
  try {
    if (server !== state.server) selectServer(server);
    detect();
    const blocked = launchBlockReason({
      server,
      phase: state.phase,
      steamPath: state.steamPath,
      deadline,
      now: Date.now(),
      // settings.json을 손으로 고쳤거나 지정한 프로그램이 지워졌을 수 있으니 실행 직전에 다시 검사한다.
      profileErrors: validateProfile(currentProfile(), gameDir()),
    });
    if (blocked) return set(blocked.fail ? 'failed' : state.phase, blocked.message);

    runProgram(settings.profile.beforeProgram, '실행 전 프로그램');
    if (server === 'steam') {
      const t = steamTarget(settings.launch, state.steamPath!, settings.profile.steamArgs);
      if ('url' in t) await shell.openExternal(t.url);
      else {
        const child = spawn(t.file, t.args, { detached: true, stdio: 'ignore' });
        child.on('error', (e) => set('failed', `Steam을 실행하지 못했습니다: ${e.message}`));
        child.unref();
      }
      launchedServer = 'steam';
      deadline = Date.now() + settings.launch.timeoutSec * 1000;
      return set('client', 'Steam 클라이언트 실행 중 — 게임이 뜨기를 기다리고 있습니다.');
    }
    await shell.openExternal(settings.launch.kakaoUrl);
    launchedServer = 'kakao';
    webDeadline = Date.now() + HEADLESS_WEB_WAIT_MS;
    return set('web', '카카오 공식 웹사이트를 열었습니다. 로그인 후 웹에서 "게임시작"을 눌러 주세요.');
  } catch (e) {
    return set('failed', `실행하지 못했습니다: ${(e as Error).message}`);
  } finally {
    launching = false;
  }
}

function showWindow(): void {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
    return;
  }
  win = new BrowserWindow({
    width: 540,
    height: 580,
    resizable: false,
    autoHideMenuBar: true,
    backgroundColor: '#15171c',
    title: 'PUBG 통합 런처 (비공식)',
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.on('closed', () => (win = null));
  win.loadFile(path.join(__dirname, '../renderer/index.html'));
}

ipcMain.handle('getState', () => state);

ipcMain.handle('selectServer', (_e, server: Server) => {
  if (server === 'steam' || server === 'kakao') selectServer(server);
  return state;
});

ipcMain.handle('chooseSteamFolder', async () => {
  const r = await dialog.showOpenDialog(win!, { title: 'Steam 폴더 선택', properties: ['openDirectory'] });
  const dir = r.filePaths[0];
  if (r.canceled || !dir) return state;
  if (!isSteamDir(dir)) return set('failed', '선택한 폴더에 steam.exe가 없습니다. Steam이 설치된 폴더를 골라 주세요.');
  settings.steamPath = dir;
  if (!persist()) return state;
  detect();
  return set('idle', 'Steam 폴더를 저장했습니다.');
});

ipcMain.handle('launch', () => launch(state.server));

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
  return persist() ? { ok: true, errors: [] } : { ok: false, errors: ['설정 파일을 저장하지 못했습니다.'] };
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

ipcMain.handle('createShortcuts', () => {
  const desktop = app.getPath('desktop');
  const ok = (['steam', 'kakao'] as const).every((s) =>
    shell.writeShortcutLink(
      path.join(desktop, `${SHORTCUT_NAMES[s]}.lnk`),
      shortcutSpec(s, app.isPackaged, process.execPath, app.getAppPath()),
    ),
  );
  return set(
    state.phase,
    ok ? '바탕화면에 "Steam으로 시작", "카카오로 시작" 바로가기를 만들었습니다.' : '바로가기를 만들지 못했습니다.',
  );
});

ipcMain.handle('checkUpdate', () => checkUpdate());
ipcMain.handle('downloadUpdate', () => downloadUpdate());
ipcMain.handle('installUpdate', () => installUpdate(win));

// 런처는 하나만 띄운다. 이미 떠 있으면 새 명령줄(바로가기)을 기존 런처에 넘긴다.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', async (_e, argv) => {
    const server = parseServerArg(argv);
    if (!server) return showWindow();
    const s = await launch(server);
    if (s.phase === 'failed') endHeadless(s.message);
  });

  app.whenReady().then(async () => {
    detect();
    initUpdater((u) => {
      state = { ...state, update: u };
      push();
    });
    setInterval(poll, 2000);
    await poll();
    refreshNotices();
    setInterval(refreshNotices, 30 * 60_000);

    const startServer = parseServerArg(process.argv);
    if (startServer) {
      // 바로가기: 화면 없이 바로 실행하고, 게임이 끝나면(또는 실패하면) 종료한다.
      const s = await launch(startServer);
      if (s.phase === 'failed') endHeadless(s.message);
    } else {
      showWindow();
      checkUpdate();
    }
  });
}

app.on('before-quit', () => {
  try {
    writeJson(recordsFile, state.records);
  } catch {
    // 종료를 막지 않는다.
  }
});
app.on('window-all-closed', () => app.quit());
