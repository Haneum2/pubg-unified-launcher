import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseServerArg, shortcutSpec } from './shortcuts';

test('--server 인자 해석', () => {
  assert.equal(parseServerArg(['app.exe', '--server=steam']), 'steam');
  assert.equal(parseServerArg(['electron.exe', 'C:\\app', '--server=kakao']), 'kakao');
  assert.equal(parseServerArg(['app.exe']), null);
  assert.equal(parseServerArg(['app.exe', '--server=xbox']), null);
  assert.equal(parseServerArg(['app.exe', '--server=steam&calc']), null);
});

test('바로가기 대상: 설치본은 exe 직접, 개발 실행은 앱 폴더를 넘긴다', () => {
  assert.deepEqual(shortcutSpec('steam', true, 'C:\\L\\launcher.exe', 'ignored').args, '--server=steam');
  const dev = shortcutSpec('kakao', false, 'C:\\n\\electron.exe', 'C:\\My Apps\\launcher');
  assert.equal(dev.target, 'C:\\n\\electron.exe');
  assert.equal(dev.args, '"C:\\My Apps\\launcher" --server=kakao');
  assert.equal(parseServerArg(['C:\\n\\electron.exe', 'C:\\My Apps\\launcher', '--server=kakao']), 'kakao');
});
