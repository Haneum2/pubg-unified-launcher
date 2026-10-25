import fs from 'node:fs';
import path from 'node:path';
import type { Settings } from '../shared/types';

export const DEFAULTS: Settings = {
  lastServer: 'steam',
  launch: {
    steamAppId: '578080',
    steamMethod: 'url',
    steamUrl: 'steam://rungameid/{appId}',
    kakaoUrl: 'https://pubg.kakaogames.com/pubg/index.daum',
    gameProcess: 'TslGame.exe',
    timeoutSec: 30,
  },
};

/** 파일이 없거나 깨졌으면 기본값. 일부 항목만 있어도 나머지는 기본값으로 채운다. */
export function loadSettings(file: string): Settings {
  let raw: Partial<Settings> = {};
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    // 첫 실행 또는 손상된 파일
  }
  return {
    ...DEFAULTS,
    ...raw,
    lastServer: raw.lastServer === 'kakao' ? 'kakao' : 'steam',
    launch: { ...DEFAULTS.launch, ...raw.launch },
  };
}

export function saveSettings(file: string, s: Settings): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // 임시 파일에 쓰고 교체해서, 쓰는 도중 꺼져도 기존 설정이 깨지지 않게 한다.
  fs.writeFileSync(file + '.tmp', JSON.stringify(s, null, 2));
  fs.renameSync(file + '.tmp', file);
}
