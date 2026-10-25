import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { DEFAULTS, loadSettings, saveSettings } from './settings';

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

test('알 수 없는 서버 값은 steam으로', () => {
  const f = tmpFile();
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify({ lastServer: 'xbox' }));
  assert.equal(loadSettings(f).lastServer, 'steam');
});
