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

/**
 * 파일은 있는데 JSON으로 읽을 수 없으면(손상) 원본을 file.broken으로 옮기고 기본값으로 다시 쓴다.
 * 복구했으면 true.
 */
export function recoverJson(file: string, defaults: unknown): boolean {
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return false; // 파일 없음: 첫 실행
  }
  try {
    const v = JSON.parse(text);
    if (v && typeof v === 'object') return false;
  } catch {
    // 손상
  }
  try {
    fs.renameSync(file, file + '.broken');
    writeJson(file, defaults);
  } catch {
    // 쓰기도 안 되면 메모리의 기본값으로 계속 동작한다.
  }
  return true;
}

/** 기본값과 같은 타입인 항목만 받아들인다. 숫자는 0 이상 유한값만. */
function pick<T extends object>(defaults: T, raw: unknown): T {
  const out = { ...defaults };
  if (!raw || typeof raw !== 'object') return out;
  for (const k of Object.keys(defaults) as (keyof T)[]) {
    const v = (raw as T)[k];
    if (typeof v !== typeof defaults[k]) continue;
    if (typeof v === 'number' && !(Number.isFinite(v) && v >= 0)) continue;
    out[k] = v;
  }
  return out;
}

/** 파일이 없거나 깨졌으면 기본값. 일부 항목만 있거나 타입이 틀린 항목은 기본값으로 채운다. */
export function loadSettings(file: string): Settings {
  const raw = readJson(file);
  const launch = pick(DEFAULTS.launch, raw.launch);
  if (launch.steamMethod !== 'url' && launch.steamMethod !== 'applaunch') launch.steamMethod = DEFAULTS.launch.steamMethod;
  const s: Settings = {
    lastServer: raw.lastServer === 'kakao' ? 'kakao' : 'steam',
    launch,
    profile: pick(DEFAULTS.profile, raw.profile),
    notices: pick(DEFAULTS.notices, raw.notices),
  };
  if (typeof raw.steamPath === 'string' && raw.steamPath) s.steamPath = raw.steamPath;
  return s;
}

export function saveSettings(file: string, s: Settings): void {
  writeJson(file, s);
}
