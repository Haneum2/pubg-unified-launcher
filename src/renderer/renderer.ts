import type { AppState, LauncherApi, Phase, Server } from '../shared/types';

const api = (window as unknown as { launcher: LauncherApi }).launcher;
const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;

const LABELS: Record<Phase, string> = {
  idle: '대기 중',
  client: '클라이언트 실행 중',
  web: '웹사이트를 열었음',
  game: '게임 실행 중',
  failed: '실패',
};

function render(s: AppState): void {
  document.querySelectorAll<HTMLButtonElement>('[data-server]').forEach((b) =>
    b.setAttribute('aria-selected', String(b.dataset.server === s.server)),
  );

  const info = $('#info');
  if (s.server === 'kakao') {
    info.textContent = '카카오 공식 웹사이트를 기본 브라우저로 엽니다. 로그인과 게임 시작은 웹에서 직접 진행하세요.';
  } else if (s.steamPath) {
    info.innerHTML = '';
    info.append('Steam 경로: ', Object.assign(document.createElement('b'), { textContent: s.steamPath }));
    info.append(s.pubgLibrary ? ' · PUBG 설치됨' : ' · 라이브러리에서 PUBG를 찾지 못함', ' · ');
    info.append(folderLink('경로 변경'));
  } else {
    info.innerHTML = '';
    info.append('Steam을 찾지 못했습니다. Steam을 설치하거나 ', folderLink('Steam 폴더 선택'), '으로 직접 지정하세요.');
  }

  $('#start').toggleAttribute('disabled', s.server === 'steam' && !s.steamPath);
  const status = $('#status');
  status.dataset.phase = s.phase;
  status.querySelector('.label')!.textContent = s.phase === 'idle' && !s.message ? '' : LABELS[s.phase];
  status.querySelector('.msg')!.textContent = s.message;
}

function folderLink(text: string): HTMLButtonElement {
  const b = Object.assign(document.createElement('button'), { className: 'link', textContent: text });
  b.onclick = async () => render(await api.chooseSteamFolder());
  return b;
}

document.querySelectorAll<HTMLButtonElement>('[data-server]').forEach((b) => {
  b.onclick = async () => render(await api.selectServer(b.dataset.server as Server));
});
$('#start').onclick = async () => render(await api.launch());
api.onState(render);
render(await api.getState());
