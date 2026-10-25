import type { AppState, LauncherApi, NoticeInfo, Phase, PlayRecord, Profile, Server, UpdateState } from '../shared/types';

const api = (window as unknown as { launcher: LauncherApi }).launcher;
const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;

const LABELS: Record<Phase, string> = {
  idle: '대기 중',
  client: '클라이언트 실행 중',
  web: '웹사이트를 열었음',
  game: '게임 실행 중',
  failed: '실패',
};

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...kids: (Node | string)[]) => {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...kids);
  return e;
};
const row = (...kids: (Node | string)[]) => el('div', { className: 'row' }, ...kids);
const fmtDate = (ms: number) => new Date(ms).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

function formatDuration(ms: number): string {
  const m = Math.floor(ms / 60_000);
  return m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분`;
}

function linkButton(text: string, onclick: () => void): HTMLButtonElement {
  return el('button', { className: 'link', textContent: text, onclick });
}
const openLink = (text: string, url: string) => linkButton(text, () => api.openLink(url));

function renderNotice(n: NoticeInfo): (Node | string)[] {
  const links = n.links.flatMap((l, i) => [i ? ' · ' : '', openLink(l.label, l.url)]);
  if (n.status === 'loading') return [row('점검·패치 정보를 가져오는 중…')];
  if (n.status === 'error') return [row('점검·패치 정보를 가져올 수 없음 · ', ...links)];
  if (n.status === 'links') return [row('카카오는 공지를 가져올 공식 경로가 없어 공지 페이지로 안내합니다.'), row(...links)];
  return [
    row('최근 패치: ', n.patch ? openLink(`${n.patch.title} (${fmtDate(n.patch.date)})`, n.patch.url) : '없음'),
    row('점검: ', n.maintenance ? openLink(`${n.maintenance.title} (${fmtDate(n.maintenance.date)})`, n.maintenance.url) : '최근 점검 공지 없음'),
    row(...links),
  ];
}

function renderRecord(r: PlayRecord): (Node | string)[] {
  return [
    row(
      '마지막 플레이: ', el('b', { textContent: r.lastPlayedAt ? fmtDate(r.lastPlayedAt) : '기록 없음' }),
      ' · 누적: ', el('b', { textContent: formatDuration(r.totalMs) }),
    ),
    row(linkButton('기록 초기화', async () => render(await api.resetRecords()))),
  ];
}

function renderUpdate(u: UpdateState): (Node | string)[] {
  switch (u.status) {
    case 'dev': return ['개발 실행 (업데이트 확인 안 함)'];
    case 'checking': return ['업데이트 확인 중…'];
    case 'none': return ['최신 버전입니다'];
    case 'available': return [`새 버전 ${u.version} · `, linkButton('다운로드', () => api.downloadUpdate())];
    case 'downloading': return [`새 버전 내려받는 중… ${u.percent ?? 0}%`];
    case 'ready': return [`새 버전 ${u.version} 준비됨 · `, linkButton('설치', () => api.installUpdate())];
    case 'error': return ['업데이트 정보를 가져올 수 없음 · ', linkButton('다시 확인', () => api.checkUpdate())];
    default: return [linkButton('업데이트 확인', () => api.checkUpdate())];
  }
}

function render(s: AppState): void {
  document.querySelectorAll<HTMLButtonElement>('[data-server]').forEach((b) =>
    b.setAttribute('aria-selected', String(b.dataset.server === s.server)),
  );

  const folderLink = (text: string) => linkButton(text, async () => render(await api.chooseSteamFolder()));
  $('#info').replaceChildren(
    s.server === 'kakao'
      ? '카카오 공식 웹사이트를 기본 브라우저로 엽니다. 로그인과 게임 시작은 웹에서 직접 진행하세요.'
      : s.steamPath
        ? row('Steam 경로: ', el('b', { textContent: s.steamPath }), s.pubgLibrary ? ' · PUBG 설치됨' : ' · 라이브러리에서 PUBG를 찾지 못함', ' · ', folderLink('경로 변경'))
        : row('Steam을 찾지 못했습니다. Steam을 설치하거나 ', folderLink('Steam 폴더 선택'), '으로 직접 지정하세요.'),
  );

  const notice = s.notices[s.server];
  $('#notice').replaceChildren(...renderNotice(notice));
  // 점검 정보가 틀릴 수 있으므로 안내만 하고 시작 버튼은 막지 않는다.
  $('#maint').textContent = notice.maintenance ? '점검 공지가 있습니다. 접속이 안 될 수 있어요.' : '';

  // 클라이언트 실행 대기 중이거나 게임이 떠 있으면 탭을 바꿔도 다시 실행할 수 없다(main에서도 한 번 더 막는다).
  const busy = s.phase === 'client' || s.phase === 'game';
  $('#start').toggleAttribute('disabled', busy || (s.server === 'steam' && !s.steamPath));
  $('#start').textContent = s.phase === 'client' ? '실행 중…' : s.phase === 'game' ? '게임 실행 중' : '게임 시작';
  const status = $('#status');
  status.dataset.phase = s.phase;
  status.querySelector('.label')!.textContent = s.phase === 'idle' && !s.message ? '' : LABELS[s.phase];
  status.querySelector('.msg')!.textContent = s.message;

  $('#records').replaceChildren(...renderRecord(s.records[s.server]));
  $('#tools').replaceChildren(
    `v${s.version} · `, ...renderUpdate(s.update), ' · ',
    linkButton('바탕화면 바로가기 만들기', async () => render(await api.createShortcuts())),
  );
}

// --- 실행 옵션 창 ---
const FIELDS = ['steamArgs', 'kakaoUrl', 'beforeProgram', 'afterProgram'] as const;
const input = (id: string) => $<HTMLInputElement>('#' + id);
const dlg = $<HTMLDialogElement>('#opts');

$('#optsBtn').onclick = async () => {
  const p = await api.getProfile();
  FIELDS.forEach((f) => (input(f).value = p[f]));
  $('#optsErrors').replaceChildren();
  dlg.showModal();
};
$('#optsCancel').onclick = () => dlg.close();
document.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach((b) => {
  b.onclick = async () => {
    const file = await api.pickProgram();
    if (file) input(b.dataset.pick!).value = file;
  };
});
$('#optsForm').onsubmit = async (e) => {
  e.preventDefault();
  const p = Object.fromEntries(FIELDS.map((f) => [f, input(f).value])) as unknown as Profile;
  const r = await api.saveProfile(p);
  if (r.ok) dlg.close();
  else $('#optsErrors').replaceChildren(...r.errors.map((t) => el('li', { textContent: t })));
};

document.querySelectorAll<HTMLButtonElement>('[data-server]').forEach((b) => {
  b.onclick = async () => render(await api.selectServer(b.dataset.server as Server));
});
$('#start').onclick = async () => {
  $('#start').toggleAttribute('disabled', true); // 응답 전 연타 방지
  render(await api.launch());
};
api.onState(render);
render(await api.getState());
