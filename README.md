# 관계 CRM PWA - 푸시 알림 포함 최종 배포 버전

## 핵심 기능
- 고객 데이터 비밀번호 기반 암호화 저장
- 5분 미사용 시 자동 잠금
- 암호화 백업/복원
- 고객/가족 주민등록번호 마스킹 표시
- 주민등록번호 기준 나이 자동 계산
- 가족 전화번호 관리
- 문자/통화/상담/소개요청/기타 연락 기록
- 연락 기록 날짜 + 현재 시간 자동 저장
- 연락 기록 5개씩 페이지 처리
- 관계 점수 빡빡한 기준 적용
- PWA 홈화면 설치
- 휴대폰 푸시 알림

## 중요한 알림 구조
이 버전의 푸시 알림은 개인정보 보호형입니다.

고객 데이터는 각 기기 안에 암호화되어 저장되기 때문에 서버가 고객 이름과 다음 연락일을 알 수 없습니다.
그래서 푸시 알림은 매일 오전 9시에 아래처럼 일반 알림으로 옵니다.

> 오늘 연락 대상 확인  
> 고객관리 앱에서 오늘 연락할 고객을 확인해 주세요.

고객 이름은 앱을 열고 암호를 입력한 뒤 확인합니다.

## 배포 방법
이 버전은 Netlify Functions와 Scheduled Functions가 들어있습니다.
정적 파일 드래그 앤 드롭만으로는 푸시 알림 서버 기능이 제대로 작동하지 않을 수 있습니다.

추천 순서:
1. 이 폴더를 GitHub 저장소에 업로드
2. Netlify에서 해당 GitHub 저장소 연결
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Functions directory: `netlify/functions`

## VAPID 키 설정

로컬 PC에서 Node.js가 가능하다면 아래 명령으로 키를 만듭니다.

```bash
npm install
npm run vapid
```

출력되는 Public Key, Private Key를 Netlify 환경변수에 넣습니다.

Netlify > Site configuration > Environment variables:

- `VITE_VAPID_PUBLIC_KEY` = Public Key
- `VAPID_PUBLIC_KEY` = Public Key
- `VAPID_PRIVATE_KEY` = Private Key
- `VAPID_SUBJECT` = mailto:본인메일주소

예:
- `VAPID_SUBJECT` = mailto:jkwon0219@gmail.com

환경변수 설정 후 반드시 다시 배포해야 합니다.

## 아이폰에서 푸시 알림 쓰는 법
1. iPhone Safari에서 배포된 사이트 열기
2. 공유 버튼 누르기
3. 홈 화면에 추가
4. 홈화면 아이콘으로 앱 실행
5. 앱 안에서 푸시 알림 켜기
6. iOS 알림 권한 허용
7. 테스트 푸시 버튼으로 확인

## 안드로이드에서 푸시 알림 쓰는 법
1. Chrome에서 배포된 사이트 열기
2. 메뉴 > 홈 화면에 추가 또는 앱 설치
3. 앱 실행
4. 푸시 알림 켜기
5. 테스트 푸시 확인

## 기존 고객 데이터 주의
같은 Netlify 주소에 다시 배포하면 기존 브라우저 저장 데이터는 유지될 가능성이 높습니다.
하지만 실제 고객 데이터를 넣기 전후에는 반드시 암호화 백업을 해두세요.
