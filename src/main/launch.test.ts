import assert from 'node:assert/strict';
import { test } from 'node:test';
import { launchBlockReason, pollEvent, steamFailMessage, steamTarget } from './launch';
import { DEFAULTS } from './settings';

const base = { server: 'steam' as const, phase: 'idle' as const, steamPath: 'C:\\Steam', deadline: 0, now: 1000, profileErrors: [] };

test('정상이면 막지 않는다', () => {
  assert.equal(launchBlockReason(base), null);
  assert.equal(launchBlockReason({ ...base, phase: 'failed' }), null, '실패 후 재시도 가능');
  assert.equal(launchBlockReason({ ...base, phase: 'web' }), null, '카카오 웹을 연 뒤에도 다시 열 수 있음');
});

test('Steam 미설치: 실행하지 않고 실패 + 설치 안내', () => {
  const r = launchBlockReason({ ...base, steamPath: null });
  assert.equal(r?.fail, true);
  assert.match(r!.message, /설치되어 있지 않습니다/);
});

test('카카오는 Steam이 없어도 실행된다', () => {
  assert.equal(launchBlockReason({ ...base, server: 'kakao', steamPath: null }), null);
});

test('중복 실행 방지: 게임 실행 중이거나 Steam 대기 중이면 막되 실패로 바꾸지 않는다', () => {
  assert.equal(launchBlockReason({ ...base, phase: 'game' })?.fail, false);
  assert.equal(launchBlockReason({ ...base, phase: 'client', deadline: 5000 })?.fail, false);
  // 탭을 카카오로 바꿔도 마찬가지
  assert.equal(launchBlockReason({ ...base, server: 'kakao', phase: 'client', deadline: 5000 })?.fail, false);
  // 대기 시간이 지났으면 다시 시도 가능
  assert.equal(launchBlockReason({ ...base, phase: 'client', deadline: 500 }), null);
});

test('실행 옵션 오류가 있으면 실패로 막는다', () => {
  const r = launchBlockReason({ ...base, profileErrors: ['실행 전 프로그램 경로에 파일이 없습니다: x'] });
  assert.equal(r?.fail, true);
  assert.match(r!.message, /실행 옵션을 확인하세요/);
});

test('상태 전이: 시작 / 종료 / 30초 타임아웃', () => {
  assert.equal(pollEvent('client', true, 0, 30_000), 'started');
  assert.equal(pollEvent('web', true, 0, 0), 'started');
  assert.equal(pollEvent('idle', true, 0, 0), 'started', '런처 밖에서 켠 게임도 감지');
  assert.equal(pollEvent('game', true, 0, 0), null);
  assert.equal(pollEvent('game', false, 0, 0), 'ended');
  assert.equal(pollEvent('client', false, 29_999, 30_000), null);
  assert.equal(pollEvent('client', false, 30_001, 30_000), 'timeout');
  assert.equal(pollEvent('web', false, 999_999, 0), null, '카카오는 타임아웃 없음');
  assert.equal(pollEvent('failed', false, 999_999, 0), null);
});

test('실행 실패 원인 문구: PUBG 미설치와 시간 초과를 구분', () => {
  assert.match(steamFailMessage(null, 30), /PUBG를 찾지 못했습니다/);
  assert.match(steamFailMessage('D:\\Lib', 30), /30초 안에/);
});

test('Steam 실행 대상: URL, 인자 포함 URL, -applaunch', () => {
  assert.deepEqual(steamTarget(DEFAULTS.launch, 'C:\\Steam', ''), { url: 'steam://rungameid/578080' });
  assert.deepEqual(steamTarget(DEFAULTS.launch, 'C:\\Steam', ' -a  -b=1 '), { url: 'steam://run/578080//-a%20-b%3D1/' });
  assert.deepEqual(steamTarget({ ...DEFAULTS.launch, steamMethod: 'applaunch' }, 'C:\\Steam', '-a -b'), {
    file: 'C:\\Steam\\steam.exe',
    args: ['-applaunch', '578080', '-a', '-b'],
  });
});
