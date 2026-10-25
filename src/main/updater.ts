import { app, BrowserWindow, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import type { UpdateState } from '../shared/types';

let update: UpdateState = { status: app.isPackaged ? 'idle' : 'dev' };
let notify: (u: UpdateState) => void = () => {};
const setUpdate = (u: UpdateState) => notify((update = u));

export const getUpdate = () => update;

/** GitHub Releases(package.json build.publish)에서 새 버전을 확인한다. 내려받기·설치는 사용자가 허락할 때만. */
export function initUpdater(onChange: (u: UpdateState) => void): void {
  notify = onChange;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.on('checking-for-update', () => setUpdate({ status: 'checking' }));
  autoUpdater.on('update-available', (i) => setUpdate({ status: 'available', version: i.version }));
  autoUpdater.on('update-not-available', () => setUpdate({ status: 'none' }));
  autoUpdater.on('download-progress', (p) =>
    setUpdate({ status: 'downloading', version: update.version, percent: Math.round(p.percent) }),
  );
  autoUpdater.on('update-downloaded', (i) => setUpdate({ status: 'ready', version: i.version }));
  autoUpdater.on('error', () => setUpdate({ status: 'error' }));
}

export function checkUpdate(): void {
  if (!app.isPackaged) return; // 개발 실행에는 app-update.yml이 없다.
  autoUpdater.checkForUpdates().catch(() => setUpdate({ status: 'error' }));
}

/** "다운로드" 버튼을 눌렀을 때만 호출된다. */
export function downloadUpdate(): void {
  if (update.status !== 'available') return;
  setUpdate({ status: 'downloading', version: update.version, percent: 0 });
  autoUpdater.downloadUpdate().catch(() => setUpdate({ status: 'error' }));
}

/** 설치 전에 한 번 더 묻는다. */
export async function installUpdate(win: BrowserWindow | null): Promise<void> {
  if (update.status !== 'ready') return;
  const opts = {
    type: 'question' as const,
    title: '업데이트 설치',
    message: `런처를 종료하고 새 버전 ${update.version}을 설치할까요?`,
    detail: '실행 중인 게임에는 영향이 없습니다.',
    buttons: ['설치', '나중에'],
    defaultId: 1,
    cancelId: 1,
  };
  const { response } = win ? await dialog.showMessageBox(win, opts) : await dialog.showMessageBox(opts);
  if (response === 0) autoUpdater.quitAndInstall();
}
