import fs from 'node:fs';
import path from 'node:path';
import type { Settings } from '../shared/types';

export const DEFAULTS: Settings = {
  lastServer: 'steam',
  launch: {
    steamAppId: '578080',
    steamMethod: 'url',
    steamUrl: 'steam://rungameid/{appId}',
    steamUrlWithArgs: 'steam://run/{appId}//{args}/',
    kakaoUrl: 'https://pubg.kakaogames.com/pubg/index.daum',
    gameProcess: 'TslGame.exe',
    timeoutSec: 30,
  },
  profile: {
    steamArgs: '',
    beforeProgram: '',
    afterProgram: '',
  },
  notices: {
    steamNewsApi:
      'https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid={appId}&count=50&maxlength=1&feeds=steam_community_announcements',
    steamNewsPage: 'https://store.steampowered.com/news/app/{appId}',
    kakaoNoticePage: 'https://bbs-pubg.kakaogames.com/gaia/do/pubg/notice/list?bbsId=PN001',
    kakaoUpdatePage: 'https://bbs-pubg.kakaogames.com/gaia/do/pubg/update/list?bbsId=PN002&objCate1=255',
    maintenanceHours: 48,
  },
};

/** JSON 객체를 읽는다. 없거나 깨졌거나 객체가 아니면 {}. */
export function readJson(file: string): Record<string, any> {
  try {
    const v = JSON.parse(fs.readFileSync(file, 'utf8'));
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {}; // 첫 실행 또는 손상된 파일
  }
}

export function writeJson(file: string, data: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // 임시 파일에 쓰고 교체해서, 쓰는 도중 꺼져도 기존 파일이 깨지지 않게 한다.
  fs.writeFileSync(file + '.tmp', JSON.stringify(data, null, 2));
  fs.renameSync(file + '.tmp', file);
}

/** 파일이 없거나 깨졌으면 기본값. 일부 항목만 있어도 나머지는 기본값으로 채운다. */
export function loadSettings(file: string): Settings {
  const raw = readJson(file) as Partial<Settings>;
  return {
    ...DEFAULTS,
    ...raw,
    lastServer: raw.lastServer === 'kakao' ? 'kakao' : 'steam',
    launch: { ...DEFAULTS.launch, ...raw.launch },
    profile: { ...DEFAULTS.profile, ...raw.profile },
    notices: { ...DEFAULTS.notices, ...raw.notices },
  };
}

export function saveSettings(file: string, s: Settings): void {
  writeJson(file, s);
}
