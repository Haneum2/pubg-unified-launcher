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

---

# 2단계 조사 (2026-10-25): 실행 인자(F5), 점검·패치 정보(F6)

## 3. Steam 실행 인자 전달 (F5)

| 방식 | 형식 | 근거 | 상태 |
| --- | --- | --- | --- |
| URL (기본) | `steam://run/{appId}//{args}/` (`launch.steamUrlWithArgs`) | Valve Developer Community "Steam browser protocol" <https://developer.valvesoftware.com/wiki/Steam_browser_protocol> — `run` 계열 명령의 args는 앱 실행 인자로 전달된다고 설명. 인자가 있으면 Steam이 사용자에게 확인 창을 띄운다 | 문서 확인. 인자 인코딩(`%20`) 처리는 **실제 실행으로 확인 필요** |
| 명령줄 | `steam.exe -applaunch {appId} {args...}` (`launch.steamMethod = "applaunch"`) | <https://developer.valvesoftware.com/wiki/Command_line_options> (403으로 본문 재확인 못 함) | **확인 필요** |

- 둘 다 Steam이 공식으로 제공하는 경로다. 런처는 Steam의 "실행 옵션" 설정 파일(`localconfig.vdf`)이나 게임 파일을 고치지 않는다.
- 인자는 영문·숫자·공백과 `- + = . , : _`만 허용한다. 따옴표, 셸 문자, 경로 구분자, 줄바꿈은 막아서 URL이나 명령줄이 다른 뜻으로 해석되지 않게 한다.
- PUBG가 어떤 인자를 실제로 반영하는지에 대한 KRAFTON 공식 문서는 찾지 못했다. 인자 효과는 사용자가 직접 확인해야 한다.

## 4. 점검·패치 정보 소스 (F6)

### Steam: 공식 Web API 사용
- `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=578080&count=50&maxlength=1&feeds=steam_community_announcements`
  - Valve가 공개한 Steam Web API다(키 불필요). 2026-10-25 호출 시 200 OK, PUBG 공식 공지(`steam_community_announcements`)가 반환됐다.
  - 패치 노트 제목 형식: "Patch Notes - Update 43.2" (2026-10-13). 같은 공지는 pubg.com 뉴스에도 "패치 노트 - 업데이트 43.2"로 올라온다(<https://pubg.com/ko/news>).
- **점검 공지 한계:** 최근 200건 중 제목에 "Maintenance/점검"이 들어간 공지는 **하나도 없었다**. pubg.com 뉴스에도 점검 공지는 보이지 않았고 RSS·API도 없다. PUBG 개발자 API(<https://documentation.pubg.com/>)는 전적 데이터용이라 게임 서버 점검 상태를 주지 않는다.
  - 그래서 런처는 "최근 48시간(`notices.maintenanceHours`) 안에 제목에 Maintenance/점검이 들어간 Steam 공지"가 있을 때만 점검 안내를 보여 준다. 점검 시각은 본문 자유 텍스트라 읽지 않는다. 안내만 할 뿐 시작 버튼은 막지 않는다.
  - 공지 원문 확인용으로 Steam 공지 페이지 <https://store.steampowered.com/news/app/578080> 링크를 함께 준다.

### 카카오: 공식 데이터 경로 없음 → 링크로 대체
- 공지 게시판: `https://bbs-pubg.kakaogames.com/gaia/do/pubg/notice/list?bbsId=PN001`
- 업데이트 게시판: `https://bbs-pubg.kakaogames.com/gaia/do/pubg/update/list?bbsId=PN002&objCate1=255`
  - 두 주소 모두 카카오 PUBG 공식 홈페이지(`pubg.kakaogames.com/pubg/index.daum`) 메뉴에 링크된 것을 확인했다.
- RSS나 API가 없고, 자동 요청(curl)은 403으로 막힌다. HTML을 긁어 오는 것은 공식 경로가 아니므로 하지 않고, "공지사항 열기", "업데이트 소식 열기" 링크만 준다.
- 참고: 공식 홈페이지에 **"10월 26일(월) 기존 Daum게임 URL 지원 종료 안내"** 공지가 있다. 옛 주소 `pubg.game.daum.net`은 곧 동작하지 않으므로, 기본값이 이미 새 주소(`pubg.kakaogames.com`)인 것이 맞다.
