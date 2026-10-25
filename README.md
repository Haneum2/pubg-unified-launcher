# PUBG 통합 런처 (비공식)

배틀그라운드를 Steam / 카카오 중 골라 한 화면에서 시작하는 Windows용 런처의 MVP(F1~F4). 상세 요구사항은 [PRD.md](PRD.md), 실행 방식 조사 결과는 [docs/research.md](docs/research.md).

> 비공식 프로젝트입니다. KRAFTON, Valve, 카카오게임즈와 관련이 없습니다.

## 실행

Node.js 20 이상, Windows 10 이상.

```sh
npm install
npm start     # 빌드 후 Electron 실행
npm test      # 단위 테스트 (설치 감지, 설정 저장)
```

## 동작

| 탭 | "게임 시작"을 누르면 | 상태 표시 |
| --- | --- | --- |
| Steam | 탐지한 Steam으로 `steam://rungameid/578080`을 연다 | 클라이언트 실행 중 → `TslGame.exe`가 뜨면 게임 실행 중, 30초 안에 안 뜨면 실패 + 원인 한 줄 |
| 카카오 | 기본 브라우저로 카카오 PUBG 공식 사이트를 연다. 로그인·게임 시작은 웹에서 직접 | 웹사이트를 열었음 → `TslGame.exe`가 뜨면 게임 실행 중 |

- Steam 탐지 순서: 직접 고른 폴더 → 레지스트리(`HKCU\Software\Valve\Steam\SteamPath`, `HKLM\...\InstallPath`) → `C:\Program Files (x86)\Steam`. PUBG 설치 여부는 `steamapps\libraryfolders.vdf`로 확인. 모두 읽기 전용.
- Steam을 못 찾으면 시작 버튼이 꺼지고 설치 안내와 "Steam 폴더 선택"이 나온다.
- 게임 프로세스는 `tasklist` 결과(프로세스 목록)만 본다. 게임 메모리·파일은 건드리지 않고, 계정 정보는 저장하지 않는다.

## 설정 파일

`%APPDATA%\pubg-unified-launcher\settings.json` 하나. 마지막 서버, 직접 고른 Steam 경로, 실행 방식이 들어 있다. 플랫폼이 바뀌면 `launch` 항목만 고치면 된다(없는 항목은 기본값).

```json
{
  "lastServer": "steam",
  "launch": {
    "steamAppId": "578080",
    "steamMethod": "url",
    "steamUrl": "steam://rungameid/{appId}",
    "kakaoUrl": "https://pubg.kakaogames.com/pubg/index.daum",
    "gameProcess": "TslGame.exe",
    "timeoutSec": 30
  }
}
```

`steamMethod`를 `"applaunch"`로 바꾸면 `steam.exe -applaunch {appId}`로 실행한다.

## 구조

```
src/main      시스템 기능 (Electron 메인, Steam 탐지, 설정 저장, 프로세스 확인)
src/renderer  화면 (index.html, renderer.ts)
src/shared    공용 타입
docs          조사 문서
```
