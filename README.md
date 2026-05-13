# 관계 CRM 클린 수정 배포파일

## 수정 내용
- 깨진 정규식/줄바꿈 문자열 오류 제거
- 엑셀 내보내기/가져오기 기능을 xlsx 라이브러리 기반으로 재작성
- 고객/가족 주민등록번호 전체 표시로 엑셀 내보내기
- 가족정보를 가족 1명당 1줄로 분리해서 내보내기
- 고객 삭제 기능 포함
- Netlify Functions 번들링 오류 방지를 위해 package.json에 @netlify/functions, web-push 포함

## 배포 전 필수
기존 앱에서 암호화 백업을 먼저 저장하세요.

## 업로드 방법
압축을 풀고 GitHub 저장소 루트에 있는 파일들과 교체한 뒤 Commit changes를 누르세요.


## Netlify Functions 추가 오류 수정
이번 버전은 Netlify Functions 번들링 오류를 해결하기 위해 package.json에 아래 의존성을 모두 포함했습니다.

- @netlify/functions
- @netlify/blobs
- web-push
- xlsx

GitHub 저장소에 기존 netlify/functions 폴더가 남아 있어도 배포 실패가 나지 않도록 보완한 버전입니다.
