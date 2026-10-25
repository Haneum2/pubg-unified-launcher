import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { MAX_GAP_MS, accrue, emptyRecords, loadRecords, markPlayed } from './records';
import { writeJson } from './settings';

test('2초 간격 조회로 1분 동안 떠 있으면 60초가 쌓인다', () => {
  let r = emptyRecords();
  let seen: number | null = null;
  for (let t = 0; t <= 60_000; t += 2_000) {
    r = accrue(r, 'steam', seen, t);
    seen = t;
  }
  assert.equal(r.steam.totalMs, 60_000);
  assert.equal(r.kakao.totalMs, 0);
});

test('처음 발견한 순간(직전 기록 없음)은 0초', () => {
  assert.equal(accrue(emptyRecords(), 'kakao', null, 5_000).kakao.totalMs, 0);
});

test('절전 등으로 간격이 길면 MAX_GAP_MS까지만 더한다', () => {
  assert.equal(accrue(emptyRecords(), 'steam', 0, 3_600_000).steam.totalMs, MAX_GAP_MS);
});

test('시계가 뒤로 가면 더하지 않는다', () => {
  assert.equal(accrue(emptyRecords(), 'steam', 10_000, 5_000).steam.totalMs, 0);
});

test('누적은 기존 값에 더해지고 원본은 바뀌지 않는다', () => {
  const r0 = { ...emptyRecords(), kakao: { lastPlayedAt: 1, totalMs: 1_000 } };
  const r1 = accrue(r0, 'kakao', 0, 2_000);
  assert.equal(r1.kakao.totalMs, 3_000);
  assert.equal(r1.kakao.lastPlayedAt, 1);
  assert.equal(r0.kakao.totalMs, 1_000);
});

test('markPlayed는 해당 서버의 마지막 실행 시각만 바꾼다', () => {
  const r = markPlayed(emptyRecords(), 'steam', 123);
  assert.equal(r.steam.lastPlayedAt, 123);
  assert.equal(r.kakao.lastPlayedAt, null);
});

test('기록 파일: 저장 후 다시 읽기, 깨진 값은 0/null로', () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pubg-records-')), 'records.json');
  assert.deepEqual(loadRecords(f), emptyRecords());
  writeJson(f, { steam: { lastPlayedAt: 5, totalMs: 7 }, kakao: { lastPlayedAt: 'x', totalMs: -1 } });
  const r = loadRecords(f);
  assert.deepEqual(r.steam, { lastPlayedAt: 5, totalMs: 7 });
  assert.deepEqual(r.kakao, { lastPlayedAt: null, totalMs: 0 });
});
