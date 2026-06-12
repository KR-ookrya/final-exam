# 자소서 AI — AI 자기소개서 첨삭 서비스

> **취준생의 경험을 합격 가능한 언어로 바꿔주는 AI**
> Claude API 기반 자기소개서 첨삭·분석 웹 애플리케이션 (앱프로그래밍응용 기말 프로젝트)

![Node.js](https://img.shields.io/badge/Node.js-20.x+-339933) ![Express](https://img.shields.io/badge/Express-4.x-000000) ![Claude](https://img.shields.io/badge/Claude-opus--4--7-5b5ef4) ![Tests](https://img.shields.io/badge/tests-16%20passed-10b981)

<!-- 스크린샷: 메인 화면 캡처를 docs/images/main.png 로 추가 후 아래 주석 해제
![메인 화면](docs/images/main.png)
-->

---

## ✨ 주요 기능

| 기능 | 설명 |
|------|------|
| **실시간 AI 첨삭** | 자기소개서 입력 → SSE 스트리밍으로 분석이 실시간 출력 |
| **100점 채점** | 내용 구체성 · 문장 표현력 · 직무 적합성 · 차별화 4개 항목 평가 |
| **첨삭 완성본 생성** | 원문 구조를 유지한 개선 버전 제공 |
| **면접 질문 예측** | 자소서 기반 예상 면접 질문 10개 + 답변 전략 |
| **진부한 표현 감지** | 식상한 표현을 찾아 개선안 제시 |
| **경쟁자 차별화 분석** | 차별화 포인트·겹치는 부분·전략 3가지 |
| **첨삭 전후 점수 비교** | 원본 vs 첨삭본 항목별 점수 변화 |
| **회사 스타일 변환** | 지원 회사 톤에 맞춘 문체 변환 |
| **결과 공유 링크** | 24시간 유효한 공유 URL 생성 |
| **AI 후속 질의** | 분석 결과에 대해 채팅으로 추가 질문 |

---

## 🛠 기술 스택

```
Frontend : Vanilla HTML / CSS / JS   — 무빌드, 의존성 최소화
Backend  : Node.js 20 + Express 4    — 경량 서버, SSE 스트리밍
AI       : Anthropic SDK (claude-opus-4-7) — Prompt Caching 적용
Test     : Node.js 내장 테스트 러너 (node:test) — 추가 의존성 0
```

---

## 🚀 설치 및 실행 (Setup)

### 요구 사항

| 도구 | 버전 | 확인 |
|------|------|------|
| Node.js | 20.x 이상 | `node -v` |
| npm | 10.x 이상 | `npm -v` |

### 4단계 설치

```bash
# 1. 클론
git clone https://github.com/<your-username>/ai-cover-letter-editor.git
cd ai-cover-letter-editor

# 2. 의존성 설치
npm install

# 3. 환경변수 설정 — Anthropic API 키 입력
cp .env.example .env
# .env 파일을 열어 ANTHROPIC_API_KEY=sk-ant-... 입력

# 4. 실행
npm start
# → http://localhost:3000
```

> 상세 가이드: [docs/setup.md](docs/setup.md)

---

## 🧪 테스트 (Testing)

```bash
npm test    # 단위 9건 + 통합 7건 = 16건 (모두 통과)
```

- **단위 테스트**: 입력 정제(`clean`) · 레이트 리미터(`rateLimit`) · 공유 저장소(`shareStore`)
- **통합 테스트**: 실제 서버 기동 후 HTTP 검증 (입력 검증 400 / SSE 응답 / 공유 링크 / 429 차단)
- API 크레딧 소모 없이 실행 가능 (더미 키 주입 방식)

> 상세 결과: [docs/testing.md](docs/testing.md)

---

## 📦 빌드 & 배포 (Build & Deploy)

이 앱은 트랜스파일이 없는 **무빌드 구조**입니다. 빌드 = `npm install`이 전부이며,
배포는 환경변수 주입 → 프로세스 기동 → 헬스 체크 순서로 진행됩니다.

> 상세 절차: [docs/deploy.md](docs/deploy.md)

---

## 📂 프로젝트 구조 (Architecture)

```
ai-cover-letter-editor/
├── server.js              # 서버 진입점 (Express + API 라우트 9개 + SSE)
├── package.json
├── .env.example           # 환경변수 템플릿
├── public/                # 프레젠테이션 계층
│   ├── index.html         #   단일 페이지 UI
│   └── style.css
├── test/                  # 테스트
│   ├── unit.test.js       #   단위 테스트 (9 cases)
│   └── integration.test.js#   통합 테스트 (7 cases)
├── docs/                  # 운영 문서
│   ├── setup.md           #   개발 환경 설정
│   ├── deploy.md          #   빌드·배포 가이드
│   ├── testing.md         #   테스트 전략·결과
│   └── architecture.md    #   아키텍처 다이어그램
├── .planning/             # 기획 문서
│   ├── 00-vision.md       #   비전·목표 (기획서)
│   ├── 01-requirements.md #   요구사항 명세
│   ├── 02-wbs.md          #   WBS (작업 분류 체계)
│   ├── 03-schedule.md     #   일정 (6주 스프린트)
│   └── decisions/         #   ADR (아키텍처 의사결정 기록)
│       ├── ADR-0001-mobile-framework.md
│       ├── ADR-0002-state-management.md
│       └── ADR-0003-backend-choice.md
└── AGENTS.md              # AI Agent 활용 정책
```

---

## 📚 프로젝트 문서

| 문서 | 내용 |
|------|------|
| [기획서 (비전·목표)](.planning/00-vision.md) | 문제 정의 · 핵심 가치 · 성공 지표 |
| [요구사항 명세](.planning/01-requirements.md) | 기능·비기능 요구사항 |
| [WBS](.planning/02-wbs.md) | 작업 분류 체계 6대 분류 |
| [일정](.planning/03-schedule.md) | 6주 스프린트 (10~15주차) |
| [아키텍처](docs/architecture.md) | 시스템 구조 · 디렉터리 · 데이터 흐름 |
| [ADR](.planning/decisions/) | 의사결정 기록 3건 |
| [Setup](docs/setup.md) | 개발 환경 설정 |
| [Deploy](docs/deploy.md) | 빌드·배포 절차 |
| [Testing](docs/testing.md) | 단위·통합 테스트 결과 |
| [AGENTS.md](AGENTS.md) | AI Agent 활용 정책·규칙 |

---

## 🔒 보안 메모

- API 키는 `.env`로만 관리하며 저장소에 포함하지 않습니다 (`.gitignore` 처리).
- 모든 사용자 입력은 `clean()` 함수로 정제 (XSS 문자 제거 · 길이 제한).
- IP당 10req/60s 레이트 리미터로 남용을 방지합니다.

## 🗺 로드맵 (v2.0)

- [ ] 첨삭 이력 저장 & 버전 비교
- [ ] 채용 공고 URL 기반 맞춤 분석
- [ ] 항목별 분리 첨삭 모드
- [ ] 모바일 반응형 · 영문 자기소개서 지원
- [ ] GitHub Actions CI (push 시 자동 테스트)
