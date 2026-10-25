import type { NoticeConfig, NoticeInfo, NoticeItem } from '../shared/types';

/** Steam 공식 뉴스 API 응답에서 최근 패치 노트와 최근 점검 공지를 고른다. */
export function parseSteamNews(json: any, now: number, maintenanceHours: number): Pick<NoticeInfo, 'patch' | 'maintenance'> {
  const raw: any[] = Array.isArray(json?.appnews?.newsitems) ? json.appnews.newsitems : [];
  const items: NoticeItem[] = raw.map((n) => ({ title: String(n.title ?? ''), url: String(n.url ?? ''), date: Number(n.date) * 1000 }));
  // ponytail: 제목 키워드로만 판별. 점검 시각은 본문 자유 텍스트라 읽지 않고, 최근 공지 유무만 안내한다.
  return {
    patch: items.find((i) => /patch notes|패치 ?노트/i.test(i.title)),
    maintenance: items.find((i) => /maintenance|점검/i.test(i.title) && now - i.date < maintenanceHours * 3_600_000),
  };
}

export async function fetchSteamNotices(cfg: NoticeConfig, appId: string, now = Date.now()): Promise<NoticeInfo> {
  const links = [{ label: 'Steam 공지 페이지 열기', url: cfg.steamNewsPage.replace('{appId}', appId) }];
  try {
    const res = await fetch(cfg.steamNewsApi.replace('{appId}', appId), { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(String(res.status));
    return { status: 'ok', ...parseSteamNews(await res.json(), now, cfg.maintenanceHours), links };
  } catch {
    return { status: 'error', links };
  }
}

/** 카카오는 공식 데이터 제공 경로(API·RSS)가 없어 공지 페이지 링크만 준다. docs/research.md 참고. */
export function kakaoNotices(cfg: NoticeConfig): NoticeInfo {
  return {
    status: 'links',
    links: [
      { label: '공지사항 열기', url: cfg.kakaoNoticePage },
      { label: '업데이트 소식 열기', url: cfg.kakaoUpdatePage },
    ],
  };
}
