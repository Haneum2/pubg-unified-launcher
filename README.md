# PUBG 통합 런처 (비공식)

배틀그라운드를 Steam / 카카오 중 골라 한 화면에서 시작하는 Windows용 런처. F1~F9 구현(항목별 상태는 [docs/status.md](docs/status.md)). 상세 요구사항은 [PRD.md](PRD.md), 실행 방식 조사 결과는 [docs/research.md](docs/research.md).

> 비공식 프로젝트입니다. KRAFTON, Valve, 카카오게임즈와 관련이 없습니다.

## 실행

Node.js 20 이상, Windows 10 이상.

```sh
npm install
npm start     # 빌드 후 Electron 실행
npm test      # 단위 테스트 (설치 감지, 설정 저장·검증·손상 복구, 실행 판정, 플레이 시간, 공지, 바로가기)
npm run dist  # Windows 설치 파일 빌드 → releasepubg-unified-launcher-setup-<버전>.exe
```

### 설치 파일 빌드

`npm run dist`는 TypeScript를 빌드한 뒤 electron-builder로 NSIS 설치 파일(x64)을 만든다. 처음 빌드할 때는 Electron·NSIS를 내려받으므로 인터넷이 필요하다.

- 결과물: `releasepubg-unified-launcher-setup-<버전>.exe`, 자동 업데이트용 `releaselatest.yml`, `.blockmap`.
- 코드 서명은 하지 않는다. 그래서 설치할 때 Windows SmartScreen 경고가 뜬다. 아이콘은 지정하지 않았다(상표·로고를 쓰지 않기 위해 Electron 기본 아이콘 사용).
- 설치본과 `npm start`는 같은 데이터 폴더(`%APPDATA%pubg-unified-launcher`)를 쓴다.

## 동작

| 탭 | "게임 시작"을 누르면 | 상태 표시 |
| --- | --- | --- |
| Steam | 탐지한 Steam으로 `steam://rungameid/578080`을 연다 | 클라이언트 실행 중 → `TslGame.exe`가 뜨면 게임 실행 중, 30초 안에 안 뜨면 실패 + 원인 한 줄 |
| 카카오 | 기본 브라우저로 카카오 PUBG 공식 사이트를 연다. 로그인·게임 시작은 웹에서 직접 | 웹사이트를 열었음 → `TslGame.exe`가 뜨면 게임 실행 중 |

- Steam 탐지 순서: 직접 고른 폴더 → 레지스트리(`HKCU\Software\Valve\Steam\SteamPath`, `HKLM\...\InstallPath`) → `C:\Program Files (x86)\Steam`. PUBG 설치 여부는 `steamapps\libraryfolders.vdf`로 확인. 모두 읽기 전용.
- Steam을 못 찾으면 시작 버튼이 꺼지고 설치 안내와 "Steam 폴더 선택"이 나온다.
- 게임 프로세스는 `tasklist` 결과(프로세스 목록)만 본다. 게임 메모리·파일은 건드리지 않고, 계정 정보는 저장하지 않는다.

## 2단계 기능

- **실행 옵션 (F5):** 상단 "실행 옵션" 버튼으로 다음 값을 저장한다.
  - Steam 실행 인자: Steam 공식 경로(`steam://run/{appId}//{args}/` 또는 `-applaunch`)로만 전달하고, 게임 파일이나 Steam 설정 파일은 고치지 않는다.
  - 카카오 접속 주소: 카카오는 웹으로 시작하므로 실행 인자 대신 주소만 둔다.
  - 실행 전 프로그램: "게임 시작"을 누를 때 실행. 실행 후 프로그램: 게임 프로세스가 끝나면 실행. Steam·카카오 공통.
  - 검증: 인자 문자 제한, https 주소, 존재하는 `.exe`의 전체 경로, 게임 폴더 안 파일 금지. 새 프로그램을 저장할 때 무엇이 실행되는지 확인 창을 띄운다. 실행 직전에도 다시 검사한다.
- **점검·패치 정보 (F6):** Steam 탭은 공식 Steam 뉴스 API에서 최근 패치 제목과 최근 48시간 안의 점검 공지를 가져온다(30분마다). 카카오 탭은 공식 데이터 경로가 없어 공지·업데이트 게시판 링크로 대신한다. 실패하면 "정보를 가져올 수 없음"을 보여 준다. 점검 공지가 있어도 시작 버튼은 막지 않는다. 근거는 [docs/research.md](docs/research.md).
- **플레이 기록 (F7):** 서버별 마지막 실행 시각과 누적 시간을 `records.json`에 저장한다. 2초마다 프로세스 목록에서 `TslGame.exe`가 보이는 시간만 더하고, 기록은 "게임 시작"을 누른 서버에 쌓는다(누르지 않았다면 선택된 탭). "기록 초기화"로 지울 수 있다.
  - 런처가 꺼져 있는 동안의 플레이 시간은 기록되지 않는다.

## 3단계 기능

- **바로가기 (F8):** 화면 하단의 "바탕화면 바로가기 만들기"를 누르면 바탕화면에 "PUBG - Steam으로 시작", "PUBG - 카카오로 시작"이 생긴다.
  - 바로가기는 런처를 `--server=steam` 또는 `--server=kakao` 인자로 실행한다. 이때 런처 화면 없이 바로 실행한다.
  - 상태 추적과 플레이 기록은 백그라운드에서 계속하고, 게임이 끝나면 런처가 종료된다.
  - 실패(Steam 미설치, 30초 시간 초과, 실행 옵션 오류)하면 오류 창만 띄우고 종료한다.
  - 카카오는 웹을 연 뒤 10분 안에 게임이 뜨지 않으면 조용히 종료한다.
  - 런처는 한 번에 하나만 뜬다. 이미 켜져 있으면 바로가기 명령은 기존 런처가 처리한다.
  - 개발 실행(`npm start`)에서 만든 바로가기는 `electron.exe`와 프로젝트 폴더를 가리킨다. 배포용 바로가기는 설치본에서 만들어야 한다.
- **자동 업데이트 (F9):** 설치본은 시작할 때 GitHub Releases에서 새 버전을 확인한다(electron-updater). 개발 실행에서는 확인하지 않는다.
  - 새 버전이 있으면 하단에 "다운로드"가 나온다. 누를 때만 내려받는다.
  - 다 받으면 "설치"가 나오고, 누르면 확인 창에서 한 번 더 묻는다. 자동 다운로드와 종료 시 자동 설치는 꺼져 있다.
  - **배포 전 설정 필요:** `package.json`의 `build.publish`의 `owner`가 `CHANGE_ME_GITHUB_OWNER`라는 자리 표시값이다. 실제 GitHub 저장소로 바꾼 뒤 `release`의 `.exe`, `latest.yml`, `.blockmap`을 GitHub Release에 올려야 업데이트가 동작한다. 지금은 "업데이트 정보를 가져올 수 없음"으로 표시된다.
- **중복 실행 방지:** "클라이언트 실행 중"이거나 "게임 실행 중"이면 탭을 바꿔도 시작 버튼이 꺼진다. main 프로세스에서도 동시 호출과 대기 중 재실행을 한 번 더 막는다.
- **설정 손상 복구:** `settings.json`이나 `records.json`을 JSON으로 읽을 수 없으면 원본을 `.broken`으로 옮기고 기본값으로 다시 만든 뒤 화면에 알린다. 타입이 틀린 항목은 그 항목만 기본값으로 바꾼다.

## 외부 통신

사용자 정보(계정, 경로, 기록)는 어디에도 보내지 않는다. 런처가 직접 하는 요청은 다음 두 가지뿐이다.

| 요청 | 언제 | 보내는 것 |
| --- | --- | --- |
| Steam 뉴스 API (`api.steampowered.com`) | 시작 시, 30분마다 | 앱 ID(578080)만 |
| GitHub Releases (`build.publish`) | 설치본 시작 시, "다시 확인" 클릭 시 | 현재 버전 확인용 `latest.yml` 요청 |

나머지(Steam 실행, 카카오 사이트, 공지 링크)는 기본 브라우저나 Steam이 연다.

## 수동 테스트: 런처를 종료해도 게임이 계속 실행되는지

런처는 게임을 직접 띄우지 않고 Steam(또는 카카오 웹/스타터)에 맡긴다. 그래서 런처가 꺼져도 게임은 계속 실행되어야 한다(PRD 안정성 요구).

1. `npm start` 또는 설치본으로 런처를 켜고 Steam 탭에서 "게임 시작"을 누른다. 상태가 "게임 실행 중"이 될 때까지 기다린다.
2. 작업 관리자 "세부 정보" 탭에서 `TslGame.exe`가 있는지 확인한다.
3. 런처 창을 닫는다(X). 런처 프로세스(`PUBG 통합 런처 (비공식).exe` 또는 `electron.exe`)가 없어진 것을 확인한다.
4. 1분 이상 기다린 뒤 게임이 계속 플레이 가능하고 `TslGame.exe`가 남아 있는지 확인한다. 같은 확인을 강제 종료로도 한다: `taskkill /IM "PUBG 통합 런처 (비공식).exe" /F`.
5. 카카오 탭에서 웹으로 시작했을 때, 그리고 바탕화면 바로가기(창 없이 실행)로 시작했을 때도 1~4를 반복한다. 바로가기의 경우 3번은 작업 관리자에서 런처 프로세스를 끝내는 것으로 대신한다.
6. 다시 런처를 켜면 게임이 이미 떠 있으므로 "게임 실행 중"으로 표시되고, "게임 시작" 버튼은 꺼져 있어야 한다.

## 설정 파일

`%APPDATA%\pubg-unified-launcher\settings.json` 하나. 마지막 서버, 직접 고른 Steam 경로, 실행 방식(`launch`), 실행 옵션(`profile`), 공지 소스(`notices`)가 들어 있다. 플랫폼이 바뀌면 `launch`·`notices` 항목만 고치면 된다. 없는 항목은 기본값으로 채우므로 1단계 설정 파일도 그대로 쓸 수 있다.

플레이 기록은 같은 폴더의 `records.json`에 따로 저장된다. 매분 갱신되므로 설정과 분리했다.

```json
{
  "lastServer": "steam",
  "launch": {
    "steamAppId": "578080",
    "steamMethod": "url",
    "steamUrl": "steam://rungameid/{appId}",
    "steamUrlWithArgs": "steam://run/{appId}//{args}/",
    "kakaoUrl": "https://pubg.kakaogames.com/pubg/index.daum",
    "gameProcess": "TslGame.exe",
    "timeoutSec": 30
  },
  "profile": { "steamArgs": "", "beforeProgram": "", "afterProgram": "" },
  "notices": { "steamNewsApi": "https://api.steampowered.com/...", "steamNewsPage": "...", "kakaoNoticePage": "...", "kakaoUpdatePage": "...", "maintenanceHours": 48 }
}
```

`steamMethod`를 `"applaunch"`로 바꾸면 `steam.exe -applaunch {appId}`로 실행한다.

## 구조

```
src/main      시스템 기능 (Electron 메인, Steam 탐지, 실행 판정, 설정 저장·검증, 공지, 플레이 기록, 바로가기, 업데이트)
src/renderer  화면 (index.html, renderer.ts)
src/shared    공용 타입
docs          조사 문서(research.md), 구현 상태(status.md)
release       npm run dist 결과물 (git에 넣지 않음)
```
