import type { PlayRecords, Server } from '../shared/types';
import { readJson } from './settings';

/** 조회 간격이 이보다 길면(절전·일시 중지 등) 이 값까지만 더한다. */
export const MAX_GAP_MS = 10_000;

export const emptyRecords = (): PlayRecords => ({
  steam: { lastPlayedAt: null, totalMs: 0 },
  kakao: { lastPlayedAt: null, totalMs: 0 },
});

export function loadRecords(file: string): PlayRecords {
  const raw = readJson(file);
  const r = emptyRecords();
  for (const s of ['steam', 'kakao'] as const) {
    const v = raw[s];
    if (Number.isFinite(v?.totalMs) && v.totalMs >= 0) r[s].totalMs = v.totalMs;
    if (Number.isFinite(v?.lastPlayedAt)) r[s].lastPlayedAt = v.lastPlayedAt;
  }
  return r;
}

/** 직전 조회(prevSeenAt)에도 게임이 떠 있었다면 그 사이 시간을 누적한다. */
export function accrue(r: PlayRecords, server: Server, prevSeenAt: number | null, now: number): PlayRecords {
  if (prevSeenAt === null || now <= prevSeenAt) return r;
  const add = Math.min(now - prevSeenAt, MAX_GAP_MS);
  return { ...r, [server]: { ...r[server], totalMs: r[server].totalMs + add } };
}

export function markPlayed(r: PlayRecords, server: Server, now: number): PlayRecords {
  return { ...r, [server]: { ...r[server], lastPlayedAt: now } };
}
