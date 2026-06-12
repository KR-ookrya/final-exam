# AGENTS.md — AI Agent 활용 정책

> 이 파일은 본 프로젝트에서 작업하는 **모든 AI Agent(Claude Code, Copilot 등)와 개발자**가 따라야 할
> 단일 정책 파일입니다. 별도의 rules / skills / commands 파일 없이 **이 문서 하나로 통합 관리**합니다.

---

## 1. 프로젝트 개요 (Agent가 알아야 할 컨텍스트)

- **무엇**: Claude API 기반 AI 자기소개서 첨삭 웹앱
- **스택**: Node.js 20 + Express 4 + Vanilla JS (무빌드) + Anthropic SDK
- **철학**: No over-engineering · Streaming first · Korean-native
- **진입점**: `server.js` 단일 파일 (라우트 9개 + 미들웨어 + 프롬프트 상수)

## 2. 명령어 (Commands)

```bash
npm install     # 의존성 설치
npm start       # 서버 실행 (http://localhost:3000)
npm test        # 단위 + 통합 테스트 (node --test)
```

## 3. 코드 규칙 (Rules)

Agent가 코드를 생성·수정할 때 반드시 지킬 것:

1. **의존성 추가 금지가 기본값** — 새 패키지가 꼭 필요하면 ADR로 근거를 먼저 남긴다.
2. **모든 신규 API 라우트는 기존 패턴을 따른다**: `rateLimit` 미들웨어 → `clean()` 입력 정제 → 길이 검증 → `sseHeaders()` + `streamMessages()` 호출.
3. **시스템 프롬프트는 `server.js` 상단 상수 구역에만** 추가한다. 라우트 내부에 인라인 작성 금지.
4. **비밀값은 `.env`로만** — 코드·문서·커밋에 API 키를 절대 포함하지 않는다.
5. **사용자 노출 메시지는 한국어**로 작성한다 (에러 메시지 포함).
6. **테스트 동반 원칙** — 검증 로직·미들웨어를 수정하면 `test/`에 대응 케이스를 추가하고 `npm test` 통과를 확인한다.
7. `server.js`의 export 블록(`module.exports = { app, clean, rateLimit, shareStore }`)과
   `require.main === module` 가드는 테스트 인프라이므로 **삭제 금지**.

## 4. 문서 규칙 (Docs)

| 변경 유형 | 함께 갱신할 문서 |
|-----------|------------------|
| 아키텍처·구조 변경 | `docs/architecture.md` |
| 중요 기술 의사결정 | `.planning/decisions/ADR-XXXX-*.md` 신규 작성 |
| 설치·환경 변경 | `docs/setup.md`, `README.md` |
| 배포 절차 변경 | `docs/deploy.md` |
| 테스트 추가·변경 | `docs/testing.md` |
| 작업 범위 변경 | `.planning/02-wbs.md` 상태 갱신 |

ADR 형식: **배경 → 선택지(표) → 결정 → 이유 → 결과** 5단 구성을 유지한다.

## 5. AI Agent 활용 이력 (본 프로젝트에서의 실제 활용)

본 프로젝트는 다음 작업에 AI Agent를 적극 활용했다:

- **기획 문서 생성**: 기획서(비전·요구사항) · WBS · 일정 초안을 Agent와 협업으로 작성 후 직접 검수
- **발표 자료**: 배점 기준을 입력으로 발표 슬라이드(HTML)·5분 대본을 생성하고 직접 다듬음
- **테스트 작성**: 단위·통합 테스트 16건을 Agent로 생성, 실제 실행으로 16/16 통과 검증
- **코드 리뷰**: 시행착오(SSE 전환, 레이트 리미터, 입력 정제) 해결 과정에서 Agent와 페어 프로그래밍

## 6. 나만의 기법 — 단일 MD 통합 관리

agent 규칙 / skills / commands / 프로젝트 정책을 여러 파일로 흩어 관리하지 않고
**AGENTS.md 하나로 통합**한다. 이유:

- 단일 파일이므로 어떤 Agent를 쓰든 컨텍스트 주입이 한 번에 끝남
- 규칙·명령어·문서 맵이 한 화면에 있어 사람도 온보딩이 빠름
- 프로젝트의 "no over-engineering" 철학과 일치

## 7. 금지 사항 (Do NOT)

- `node_modules` 직접 수정
- `public/` 외부에서 DOM 관련 코드 작성
- 프롬프트에 사용자 미정제 입력 직결 (`clean()` 우회 금지)
- 테스트 없이 검증·보안 로직 변경
- 실제 API 키로 테스트 실행 (테스트는 더미 키 주입 방식 유지)
