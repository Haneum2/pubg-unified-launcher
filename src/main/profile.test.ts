import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeProfile, splitArgs, validateProfile } from './profile';

const ok = { steamArgs: '', kakaoUrl: 'https://pubg.kakaogames.com/pubg/index.daum', beforeProgram: '', afterProgram: '' };
const exists = (...files: string[]) => (p: string) => files.includes(p);

test('기본값(빈 인자, 프로그램 없음)은 통과', () => {
  assert.deepEqual(validateProfile(ok, null, exists()), []);
});

test('일반적인 Steam 실행 인자는 통과하고 공백으로 나뉜다', () => {
  const p = { ...ok, steamArgs: '-USEALLAVAILABLECORES -malloc=system +fps_max 144' };
  assert.deepEqual(validateProfile(p, null, exists()), []);
  assert.deepEqual(splitArgs(p.steamArgs), ['-USEALLAVAILABLECORES', '-malloc=system', '+fps_max', '144']);
});

test('따옴표·셸 문자·경로가 든 실행 인자는 거부', () => {
  for (const steamArgs of ['-a "b"', '-a & calc', '-a | x', '-log=C:\\x', '-a\n-b', '-x=../y']) {
    assert.equal(validateProfile({ ...ok, steamArgs }, null, exists()).length, 1, steamArgs);
  }
  assert.equal(validateProfile({ ...ok, steamArgs: 'a'.repeat(301) }, null, exists()).length, 1);
});

test('카카오 주소: 빈 값, http, 잘못된 주소는 거부', () => {
  for (const kakaoUrl of ['', 'http://pubg.kakaogames.com', 'pubg.kakaogames.com', 'javascript:alert(1)']) {
    assert.equal(validateProfile({ ...ok, kakaoUrl }, null, exists()).length, 1, kakaoUrl);
  }
});

test('프로그램: 없는 경로, 상대 경로, exe가 아닌 파일은 거부', () => {
  const v = (beforeProgram: string) => validateProfile({ ...ok, beforeProgram }, null, exists('C:\\Tools\\a.exe', 'C:\\Tools\\a.bat'));
  assert.deepEqual(v('C:\\Tools\\a.exe'), []);
  assert.match(v('C:\\Tools\\missing.exe')[0], /파일이 없습니다/);
  assert.match(v('Tools\\a.exe')[0], /전체 경로/);
  assert.match(v('C:\\Tools\\a.bat')[0], /\.exe/);
});

test('게임 폴더 안의 파일은 실행 전·후 프로그램으로 지정할 수 없다', () => {
  const game = 'D:\\SteamLibrary\\steamapps\\common\\PUBG';
  const exe = 'd:\\steamlibrary\\steamapps\\common\\pubg\\TslGame\\Binaries\\Win64\\TslGame.exe';
  assert.match(validateProfile({ ...ok, afterProgram: exe }, game, exists(exe))[0], /게임 폴더/);
  // 이름만 비슷한 옆 폴더는 허용
  const other = 'D:\\SteamLibrary\\steamapps\\common\\PUBG Tools\\x.exe';
  assert.deepEqual(validateProfile({ ...ok, afterProgram: other }, game, exists(other)), []);
});

test('여러 문제는 한꺼번에 알려 준다', () => {
  assert.equal(validateProfile({ steamArgs: '"', kakaoUrl: '', beforeProgram: 'x', afterProgram: 'y' }, null, exists()).length, 4);
});

test('normalizeProfile: 공백 제거, 문자열이 아닌 값은 빈 값', () => {
  assert.deepEqual(normalizeProfile({ steamArgs: '  -a  ', kakaoUrl: 3 as any }), {
    steamArgs: '-a',
    kakaoUrl: '',
    beforeProgram: '',
    afterProgram: '',
  });
});
