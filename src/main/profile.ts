import fs from 'node:fs';
import path from 'node:path';
import type { Profile } from '../shared/types';

const isFile = (p: string) => {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
};

/** 따옴표·셸 문자·경로 구분자를 막고, 공백으로만 나눠 Steam에 그대로 넘긴다. */
const ARG_RE = /^[\w \-+=.,:]*$/;

export const isHttpsUrl = (s: string) => {
  try {
    return new URL(s).protocol === 'https:';
  } catch {
    return false;
  }
};

export const splitArgs = (s: string) => s.split(/\s+/).filter(Boolean);

/** 화면에서 온 값을 문자열로 맞추고 앞뒤 공백을 지운다. */
export function normalizeProfile(input: Partial<Profile> | undefined): Profile {
  const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  return {
    steamArgs: s(input?.steamArgs),
    kakaoUrl: s(input?.kakaoUrl),
    beforeProgram: s(input?.beforeProgram),
    afterProgram: s(input?.afterProgram),
  };
}

/**
 * 문제를 한국어 문장 목록으로 돌려준다. 빈 배열이면 통과.
 * gameDir: 게임 설치 폴더. 그 안의 프로그램은 실행 전·후 프로그램으로 쓸 수 없다(게임을 직접 건드리지 않기 위해).
 */
export function validateProfile(p: Profile, gameDir: string | null = null, exists = isFile): string[] {
  const errors: string[] = [];
  if (p.steamArgs.length > 300) errors.push('Steam 실행 인자는 300자 이하로 입력하세요.');
  else if (!ARG_RE.test(p.steamArgs))
    errors.push('Steam 실행 인자에는 영문·숫자·공백과 - + = . , : _ 만 쓸 수 있습니다.');

  if (!p.kakaoUrl) errors.push('카카오 접속 주소를 입력하세요.');
  else if (!isHttpsUrl(p.kakaoUrl)) errors.push('카카오 접속 주소는 https://로 시작하는 올바른 주소여야 합니다.');

  const programs: [string, string][] = [
    ['실행 전 프로그램', p.beforeProgram],
    ['실행 후 프로그램', p.afterProgram],
  ];
  for (const [label, file] of programs) {
    if (!file) continue;
    if (!path.win32.isAbsolute(file) || !/\.exe$/i.test(file)) errors.push(`${label}은 .exe 파일의 전체 경로여야 합니다.`);
    else if (!exists(file)) errors.push(`${label} 경로에 파일이 없습니다: ${file}`);
    else if (gameDir && path.win32.normalize(file).toLowerCase().startsWith(path.win32.normalize(gameDir).toLowerCase() + '\\'))
      errors.push(`${label}으로 게임 폴더 안의 파일은 지정할 수 없습니다.`);
  }
  return errors;
}
