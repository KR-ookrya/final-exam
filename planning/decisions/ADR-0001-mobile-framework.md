# ADR-0001 — 프론트엔드 프레임워크 선택

## 배경

AI 자기소개서 첨삭 앱의 UI를 어떤 방식으로 구현할지 결정해야 했다.
사용자가 자기소개서를 입력하고, AI 첨삭 결과를 실시간으로 확인할 수 있는 인터페이스가 필요했다.

## 선택지

| 선택지 | 장점 | 단점 |
|---|---|---|
| **Vanilla HTML/CSS/JS** | 별도 빌드 없이 바로 서빙 가능, 학습 비용 없음 | 상태 관리 복잡해질 수 있음 |
| Flutter (Web) | 크로스플랫폼, 풍부한 UI 컴포넌트 | 빌드 복잡, SSE 연동 추가 작업 필요 |
| React / Vue | 컴포넌트 기반, 생태계 풍부 | 빌드 환경 설정 필요, 러닝커브 |

## 결정

**Vanilla HTML + CSS + JavaScript** (정적 파일, `/public` 폴더)

## 이유

- Express의 `express.static`으로 별도 빌드 없이 즉시 서빙 가능
- SSE 스트리밍 수신은 브라우저 기본 `EventSource` API로 충분히 처리 가능
- 프레임워크 없이도 이 앱의 기능(입력 → 스트리밍 출력)을 구현하기에 충분한 규모

## 결과

- 빌드 파이프라인 없이 `node server.js` 한 줄로 실행 가능
- `public/index.html`, `public/style.css`만으로 UI 완성
- SSE 응답을 `EventSource`로 수신해 실시간 렌더링 구현
