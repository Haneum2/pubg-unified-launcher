export type Server = 'steam' | 'kakao';

/** 플랫폼이 실행 방식을 바꾸면 settings.json의 이 부분만 고치면 된다. */
export interface LaunchConfig {
  steamAppId: string;
  /** url: steamUrl을 OS 프로토콜 처리기로 연다. applaunch: steam.exe -applaunch {appId} */
  steamMethod: 'url' | 'applaunch';
  /** {appId}가 steamAppId로 치환된다. */
  steamUrl: string;
  /** Steam 실행 인자가 있을 때 쓰는 URL. {args}는 URL 인코딩된 인자 문자열. */
  steamUrlWithArgs: string;
  kakaoUrl: string;
  gameProcess: string;
  timeoutSec: number;
}

/** F5 실행 옵션. 빈 문자열은 "사용 안 함". */
export interface ProfileConfig {
  steamArgs: string;
  /** 게임 시작 버튼을 누르면 클라이언트보다 먼저 실행 */
  beforeProgram: string;
  /** 게임 프로세스가 종료되면 실행 */
  afterProgram: string;
}

/** F6 공지 소스. {appId}가 steamAppId로 치환된다. */
export interface NoticeConfig {
  steamNewsApi: string;
  steamNewsPage: string;
  kakaoNoticePage: string;
  kakaoUpdatePage: string;
  /** 이 시간 안에 올라온 점검 공지만 "점검 안내"로 보여 준다. */
  maintenanceHours: number;
}

export interface Settings {
  lastServer: Server;
  /** 사용자가 직접 고른 Steam 폴더. 없으면 자동 탐지. */
  steamPath?: string;
  launch: LaunchConfig;
  profile: ProfileConfig;
  notices: NoticeConfig;
}

/** 실행 옵션 화면에서 다루는 값. 카카오는 실행 인자 없이 접속 주소만. */
export interface Profile extends ProfileConfig {
  kakaoUrl: string;
}

export interface NoticeItem {
  title: string;
  url: string;
  /** ms */
  date: number;
}

export interface NoticeInfo {
  /** links: 공식 데이터 경로가 없어 링크만 제공 */
  status: 'loading' | 'ok' | 'error' | 'links';
  patch?: NoticeItem;
  maintenance?: NoticeItem;
  links: { label: string; url: string }[];
}

export interface PlayRecord {
  lastPlayedAt: number | null;
  totalMs: number;
}
export type PlayRecords = Record<Server, PlayRecord>;

export interface UpdateState {
  /** dev: 개발 실행이라 확인 불가 */
  status: 'dev' | 'idle' | 'checking' | 'none' | 'available' | 'downloading' | 'ready' | 'error';
  version?: string;
  percent?: number;
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
  notices: Record<Server, NoticeInfo>;
  records: PlayRecords;
  version: string;
  update: UpdateState;
}

export interface LauncherApi {
  getState(): Promise<AppState>;
  selectServer(server: Server): Promise<AppState>;
  chooseSteamFolder(): Promise<AppState>;
  launch(): Promise<AppState>;
  getProfile(): Promise<Profile>;
  saveProfile(p: Profile): Promise<{ ok: boolean; errors: string[] }>;
  pickProgram(): Promise<string | null>;
  resetRecords(): Promise<AppState>;
  openLink(url: string): Promise<void>;
  createShortcuts(): Promise<AppState>;
  checkUpdate(): Promise<void>;
  downloadUpdate(): Promise<void>;
  installUpdate(): Promise<void>;
  onState(cb: (s: AppState) => void): void;
}
