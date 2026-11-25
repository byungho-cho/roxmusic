# Android 백그라운드 재생 기술 검토 및 진단 PoC

작성일: 2026-11-25 (한국). 상태: 코드·문서 검토와 진단 APK 제작 완료, 실기기 검증 대기.

## 판정

현재 YouTube IFrame 기반 앱에서 화면을 끈 채 지정 구간과 자체 재생목록을 연속 재생하는 목표는 이번 제약 내에서 구현 대상으로 채택할 수 없다. YouTube 개발자 정책은 표시되지 않는 플레이어의 백그라운드 재생을 금지한다. Foreground Service를 붙이거나 WebView 중지 처리를 제거해 이 제한을 우회하지 않았다. 이는 정책 및 설계 판정이며 특정 기기의 실측 실패 판정이 아니다. [YouTube 개발자 정책](https://developers.google.com/youtube/terms/developer-policies), [정책 해설](https://developers.google.com/youtube/terms/developer-policies-guide)

공식 YouTube 앱 위임은 화면 OFF 감상을 위한 현실적인 대안이다. 다만 공식 앱의 계정·Premium·설정·콘텐츠 조건이 적용되며, 자체 구간 종료/다음 항목 제어를 이어받는 기능은 현재 위임 경로에 없다. Premium이 임베드 앱의 백그라운드 재생 권한으로 승계된다고 가정하지 않는다. [YouTube 백그라운드 재생 안내](https://support.google.com/youtube/answer/7437614?co=Platform%3DAndroid&hl=en)

## 보존 및 변경 범위

- 원본: `D:/workspace/music-testbed`, `main`, 기준 커밋 `c538d25`, 태그 `baseline/v0.1.0-before-background-poc`.
- PoC: `D:/workspace/music-testbed-background-poc`, 브랜치 `poc/background-playback`. 기준 브랜치에 병합하지 않았다.
- React + TypeScript + Capacitor 유지. `src/App.tsx`, `src/styles.css` 변경 없음. UI 컨트롤·레이아웃·디자인 변경 없음.
- 새 서버/API 키/라이브러리/미디어 서비스/깨우기 잠금 없음. 기존 재생목록·구간 처리·백그라운드 일시정지 유지.
- 병행 설치를 위해 앱 이름만 `Music Testbed PoC`, 패키지는 `com.nurox.musictestbed.backgroundpoc`로 분리. 원본 데이터는 보존되며 PoC 저장공간에 자동 복사되지 않는다. PoC에서는 테스트 목록을 별도로 등록한다.
- 원본 APK SHA256: `08C3373A476954638968CE277760D16EEEA816E29C894D68CA2EAB9581DD9F30` (변경 없음).

## 기존 동작과 중지 원인 분리

| 상황 | 코드상 경로 | 확인할 증거와 판정 한계 |
|---|---|---|
| 홈/다른 앱 | `usePlayer.ts`의 appStateChange inactive 또는 visibility hidden → suspend → pauseVideo | `web_app_state`, `web_visibility`, `web_suspend`와 `web_player_state=2`를 비교. 앱 자체 중지 경로가 존재하는 것은 코드로 확인됨. 기기별 발생 순서는 미검증 |
| Activity 정지 | MainActivity.onStop → custom suspend 이벤트 → WebView.onPause | `activity_stop`, `webview_pause_requested`, `web_suspend(reason=native_stop)`. JS 전달은 비동기이므로 모든 이벤트 수신을 보장하지 않음 |
| 잠금/화면 OFF | 화면 이벤트와 Activity 전환, 위 일시정지 경로 가능 | `screen_off`, screenInteractive, Activity/JS 로그를 비교. 화면 OFF만으로 Doze 또는 프로세스 종료를 단정하지 않음 |
| WebView 비활성화 | onStop에서 onPause, onStart에서 onResume 호출 | onPause는 JS 타이머를 직접 중지하는 API가 아니다. 기존 명시적 pauseVideo 호출과 구분해야 함 |
| 절전/Doze | CPU·네트워크 제한 가능 | powerSaveMode/deviceIdleMode와 시간 간격을 확인. 현재 기기 실측이 없어 실제 중단 원인으로 확정하지 않음 |
| 네트워크 단절 | offline → suspend + 오류 표시 | `web_offline`, reason=offline. 복구 이벤트는 기록만 하며 자동 재생하지 않음 |
| 임베드 오류/자동재생 차단 | IFrame error / onAutoplayBlocked | `web_player_error`의 playerState 필드는 오류 코드, `web_autoplay_blocked`. 단순 로그 공백과 구분 |

복귀 시 onResume은 재생 명령이 아니다. 앱은 사용자 재생 조작을 기다린다. suspended/hidden 상태의 PLAYING 이벤트는 다시 pause 처리하고 다음 곡 자동 전환도 차단한다. 따라서 현 구현의 백그라운드 중지를 OS 절전 문제 하나로 설명할 수 없다.

WebView의 onPause는 최선 노력 방식으로 처리하며 JS 실행 중지는 별도 pauseTimers에 해당한다. 이번 PoC는 pauseTimers를 추가하지 않았다. [Android WebView API](https://developer.android.com/reference/android/webkit/WebView#onPause())

Doze는 장시간 미사용 시 CPU·네트워크 작업을 제한한다. 화면 OFF 직후의 앱 일시정지와 구분해서 조사해야 한다. 절전 예외 강제 적용이나 사용자 설정 변경은 하지 않는다. [Android Doze 문서](https://developer.android.com/training/monitoring-device-state/doze-standby)

## 네이티브 기술 및 대안 검토

| 방식 | 기술 검토 | 이번 PoC 적용/제약 |
|---|---|---|
| Foreground Service | Android의 허용된 미디어 재생 서비스에 적용 가능. mediaPlayback 서비스 유형·권한과 시작 제한 준수 필요 | YouTube IFrame의 콘텐츠 사용 조건을 바꾸지 못하므로 추가하지 않음. 서비스만 추가해 WebView 연속 재생을 보장할 수도 없음 |
| MediaSession / Media3 | 재생 엔진을 Service에 두고 시스템 미디어 제어와 연결하는 공식 구조 | 권한을 보유한 파일/스트림에는 차후 적용 가능. IFrame은 Media3 Player가 아니며 현재 앱에는 전달 가능한 허가된 오디오 소스가 없음 |
| Capacitor 네이티브 플러그인 | JS↔Android 생명주기·진단 정보 연결 가능 | 자체 진단 플러그인 구현 및 APK 컴파일 확인. 기기에서 이벤트 수신은 미검증 |
| Activity/WebView 관리 | 상태 기록·복귀 동기화에 사용 가능 | 기존 pause/onResume 유지. 숨김 플레이어 유지, 사용자 에이전트 위장 등 우회 구현 없음 |
| 공식 YouTube 앱 위임 | 기존 ACTION_VIEW + 공식 앱 package 우선, 미설치 시 브라우저 fallback | 기존 경로에 결과 로그만 추가. video ID와 시작 시각 전달. 종료 시각·자체 큐·외부 재생 상태 콜백 없음. 외부 앱의 잠금 화면 제어는 해당 앱 소관 |
| 비공식 라이브러리/추출 방식 | 웹 응답·비공개 형식에 의존하는 접근은 상위 변경, 차단, 인증 변경에 따른 유지보수 부담이 있음. 특정 라이브러리의 현 버전 호환성은 검증하지 않음 | 다운로드/음성 분리/비공식 스트림 취득 및 제한 우회는 채택하지 않음. 콘텐츠별 저작권·이용 허락과 서비스 약관을 별도로 충족해야 하며 개인용이라는 이유만으로 허용을 단정하지 않음 |
| 별도 네이티브 재생 모듈 | 사용자가 재생 권한을 가진 로컬 파일 또는 허가된 직접 스트림을 Media3로 재생하는 방향은 타당 | 새 콘텐츠 소스 및 재생 엔진 개발 범위가 필요. 이번 YouTube PoC에서 구현·실측하지 않음 |

Android 공식 권장 구조는 Player와 MediaSession을 MediaSessionService에 배치하는 방식이다. 이는 자체 미디어의 백그라운드 및 시스템 제어에 적합하다. [MediaSessionService](https://developer.android.com/media/media3/session/background-playback), [mediaPlayback 서비스 유형과 제한](https://developer.android.com/develop/background-work/services/fgs/service-types#media)

| 최종 사용 목표 | 현재 IFrame PoC | 공식 앱 위임 | 허가된 미디어 + 네이티브 엔진 |
|---|---|---|---|
| 화면 OFF/다른 앱 중 감상 | 미지원, 숨김 시 일시정지 | 계정·설정 조건부, 실기기 미검증 | 구현 후보, 미구현 |
| 지정 구간만 재생 | 전경에서 기존 기능 유지; seek 관련 기존 한계 유지 | 시작 전달만, 종료 제어 미지원 | 구현 후보 |
| 자체 목록 자동 연속 재생 | 전경에서 기존 큐 유지 | 자체 목록 연동 미지원 | 구현 후보 |
| 잠금 화면/알림 제어 | 신규 구현 없음 | 공식 앱의 기능에 따름 | MediaSession 구현 후보 |

## 구현한 진단

- JS: 준비/로드/상태/오류/자동재생 차단/visibility/pagehide/appState/offline/online/suspend 및 15초 간격 상태 표본.
- Android: Activity create/start/resume/pause/stop/destroy, 화면 OFF/잠금 해제, WebView pause 요청, 공식 앱/외부 핸들러 위임 요청 결과 (startActivity 성공은 실제 재생 성공을 뜻하지 않음).
- 각 네이티브 레코드: 벽시계와 부팅 후 시간, PID, SDK, 화면 상태, 절전/idle 상태, 배터리 잔량·온도·충전 상태. 플러그인 준비 시 모델/WebView 버전.
- 내부 `files/background-poc.jsonl` 최대 약 256KB 후 새 기록부터 다시 시작. 장기 조사 전·후 수집 필요. JS 메모리는 최근 100개. 로그 실패가 재생을 중단시키지 않도록 처리.
- 진단 파일에는 영상 ID/제목/계정/쿠키를 추가하지 않음. 재생 위치·기기 정보는 포함하므로 공유 전 확인 필요. 기존 화면 진단에는 원래 영상 ID 표시가 존재함.
- 로그는 종료를 방지하지 않는다. 프로세스 강제 종료 시 destroy가 호출되지 않을 수 있으며 로그 공백만으로 OS kill/Doze/YouTube 원인을 확정할 수 없다.

## 검증 결과

자동 검증은 실제 YouTube 재생이나 Android 기기 동작의 증명이 아니다. 브라우저 테스트는 Mock IFrame Player를 사용한다.

- ESLint 및 TypeScript 검사: 통과.
- 단위 테스트: 9개 통과 (기존 8개 + 진단 버퍼 제한/복사 격리).
- Playwright: 6개 통과 (두 화면 크기). 등록/보존/순서/삭제, 동일 영상 구간 전환, 중복 ENDED 방지, 단일 플레이어, 중지 후 재생 차단, 오류 복구 및 진단 이벤트 확인.
- Android debug APK 생성 및 v2 서명 검증 통과. minSdk 24 / targetSdk 36. 추가 미디어 서비스·FGS 권한 없음.
- adb devices: 연결 기기 없음. 아래 항목은 전부 실기기 미검증.

| 번호 | 실기기 항목 | 실제 결과 | 예상/확인할 제한 |
|---|---|---|---|
| 01 | 일반 화면 정상 재생 | 미검증 | Mock만 통과; 실제 영상/광고/네트워크 별도 확인 |
| 02 | 홈 버튼 후 유지 | 미검증 | 임베드는 의도적으로 일시정지, 공식 앱 경로 별도 |
| 03 | 다른 앱 사용 중 유지 | 미검증 | 위와 동일 |
| 04 | 화면 잠금 후 유지 | 미검증 | 정책상 임베드 유지 구현 없음 |
| 05 | 화면 OFF 30분 이상 | 미검증 | 공식 앱 위임 경로에서 시간·계정·설정 기록 필요 |
| 06 | 백그라운드 지정 구간 종료 | 미검증 | 임베드 미지원, 외부 앱 종료 시각 전달 없음 |
| 07 | 백그라운드 다음 곡 | 미검증 | 숨김 상태 자체 큐 전환 차단 |
| 08 | 서로 다른 영상 자동 전환 | 미검증 | 전경 실제 영상으로 추가 확인 필요 |
| 09 | 복귀 시 상태 동기화 | 미검증 | Mock 중지 상태 확인; 실제 Activity 재생성/외부 앱 상태는 별도 |
| 10 | Premium 혜택 | 미검증 | 로그인·구독 검사 구현 없음; 임베드 승계 가정 금지 |
| 11 | 배터리·발열 | 미검증 | 측정값 없음; 로그 오버헤드 포함 측정 필요 |
| 12 | 기존 기능 정상 동작 | 미검증 | 자동 회귀만 통과, 실제 공유 인텐트/저장/구간/광고 별도 |

실기기 성공/실패 수는 모두 0이다. 정책상 미지원과 실측 실패를 혼동하지 않는다.

## 실기기 검증 절차

1. APK를 설치한다. 원본과 별도 아이콘으로 설치된다. Android 버전, 제조사/모델, WebView 버전, 전원·절전 설정, 네트워크, 테스트 영상, Premium 여부를 기록한다.
2. PoC에 같은 영상의 두 구간과 서로 다른 영상 2개를 등록한다. 전경에서 시작/종료/반복 시도/다음 곡/마지막 곡/저장 후 재실행을 확인한다. seek가 종료 구간에 미치는 기존 경고도 확인한다.
3. 전경 재생 후 홈 → 복귀, 다른 앱 → 복귀, 잠금 → 해제, 화면 OFF → 복귀를 각각 분리 수행한다. 시각과 실제 소리 지속 여부를 기록한다. 임베드 경로의 일시정지는 예상 동작이며 우회하지 않는다.
4. 기존 'YouTube에서 열기'로 공식 앱에 위임한다. 공식 앱 로그인·Premium·백그라운드 설정을 확인하고 02~05 및 잠금 화면 제어를 따로 테스트한다. 브라우저 fallback은 공식 앱 성공으로 기록하지 않는다.
5. 30분 시험은 케이블을 분리하고 일정한 볼륨·네트워크·주변 온도·배터리 범위로 수행한다. 시작/끝 시각, 배터리 %, 온도, 충전 여부, 중단 시각과 소리를 수동 기록한다. 가능하면 동일 조건 3회 측정한다. 앱 실행 중 로그는 참고치이며 외부 앱 위임 후 계속 샘플링하지 않으므로 전체 전력 측정치로 취급하지 않는다.
6. 시험 전·후 USB 연결 및 디버깅 승인 후 `powershell -File scripts/collect-background.ps1`로 로그를 수집한다. 여러 기기는 `-Serial` 지정. 이 스크립트는 조회만 수행하며 기기 설정을 바꾸지 않는다. 디버그 앱이 설치·실행되어야 run-as가 가능하다.
7. 로그 이벤트 순서와 실제 소리·기기 화면 기록을 함께 대조해 앱 pause, WebView 전환, 네트워크 오류, 시스템 자원 제한을 분류한다. 불명확하면 원인 미확정으로 남긴다. 사용자 앱 강제 종료/메모리 회수는 추가 시험으로 분리한다.
8. 번호별 실제 결과·조건·로그 경로를 이 보고서에 추가한다. 사용자 확인 전 기준 브랜치로 병합하지 않는다.

## 전달 파일 및 재현

- APK: `artifacts/music-testbed-background-poc.1-debug.apk` (4,235,987 bytes).
- versionName: `0.1.0-background-poc.1`.
- SHA256: `54962210FA30376B60B87B1F514A3F85225B6D05F2B4940F843AD246817D63C5`.
- 소스: PoC 브랜치 전체. `src/backgroundDiagnostics.ts`, `src/usePlayer.ts`, Android 진단 플러그인/Activity/위임 로그, `scripts/collect-background.ps1`, 테스트 변경.
- `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:ui`, `npm run android:build`. Playwright 브라우저와 JDK21/Android SDK36 설치 필요. SDK 경로는 ignored `android/local.properties` 또는 ANDROID_HOME 사용.
- 현재 개발 PC에서는 의존성을 원본 node_modules junction으로 재사용했다. 별도 PC에서는 npm ci로 설치한다. Capacitor가 생성하는 Gradle 경로는 소스의 상대 node_modules 경로를 유지했다.

정식 반영 여부는 실기기 결과와 사용자 확인 후 결정한다. 현재 산출물은 백그라운드 재생 성공 APK가 아니라 원인 분리용 진단 APK이다.


