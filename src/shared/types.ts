export type Server = 'steam' | 'kakao';

/** 플랫폼이 실행 방식을 바꾸면 settings.json의 이 부분만 고치면 된다. */
export interface LaunchConfig {
  steamAppId: string;
  /** url: steamUrl을 OS 프로토콜 처리기로 연다. applaunch: steam.exe -applaunch {appId} */
  steamMethod: 'url' | 'applaunch';
  /** {appId}가 steamAppId로 치환된다. */
  steamUrl: string;
  kakaoUrl: string;
  gameProcess: string;
  timeoutSec: number;
}

export interface Settings {
  lastServer: Server;
  /** 사용자가 직접 고른 Steam 폴더. 없으면 자동 탐지. */
  steamPath?: string;
  launch: LaunchConfig;
}

export type Phase = 'idle' | 'client' | 'web' | 'game' | 'failed';

export interface AppState {
  server: Server;
  /** 탐지된 Steam 폴더. null이면 미설치(또는 못 찾음). */
  steamPath: string | null;
  /** PUBG가 들어 있는 Steam 라이브러리. null이면 못 찾음. */
  pubgLibrary: string | null;
  phase: Phase;
  message: string;
}

export interface LauncherApi {
  getState(): Promise<AppState>;
  selectServer(server: Server): Promise<AppState>;
  chooseSteamFolder(): Promise<AppState>;
  launch(): Promise<AppState>;
  onState(cb: (s: AppState) => void): void;
}
