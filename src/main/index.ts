import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { execFile, spawn } from 'node:child_process';
import path from 'node:path';
import type { AppState, Phase, Server } from '../shared/types';
import { loadSettings, saveSettings } from './settings';
import { detectSteam, findPubgLibrary, isSteamDir } from './steam';

const settingsFile = path.join(app.getPath('userData'), 'settings.json');
let settings = loadSettings(settingsFile);
let win: BrowserWindow | null = null;
let deadline = 0; // Steam 실행 후 게임 프로세스를 기다리는 마감 시각
let state: AppState = {
  server: settings.lastServer,
  steamPath: null,
  pubgLibrary: null,
  phase: 'idle',
  message: '',
};

function detect(): void {
  state.steamPath = detectSteam(settings.steamPath);
  state.pubgLibrary = state.steamPath ? findPubgLibrary(state.steamPath, settings.launch.steamAppId) : null;
}

function set(phase: Phase, message: string): AppState {
  state = { ...state, phase, message };
  win?.webContents.send('state', state);
  return state;
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
    if (running && state.phase !== 'game') set('game', '게임 실행 중입니다.');
    else if (!running && state.phase === 'game') set('idle', '게임이 종료되었습니다.');
    else if (!running && state.phase === 'client' && Date.now() > deadline)
      set(
        'failed',
        state.pubgLibrary
          ? `${settings.launch.timeoutSec}초 안에 게임이 뜨지 않았습니다. Steam 로그인 상태와 PUBG 업데이트 진행 여부를 확인하세요.`
          : 'Steam 라이브러리에서 PUBG를 찾지 못했습니다. Steam에서 PUBG를 설치한 뒤 다시 시도하세요.',
      );
  } finally {
    polling = false;
  }
}

async function launchSteam(): Promise<AppState> {
  detect();
  if (!state.steamPath)
    return set('failed', 'Steam이 설치되어 있지 않습니다. Steam을 설치하거나 [Steam 폴더 선택]으로 경로를 지정하세요.');
  const { steamAppId, steamMethod, steamUrl, timeoutSec } = settings.launch;
  if (steamMethod === 'applaunch') {
    spawn(path.join(state.steamPath, 'steam.exe'), ['-applaunch', steamAppId], { detached: true, stdio: 'ignore' }).unref();
  } else {
    await shell.openExternal(steamUrl.replace('{appId}', steamAppId));
  }
  deadline = Date.now() + timeoutSec * 1000;
  return set('client', 'Steam 클라이언트 실행 중 — 게임이 뜨기를 기다리고 있습니다.');
}

async function launchKakao(): Promise<AppState> {
  const url = settings.launch.kakaoUrl;
  if (!/^https:\/\//.test(url)) return set('failed', `설정의 카카오 주소가 올바르지 않습니다: ${url}`);
  await shell.openExternal(url);
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
  try {
    return await (state.server === 'steam' ? launchSteam() : launchKakao());
  } catch (e) {
    return set('failed', `실행하지 못했습니다: ${(e as Error).message}`);
  }
});

app.whenReady().then(() => {
  detect();
  win = new BrowserWindow({
    width: 520,
    height: 400,
    resizable: false,
    autoHideMenuBar: true,
    backgroundColor: '#15171c',
    title: 'PUBG 통합 런처 (비공식)',
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.loadFile(path.join(__dirname, '../renderer/index.html'));
  setInterval(poll, 2000);
  poll();
});

app.on('window-all-closed', () => app.quit());
