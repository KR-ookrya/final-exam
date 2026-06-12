# ADR-0003 — 백엔드 및 AI 연동 방식 선택

## 배경

AI 첨삭 기능을 서버에서 처리하고, 결과를 클라이언트에 전달하는 방식이 필요했다.
어떤 백엔드 프레임워크와 AI 연동 방식을 쓸지 결정해야 했다.

## 선택지

### 백엔드 프레임워크

| 선택지 | 설명 |
|---|---|
| **Node.js + Express** | 경량, JS 생태계, SSE 구현 용이 |
| FastAPI (Python) | AI/ML 친화적, 타입 안전 |
| Next.js API Routes | 프론트-백 통합, Vercel 배포 용이 |

### AI 모델

| 선택지 | 설명 |
|---|---|
| **Claude Opus (claude-opus-4-7)** | 최고 품질 첨삭, prompt caching 지원 |
| Claude Sonnet / Haiku | 빠르고 저렴하나 품질 낮음 |
| GPT-4o | OpenAI 모델, SSE 지원 |

### 응답 방식

| 선택지 | 설명 |
|---|---|
| **SSE 스트리밍** | 실시간 출력, 사용자 대기 없음 |
| REST (일반 JSON) | 구현 단순하나 긴 응답 시 대기 발생 |

## 결정

**Node.js + Express + Claude Opus + SSE 스트리밍 + Prompt Caching**

## 이유

- 자기소개서 첨삭은 응답이 길어 (최대 4096 토큰) SSE가 UX에 필수
- Claude Opus는 첨삭 품질이 가장 높고, `cache_control: ephemeral`로 System Prompt를 캐싱해 반복 비용 절감
- Express는 SSE 구현이 `res.write()`만으로 가능해 별도 라이브러리 불필요
- Rate Limiter(IP당 10회/분)와 Input Sanitiser를 직접 구현해 보안 강화

## 결과

- `/api/analyze` — 전체 첨삭 (SSE 스트리밍)
- `/api/rewrite` — 문단 재첨삭 (SSE 스트리밍)
- `/api/share` — 결과 공유 링크 생성 (24시간 TTL, 인메모리)
- Prompt Caching으로 동일 System Prompt 반복 호출 비용 절감
