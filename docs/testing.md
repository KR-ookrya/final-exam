# Testing — AI 자기소개서 첨삭 앱

> 단위 테스트(Unit Test)와 통합 테스트(Integration Test) 전략 및 결과
> 실행일: 2026-06-12 · 환경: Node.js 22.x · 프레임워크: Node.js 내장 테스트 러너(`node:test`)

---

## 1. 테스트 전략

| 구분 | 대상 | 방식 |
|------|------|------|
| **단위 테스트** | `clean()` 입력 정제, `rateLimit()` 요청 제한, `shareStore` 저장소 | 함수를 직접 import 하여 mock req/res로 격리 검증 |
| **통합 테스트** | Express 앱 전체 (라우팅 + 미들웨어 + 응답 형식) | 실제 서버를 임시 포트(`listen(0)`)에 띄우고 `fetch`로 HTTP 요청 |

**설계 원칙**

- **의존성 0** — Jest/Mocha 대신 Node.js 내장 `node:test` 사용. 프로젝트의 "no over-engineering" 원칙 유지.
- **API 크레딧 소모 0** — 통합 테스트는 더미 API 키를 주입해 실제 Anthropic API를 호출하지 않음. 인증 실패 시 서버가 SSE 에러 이벤트로 안전하게 응답하는 **에러 처리 경로까지 함께 검증**됨.
- **테스트 가능 구조** — `server.js`는 직접 실행 시에만 `listen`하고(`require.main === module`), 테스트에서는 `{ app, clean, rateLimit, shareStore }`를 export.

---

## 2. 실행 방법

```bash
npm test        # = node --test
```

---

## 3. 단위 테스트 결과 (9 cases)

### clean() — 입력 정제

| 케이스 | 기대 | 결과 |
|--------|------|:----:|
| `<script>` 등 XSS 위험 문자 입력 | `<` `>` 제거 | ✅ PASS |
| 6,000자 입력 (기본 한도 5,000자) | 5,000자로 절단 | ✅ PASS |
| `null` / `undefined` / 숫자 / 객체 입력 | 빈 문자열 반환 | ✅ PASS |
| 앞뒤 공백 포함 입력 | trim 처리 | ✅ PASS |

### rateLimit() — IP당 10req/60s

| 케이스 | 기대 | 결과 |
|--------|------|:----:|
| 동일 IP 1~10번째 요청 | 모두 통과 (`next()` 호출) | ✅ PASS |
| 동일 IP 11번째 요청 | **429** + 에러 메시지, `next()` 미호출 | ✅ PASS |
| 다른 IP의 요청 | 카운트 분리되어 통과 | ✅ PASS |

### shareStore — 공유 저장소

| 케이스 | 기대 | 결과 |
|--------|------|:----:|
| 저장 후 동일 키 조회 | 원본 데이터 복원 | ✅ PASS |
| TTL 설정 | 만료 시각이 약 24시간 뒤 | ✅ PASS |

---

## 4. 통합 테스트 결과 (7 cases)

| 시나리오 | 기대 | 결과 |
|----------|------|:----:|
| `GET /` | 200 + index.html 서빙 | ✅ PASS |
| `POST /api/analyze` — 50자 미만 | 400 + 한국어 안내("최소 50자") | ✅ PASS |
| `POST /api/analyze` — 정상 입력 | 200 + `text/event-stream` 헤더 + SSE `data:` 이벤트 | ✅ PASS |
| `POST /api/share` → `GET /api/share/:id` | 12자리 id 발급 → 결과·점수 복원 | ✅ PASS |
| `POST /api/share` — 결과 없음 | 400 | ✅ PASS |
| `GET /api/share/존재하지않는id` | 404 + 만료 안내 | ✅ PASS |
| `/api/share` 연속 12회 요청 | 한도 초과분 **429** 차단 | ✅ PASS |

---

## 5. 종합 결과

```
# tests 16
# pass  16
# fail  0
```

**단위 9건 + 통합 7건 = 총 16건 전체 통과 (PASS 16 / FAIL 0)**

---

## 6. 테스트로 발견·예방한 것

1. `server.js`가 require만 해도 서버가 떠버리는 구조 → `require.main` 가드 추가로 테스트 가능 구조 확보
2. 내부 `setInterval` 2개가 프로세스 종료를 막는 문제 → `.unref()` 적용 (운영 동작 영향 없음)
3. 잘못된 API 키 상황에서도 서버가 죽지 않고 SSE 에러 이벤트로 응답함을 확인 (장애 격리)

---

## 7. 향후 개선 (v2.0)

- GitHub Actions로 push 시 `npm test` 자동 실행 (CI)
- 만료된 공유 링크가 GC 주기(10분) 전에는 조회되는 케이스 → 조회 시점 만료 검사 추가
- SSE 스트림 내용 단언 강화 (mock Anthropic 클라이언트 주입)
