# PUBG 통합 런처 (비공식)

배틀그라운드를 Steam / 카카오 중 골라 한 화면에서 시작하는 Windows용 런처. 1단계(F1~F4)와 2단계(F5~F7)까지 구현. 상세 요구사항은 [PRD.md](PRD.md), 실행 방식 조사 결과는 [docs/research.md](docs/research.md).

> 비공식 프로젝트입니다. KRAFTON, Valve, 카카오게임즈와 관련이 없습니다.

## 실행

Node.js 20 이상, Windows 10 이상.

```sh
npm install
npm start     # 빌드 후 Electron 실행
npm test      # 단위 테스트 (설치 감지, 설정 저장·검증, 플레이 시간, 공지 파싱)
```

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
src/main      시스템 기능 (Electron 메인, Steam 탐지, 설정 저장·검증, 공지, 플레이 기록)
src/renderer  화면 (index.html, renderer.ts)
src/shared    공용 타입
docs          조사 문서
```
