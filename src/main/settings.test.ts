import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { DEFAULTS, loadSettings, recoverJson, saveSettings } from './settings';

const tmpFile = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pubg-launcher-')), 'sub', 'settings.json');

test('파일이 없으면 기본값', () => {
  assert.deepEqual(loadSettings(tmpFile()), DEFAULTS);
});

test('저장한 마지막 서버와 Steam 경로를 다시 읽는다', () => {
  const f = tmpFile();
  saveSettings(f, { ...DEFAULTS, lastServer: 'kakao', steamPath: 'D:\\Steam' });
  const s = loadSettings(f);
  assert.equal(s.lastServer, 'kakao');
  assert.equal(s.steamPath, 'D:\\Steam');
  assert.ok(!fs.existsSync(f + '.tmp'));
});

test('손상된 JSON이면 기본값', () => {
  const f = tmpFile();
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, '{ not json');
  assert.deepEqual(loadSettings(f), DEFAULTS);
});

test('launch 일부만 바꿔도 나머지는 기본값으로 채운다', () => {
  const f = tmpFile();
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify({ launch: { kakaoUrl: 'https://example.com/' } }));
  const s = loadSettings(f);
  assert.equal(s.launch.kakaoUrl, 'https://example.com/');
  assert.equal(s.launch.steamAppId, DEFAULTS.launch.steamAppId);
  assert.equal(s.lastServer, 'steam');
});

test('1단계 형식의 설정 파일도 그대로 읽고 새 항목은 기본값', () => {
  const f = tmpFile();
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const v1 = { lastServer: 'kakao', steamPath: 'D:\\Steam', launch: { ...DEFAULTS.launch, steamUrlWithArgs: undefined, timeoutSec: 45 } };
  fs.writeFileSync(f, JSON.stringify(v1));
  const s = loadSettings(f);
  assert.equal(s.lastServer, 'kakao');
  assert.equal(s.launch.timeoutSec, 45);
  assert.equal(s.launch.steamUrlWithArgs, DEFAULTS.launch.steamUrlWithArgs);
  assert.deepEqual(s.profile, DEFAULTS.profile);
  assert.deepEqual(s.notices, DEFAULTS.notices);
});

test('JSON이 객체가 아니면(null 등) 기본값', () => {
  const f = tmpFile();
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, 'null');
  assert.deepEqual(loadSettings(f), DEFAULTS);
});

test('손상 복구: 원본은 .broken으로 보관하고 기본값으로 다시 쓴다', () => {
  const f = tmpFile();
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, '{"lastServer": "kak');
  assert.equal(recoverJson(f, DEFAULTS), true);
  assert.equal(fs.readFileSync(f + '.broken', 'utf8'), '{"lastServer": "kak');
  assert.deepEqual(loadSettings(f), DEFAULTS);
  assert.equal(recoverJson(f, DEFAULTS), false, '복구 후에는 정상');
});

test('손상 복구: 파일이 없거나 정상이면 손대지 않는다', () => {
  const f = tmpFile();
  assert.equal(recoverJson(f, DEFAULTS), false);
  assert.ok(!fs.existsSync(f));
  saveSettings(f, { ...DEFAULTS, lastServer: 'kakao' });
  assert.equal(recoverJson(f, DEFAULTS), false);
  assert.equal(loadSettings(f).lastServer, 'kakao');
});

test('손상 복구: 빈 파일, 배열·숫자 JSON도 손상으로 본다', () => {
  for (const text of ['', '42', '"x"']) {
    const f = tmpFile();
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, text);
    assert.equal(recoverJson(f, DEFAULTS), true, JSON.stringify(text));
  }
});

test('타입이 틀린 항목은 기본값으로 (앱이 죽지 않게)', () => {
  const f = tmpFile();
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(
    f,
    JSON.stringify({
      steamPath: 5,
      launch: { timeoutSec: 'abc', steamUrl: 1, steamMethod: 'hack', kakaoUrl: 'https://ok.example/' },
      profile: { steamArgs: ['-a'], beforeProgram: null },
      notices: 'x',
    }),
  );
  const s = loadSettings(f);
  assert.equal(s.steamPath, undefined);
  assert.equal(s.launch.timeoutSec, 30);
  assert.equal(s.launch.steamUrl, DEFAULTS.launch.steamUrl);
  assert.equal(s.launch.steamMethod, 'url');
  assert.equal(s.launch.kakaoUrl, 'https://ok.example/');
  assert.deepEqual(s.profile, DEFAULTS.profile);
  assert.deepEqual(s.notices, DEFAULTS.notices);
});

test('음수·무한대 숫자는 기본값', () => {
  const f = tmpFile();
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify({ launch: { timeoutSec: -5 }, notices: { maintenanceHours: 1e999 } }));
  const s = loadSettings(f);
  assert.equal(s.launch.timeoutSec, 30);
  assert.equal(s.notices.maintenanceHours, 48);
});

test('알 수 없는 서버 값은 steam으로', () => {
  const f = tmpFile();
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify({ lastServer: 'xbox' }));
  assert.equal(loadSettings(f).lastServer, 'steam');
});
