import type { Server } from '../shared/types';

export const SHORTCUT_NAMES: Record<Server, string> = {
  steam: 'PUBG - Steam으로 시작',
  kakao: 'PUBG - 카카오로 시작',
};

/** 명령줄에서 --server=steam|kakao를 찾는다. 없거나 잘못된 값이면 null. */
export function parseServerArg(argv: string[]): Server | null {
  for (const a of argv) {
    const v = a.match(/^--server=(\w+)$/)?.[1];
    if (v === 'steam' || v === 'kakao') return v;
  }
  return null;
}

/**
 * 바로가기 대상. 설치본은 런처 exe를 바로 실행하고,
 * 개발 실행(npm start)은 electron.exe에 앱 폴더를 넘겨야 한다.
 */
export function shortcutSpec(server: Server, packaged: boolean, execPath: string, appPath: string) {
  return {
    target: execPath,
    args: packaged ? `--server=${server}` : `"${appPath}" --server=${server}`,
    description: `${SHORTCUT_NAMES[server]} (비공식 런처)`,
  };
}
