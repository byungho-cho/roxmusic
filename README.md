# Music Testbed 0.1.0

YouTube 영상 전체 또는 지정 구간을 목록에 저장하고 차례로 재생하는 개인용 Android 테스트베드입니다.

소스는 `D:\workspace\music-testbed`, 설치 파일은 `D:\workspace\music-testbed\artifacts\music-testbed-0.1.0-debug.apk`에 있습니다.

실제 Android 기기가 연결되지 않아 실기기 재생, Referer 수신, 광고, Premium, Android 공유·화면 꺼짐 동작은 미검증입니다. APK 빌드 성공과 휴대폰 재생 성공을 구분합니다.

## 설치와 첫 테스트

1. APK를 휴대폰으로 옮겨 실행하고 해당 파일 앱의 설치 허용을 선택합니다.
2. Music Testbed를 열고 오른쪽 위 ＋를 누릅니다.
3. 임베딩이 허용된 일반 YouTube 영상 URL과 제목을 입력합니다. 먼저 시작 `0:00`, 종료 공란으로 재생을 확인합니다.
4. 같은 영상을 `0:10~0:20`, `0:30~0:40` 두 항목으로 등록해 첫 항목을 누릅니다.
5. 지정 종료와 다음 구간 전환을 확인합니다. 플레이어의 최소 크기는 200×200 CSS px입니다.
6. YouTube 앱에서 공유 → Music Testbed를 선택해 앱을 닫은 상태와 열린 상태를 각각 시험합니다. 공유하면 등록창이 열립니다.

USB 디버깅을 사용할 때는 다음 명령으로 설치할 수 있습니다.

```powershell
adb devices
adb install -r D:\workspace\music-testbed\artifacts\music-testbed-0.1.0-debug.apk
```

Android 7.0 / API 24 이상을 대상으로 빌드했습니다. 지원 OS에서도 실제 재생 호환성은 기기와 Android System WebView 버전에 따라 확인해야 합니다.

## 사용 동작

- URL은 watch, youtu.be, shorts, embed 형식을 받습니다. Android 공유 텍스트에 제목이 섞여 있어도 URL을 찾습니다.
- 제목은 직접 입력합니다. 가수는 선택 사항입니다. 영상 파일이나 썸네일을 별도로 저장하지 않습니다.
- 시작·종료는 MM:SS 또는 HH:MM:SS입니다. 종료를 비우면 영상 끝까지 재생합니다.
- 재생 중 같은 영상의 등록창에서 ‘현재 시각’을 누르면 시작·종료 값을 채웁니다.
- 현재 항목을 편집하거나 삭제하면 재생을 종료합니다. 저장 후 항목을 눌러 다시 시작합니다.
- 이전·다음 버튼은 인접한 항목으로 이동합니다. 첫 항목의 이전과 마지막 항목의 다음은 비활성화됩니다.
- 마지막 항목이 끝나면 정지합니다. 다시 재생을 누르면 해당 구간부터 다시 시작합니다.
- 재생 오류에서는 사용자가 재시도·다음 이동·YouTube 열기를 선택합니다.
- 등록창을 열거나 앱을 벗어나면 일시정지합니다. 복귀 후 중앙 재생 버튼을 눌러 시작합니다.
- 목록 변경은 Preferences 저장이 성공한 뒤 화면에 반영합니다. 손상된 저장 데이터는 덮어쓰지 않습니다.
- 정상적인 영상 재생에는 인터넷이 필요합니다. 계정 로그인 UI와 Premium 계정 연동은 구현하지 않았습니다.

## 구간 재생의 현재 한계

공식 IFrame API의 `loadVideoById({ videoId, startSeconds, endSeconds })`를 사용합니다. 전체 영상에서는 `endSeconds`를 생략합니다.

YouTube의 원래 탐색 컨트롤을 사용하면 지정 종료 시각이 유지되지 않을 수 있습니다. 큰 재생 위치 변화가 관찰되면 안내와 ‘지정 구간 다시 시작’을 표시합니다. 이 위치 변화 감지는 진단용이며 광고 구간을 판별하는 기능이 아닙니다. 광고를 방해할 수 있는 타이머 기반 강제 곡 전환은 구현하지 않았습니다. 탐색 후 경계 보정은 실기기 검증을 거쳐 후속 개선할 항목입니다.

시작 위치는 키프레임에 영향을 받습니다. 정밀 절단이나 무중단 곡 전환을 보장하지 않습니다. 일반 녹화 영상으로 시험해 주세요. 라이브·진행 중인 프리미어 자동 판별은 구현하지 않았습니다.

‘YouTube에서 열기’는 공식 앱을 우선 사용하고 설치되지 않았다면 브라우저로 연결합니다. 외부 앱에서는 지정 구간 자동 종료와 목록 연속 전환이 보장되지 않습니다.

## 앱 식별과 오류 153

Android 패키지 ID는 `com.nurox.musictestbed`입니다. Capacitor의 로컬 HTTPS 호스트도 같은 ID로 설정해 문서 출처를 `https://com.nurox.musictestbed`로 맞췄습니다. 이 주소의 웹 파일은 기기 내 Capacitor가 제공합니다. 외부 웹 서버나 도메인 구매는 필요하지 않습니다.

`origin`, `widget_referrer`, `strict-origin-when-cross-origin`을 사용합니다. 공식 플레이어의 컨트롤과 광고를 유지합니다. 별도 계정 정보, 비밀번호, 쿠키를 수집하지 않습니다. 앱 하단 ‘테스트 안내 · 진단’에서 현재 출처와 최근 플레이어 오류 코드를 볼 수 있습니다.

실제 Android WebView가 YouTube에 전달하는 식별 정보와 오류 153 해소 여부는 아직 확인하지 못했습니다. 153이 발생하면 WebView 버전, 앱 출처, 오류 코드와 재생한 영상 ID를 함께 기록해 주세요.

## 개발·빌드

이 환경에서 사용한 도구는 Node 24.22.3, JDK 21.0.13.1, Android SDK Platform 36 / Build Tools 36.0.0, Gradle 8.14.3입니다. 앱 의존성은 package-lock.json에 고정했습니다. TypeScript는 ESLint 플러그인의 지원 범위에 맞춰 6.0.3을 사용합니다.

```powershell
cd D:\workspace\music-testbed
$env:JAVA_HOME = 'D:\devtools\jdk21\jdk-21.0.13.1+2'
$env:ANDROID_HOME = 'D:\devtools\android-sdk'

npm ci
npm run lint
npm test
npm run build
npx cap sync android
cd android
.\gradlew.bat assembleDebug
```

`android/local.properties`에는 개발 PC의 Android SDK 경로를 설정합니다.

```properties
sdk.dir=D:/devtools/android-sdk
```

이 Codex 환경처럼 npm 명령이 PATH에 없다면 `pnpm dlx npm@11.21.3 ci`, `pnpm dlx npm@11.21.3 run android:build`를 사용할 수 있습니다. JDK와 SDK 환경변수는 동일하게 필요합니다.

웹 개발 화면은 `npm run dev` 후 `http://127.0.0.1:5175`에서 열 수 있습니다. 웹 미리보기의 호스트는 Android와 다르므로 웹에서의 재생 결과가 Android 재생 결과를 대신하지 않습니다.

브라우저 회귀 검사는 YouTube 이벤트를 모의합니다.

```powershell
npx playwright install chromium --only-shell
npm run test:ui
```

## 코드 위치

- `src/domain.ts`에서 URL·시간·저장 스키마를 검사합니다.
- `src/storage.ts`에서 Preferences 쓰기를 순서대로 처리합니다.
- `src/queue.ts`에서 중복 종료와 이전 요청의 완료 처리를 차단합니다.
- `src/usePlayer.ts`에서 공식 플레이어 하나를 생성하고 재생·상태·오류·백그라운드 처리를 담당합니다.
- `android/app/src/main/java/com/nurox/musictestbed/ShareInboxPlugin.java`에서 공유 수신과 공식 YouTube 앱 열기를 처리합니다.

## 확인 결과

검사일은 2026-11-25입니다. 상세 항목과 수동 테스트 절차는 [TEST-RESULTS.md](TEST-RESULTS.md)에 있습니다.

- lint, 엄격한 TypeScript 검사, 웹 빌드 통과
- URL·시간·데이터 검증·큐 전환 단위 테스트 8개 통과
- 커버 370×465 / 휴대폰 412×892 브라우저 회귀 테스트 총 6개 통과
- Android debug APK 빌드 및 APK 서명 검증 통과
- 실기기 재생·공유 수신·Premium·광고·구간 정확도·전환 지연은 미검증

Premium 광고 제거가 필수 조건이라면 휴대폰에서 이를 먼저 판단한 뒤 후속 개발 범위를 정해야 합니다.

공식 참조 문서는 [IFrame Player API](https://developers.google.com/youtube/iframe_api_reference), [앱 식별·최소 기능](https://developers.google.com/youtube/terms/required-minimum-functionality), [개발자 정책 안내](https://developers.google.com/youtube/terms/developer-policies-guide), [Capacitor 설정](https://capacitorjs.com/docs/config)입니다.
