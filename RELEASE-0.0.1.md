# RoxMusic 0.0.1 (background-poc)

- 공식 제품명: RoxMusic. 공식 APK: `RoxMusic_버전.apk`.
- 실험 APK: `RoxMusic_background-poc_0.0.1.apk`.
- 앱 제목/설치 이름/웹 제목을 RoxMusic으로 통일. 버전 0.0.1, Android versionCode 2.
- 이전 PoC와 동일한 패키지/저장 키/서명을 유지하므로 데이터 보존 업데이트가 가능하도록 구성. 실제 기기 설치·업데이트는 미검증.
- 빌드 산출물은 package.json 버전/실험명을 참조. `npm run version:patch`로 다음 업데이트 버전과 Android versionCode를 함께 올림. 재빌드는 버전 유지.
- 파일명에 debug는 없으나 개발용 debug 서명 APK임. 정식 release 서명 배포는 별도 작업.
- 타입 검사/린트/APK 빌드·서명 확인 및 Mock 브라우저 회귀 6개 통과. 버전 증가 명령은 복사본에서 0.0.2 / versionCode 3 동기화 확인.
- 기존 백그라운드 PoC 동작 유지. YouTube 백그라운드 재생 제한을 우회하지 않음. 12개 실기기 시험은 여전히 미검증.
- 상세 기술 분석: [이전 PoC 보고서](BACKGROUND-POC-REPORT.md). 해당 보고서의 APK 이름·해시·UI 변경 없음 설명은 이전 배포 기준이며 이번 버전은 브랜딩과 버전 표시가 변경됨.
- APK SHA256: `298C86195D4075B43FB40FCFB966B8DF837F6B8CB6C4F1E58BBD57777C75334D`.

main 병합 없이 poc/background-playback 브랜치에서 사전 릴리스.
