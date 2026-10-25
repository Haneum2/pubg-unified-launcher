import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/** 레지스트리 값 하나를 읽기 전용으로 조회한다(reg query). 없으면 null. */
export function regQuery(key: string, value: string): string | null {
  try {
    const out = execFileSync('reg', ['query', key, '/v', value], { encoding: 'utf8', windowsHide: true });
    return out.match(/REG_\w+\s+(.+)$/m)?.[1].trim() ?? null;
  } catch {
    return null;
  }
}

const REG_CANDIDATES: [string, string][] = [
  ['HKCU\\Software\\Valve\\Steam', 'SteamPath'],
  ['HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam', 'InstallPath'],
  ['HKLM\\SOFTWARE\\Valve\\Steam', 'InstallPath'],
];
const DEFAULT_DIR = 'C:\\Program Files (x86)\\Steam';

export function isSteamDir(dir: string, exists: (p: string) => boolean = fs.existsSync): boolean {
  return exists(path.join(dir, 'steam.exe'));
}

/** 수동 지정 경로 → 레지스트리 → 기본 설치 경로 순으로 steam.exe가 있는 폴더를 찾는다. */
export function detectSteam(
  manual: string | undefined,
  read = regQuery,
  exists: (p: string) => boolean = fs.existsSync,
): string | null {
  const candidates = [manual, ...REG_CANDIDATES.map(([k, v]) => read(k, v)), DEFAULT_DIR];
  for (const c of candidates) {
    if (!c) continue;
    const dir = path.win32.normalize(c);
    if (isSteamDir(dir, exists)) return dir;
  }
  return null;
}

/** libraryfolders.vdf 내용에서 appId가 들어 있는 라이브러리 경로를 찾는다. */
export function findAppLibrary(vdf: string, appId: string): string | null {
  // ponytail: VDF 파서 대신 "path" 단위로 잘라 검사. 각 라이브러리 블록은 path 다음에 apps가 오는 구조에 의존.
  for (const block of vdf.split(/"path"/).slice(1)) {
    const p = block.match(/^\s*"([^"]*)"/)?.[1];
    const apps = block.match(/"apps"\s*\{([^}]*)\}/)?.[1] ?? '';
    if (p && apps.includes(`"${appId}"`)) return p.replace(/\\\\/g, '\\');
  }
  return null;
}

export function findPubgLibrary(steamDir: string, appId: string): string | null {
  try {
    const vdf = fs.readFileSync(path.join(steamDir, 'steamapps', 'libraryfolders.vdf'), 'utf8');
    return findAppLibrary(vdf, appId);
  } catch {
    return null;
  }
}
