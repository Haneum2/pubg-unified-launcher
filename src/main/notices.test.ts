import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fetchSteamNotices, parseSteamNews } from './notices';
import { DEFAULTS } from './settings';

const H = 3_600_000;
const now = 1_000 * H;
const item = (title: string, hoursAgo: number) => ({ title, url: `https://x/${title}`, date: (now - hoursAgo * H) / 1000 });

test('최근 패치 노트와 48시간 안의 점검 공지를 고른다', () => {
  const json = { appnews: { newsitems: [item('PGS 11 is LIVE', 1), item('Live Server Maintenance', 5), item('Patch Notes - Update 43.2', 30)] } };
  const r = parseSteamNews(json, now, 48);
  assert.equal(r.patch?.title, 'Patch Notes - Update 43.2');
  assert.equal(r.maintenance?.title, 'Live Server Maintenance');
});

test('오래된 점검 공지는 무시하고, 형식이 이상하면 빈 결과', () => {
  const json = { appnews: { newsitems: [item('Server Maintenance', 72)] } };
  assert.equal(parseSteamNews(json, now, 48).maintenance, undefined);
  assert.deepEqual(parseSteamNews(null, now, 48), { patch: undefined, maintenance: undefined });
});

test('네트워크 실패 시 예외 없이 error 상태와 공지 페이지 링크', async () => {
  const cfg = { ...DEFAULTS.notices, steamNewsApi: 'https://127.0.0.1:1/' };
  const r = await fetchSteamNotices(cfg, '578080');
  assert.equal(r.status, 'error');
  assert.equal(r.links[0].url, 'https://store.steampowered.com/news/app/578080');
});
