# 관계 CRM 최신 배포파일

## 업데이트 전 필수
앱에서 먼저 `암호화 백업`을 눌러 백업 파일을 저장하세요.

## 배포 방법
1. 이 zip 파일을 다운로드합니다.
2. 압축을 풉니다.
3. GitHub 저장소 `onyu-crm-pwa`에 들어갑니다.
4. `src/App.jsx`, `src/main.jsx`, `src/styles.css`, `index.html`, `package.json`, `netlify.toml`, `public/manifest.webmanifest`를 업로드/교체합니다.
5. Commit changes를 누릅니다.
6. Netlify가 자동 배포할 때까지 기다립니다.

## 고객 데이터 유지
같은 Netlify 사이트 주소를 계속 쓰면 기존 고객 데이터는 보통 유지됩니다.
고객 데이터는 서버가 아니라 각 기기 브라우저 localStorage에 암호화 저장됩니다.


## 이번 추가사항
- 고객 상세 화면에 `고객 삭제` 버튼 추가
- 삭제 전 확인창 표시
- 삭제 후 다음 고객 자동 선택
