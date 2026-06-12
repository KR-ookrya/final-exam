# Deploy — 빌드 & 배포 가이드

> 빌드(Build): 실행 가능한 산출물을 만드는 과정 · 배포(Deploy): 산출물을 운영 환경에 올려 서비스하는 과정

---

## 1. 빌드 (Build)

이 앱은 Vanilla JS 무빌드 구조로 **트랜스파일·번들링이 없습니다.**
빌드 단계는 의존성 설치가 전부입니다.

```bash
# ① 소스 획득 — 버전 태그 기준
git clone https://github.com/<your-username>/ai-cover-letter-editor.git
cd ai-cover-letter-editor

# ② 의존성 설치 = 빌드
npm ci          # package-lock.json 기준 재현 가능한 설치 (배포 환경 권장)
```

> 개발 환경에서는 `npm install`, 배포 환경에서는 `npm ci`를 권장합니다.
> `npm ci`는 lock 파일과 정확히 일치하는 버전만 설치해 "내 컴퓨터에선 되는데" 문제를 방지합니다.

---

## 2. 배포 (Deploy)

### ① 환경변수 주입

```bash
cp .env.example .env
```

| 변수 | 필수 | 설명 |
|------|:----:|------|
| `ANTHROPIC_API_KEY` | ✅ | Anthropic API 키 (`sk-ant-...`) |
| `PORT` | — | 서버 포트 (기본 3000) |

⚠️ `.env`는 `.gitignore` 대상입니다. **저장소에 절대 커밋하지 마세요.**

### ② 프로세스 기동

```bash
# 단순 실행
npm start                      # = node server.js

# 운영 권장: pm2로 상시 실행 + 비정상 종료 시 자동 재시작
npm install -g pm2
pm2 start server.js --name jasoseo-ai
pm2 save
```

### ③ 검증 (헬스 체크)

```bash
# 정적 페이지 응답 확인
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/        # → 200

# API 입력 검증 동작 확인 (50자 미만 → 400, 서버·라우팅 정상 의미)
curl -s -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" -d '{"text":"짧은 입력"}'        # → 400 JSON
```

---

## 3. 배포 전 체크리스트

- [ ] `npm test` 16/16 통과
- [ ] `.env`에 유효한 `ANTHROPIC_API_KEY` 설정
- [ ] `.env`가 `.gitignore`에 포함되어 있음
- [ ] `node -v` ≥ 20.x
- [ ] 헬스 체크 2종(위 ③) 통과

---

## 4. 클라우드 배포 시 참고 (Render / Railway 등)

| 설정 항목 | 값 |
|-----------|----|
| Build Command | `npm ci` |
| Start Command | `node server.js` |
| 환경변수 | 대시보드에서 `ANTHROPIC_API_KEY` 직접 입력 (.env 업로드 금지) |
| 포트 | 플랫폼이 주입하는 `PORT` 환경변수를 그대로 사용 (코드 대응 완료) |

---

## 5. 롤백

```bash
pm2 stop jasoseo-ai
git checkout <직전-안정-태그>
npm ci && pm2 restart jasoseo-ai
```

문제 발생 시 직전 태그로 되돌린 뒤 `npm test`와 헬스 체크로 정상 동작을 확인합니다.
