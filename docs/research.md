# 실행 방식 조사 (2026-10-25)

PRD 오픈 이슈 1(카카오 웹사이트 주소·게임 시작 방식)과 Steam 실행 방식을 개발 전에 확인한 결과다.
여기 나온 값은 모두 `settings.json`의 `launch` 항목으로 분리되어 있어, 바뀌면 설정만 고치면 된다.

## 1. Steam

| 항목 | 값 | 근거 | 상태 |
| --- | --- | --- | --- |
| PUBG 앱 ID | `578080` | Steam 상점 페이지 <https://store.steampowered.com/app/578080/> (제목 "PUBG: BATTLEGROUNDS", 배급사 KRAFTON) | 확인됨 |
| 실행 URL | `steam://rungameid/578080` | Valve Developer Community "Steam browser protocol" <https://developer.valvesoftware.com/wiki/Steam_browser_protocol> — `rungameid/<id>`는 `run`과 같되 모드·비Steam 바로가기도 지원 | 확인됨 (문서). 실제 실행은 직접 확인 필요 |
| 대안: `steam.exe -applaunch 578080` | Steam 클라이언트 명령줄 옵션 | <https://developer.valvesoftware.com/wiki/Command_line_options> (Steam 항목의 `-applaunch`) — 조사 중 페이지가 403을 반환해 본문을 다시 확인하지 못함 | **확인 필요** |
| Steam 경로 (레지스트리) | `HKCU\Software\Valve\Steam` → `SteamPath`, 대안 `HKLM\SOFTWARE\WOW6432Node\Valve\Steam` → `InstallPath` | 이 PC에서 직접 조회해 확인 (`SteamPath = c:/program files (x86)/steam`) | 확인됨 (이 PC) |
| 라이브러리 설정 파일 | `<Steam>\steamapps\libraryfolders.vdf` — 라이브러리별 `"path"`와 `"apps"` 목록 | 이 PC 파일에서 `"578080"` 항목 확인 | 확인됨 (이 PC) |
| 게임 프로세스 | `TslGame.exe` | 요구사항(PRD 지시)에 명시된 값 | 실제 실행으로 확인 필요 |

기본값은 `steam://rungameid/{appId}` URL 방식(`launch.steamMethod = "url"`)이다. URL은 OS에 등록된 Steam 프로토콜 처리기로 열리고,
`"applaunch"`로 바꾸면 탐지한 `steam.exe`를 `-applaunch {appId}` 인자로 직접 실행한다.

## 2. 카카오

| 항목 | 값 | 근거 | 상태 |
| --- | --- | --- | --- |
| 공식 웹사이트 | `https://pubg.kakaogames.com/pubg/index.daum` | 옛 주소 `https://pubg.game.daum.net/pubg/index.daum`이 이 주소로 **301 Moved Permanently** 리다이렉트됨 (2026-10-25 조회). 페이지 하단에 (주)카카오게임즈·KRAFTON 저작권 표기, "카카오 배틀그라운드 홈페이지 주소 변경" 공지 있음 | 리다이렉트로 확인. 주소 변경 이력이 있으므로 **정기 확인 필요** |
| 게임 시작 버튼 | `javascript:void(0)` 링크. 클릭 시 페이지 스크립트가 동작 | 위 페이지 본문 | 확인됨 |
| 시작 전 절차 | 계정 동의, MOTP, PC 등록, ARS, 게임 시작 보안(IP 인증: SMS·카카오톡·카드) 레이어가 상황에 따라 뜸 | 위 페이지 본문 | 확인됨 |
| 런처 호출 방식 | 설치형 도우미 "Daum 게임 스타터"(IE) / "Daum 게임 컨트롤러"(Chrome·Firefox·Edge)가 등록한 프로토콜 처리기로 실행. 페이지에 "DaumGameStarterProtocol" 실행 확인 메시지가 뜨면 "실행"을 누르라는 안내가 있음 | 위 페이지 본문, 설치 안내 <https://gcdn.pcpf.kakaogames.com/static/daum/starter/download.html> ("게임시작 버튼을 누르면 실행 확인 창이 매번 뜬다") | 프로토콜 이름의 정확한 URL 스킴은 **확인 필요** (런처는 이 값을 쓰지 않음) |
| 도우미 설치 파일 | `https://common.gdn.gamecdn.net/live/DaumGameControllerSetup.exe`, `.../DaumGameStarterSetup.exe` | 위 페이지에 링크됨 | 참고용 |
| 게임 프로세스 | Steam과 같은 `TslGame.exe`로 추정 | 근거 없음 (원빌드 운영이라는 2017년 보도만 있음: <https://www.fnnews.com/news/201710241120349803>) | **확인 필요** |

### 결론
- 카카오 쪽 게임 시작은 로그인·본인 인증·PC 등록 등 공식 웹 흐름을 반드시 거친다. 런처는 PRD 원칙대로
  **기본 브라우저로 공식 사이트를 여는 것까지만** 하고, 로그인과 "게임시작" 클릭은 사용자가 직접 한다.
- 카카오 런처 프로토콜을 직접 호출하는 방식은 인증 절차를 우회하는 셈이고 스킴도 확인되지 않아 쓰지 않는다.

## 참고: 조사 한계
- `curl`로 카카오 페이지를 직접 받으면 403을 반환해, 페이지 스크립트(게임 시작 버튼의 실제 동작 코드)는 확인하지 못했다.
- Valve 개발자 위키는 조사 시점에 자동 조회를 막아(403) 검색 결과 요약으로만 확인했다.
