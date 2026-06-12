/**
 * 통합 테스트 (Integration Test)
 * 대상: Express 앱 전체 — 라우팅 + 미들웨어 + 응답 형식
 * 실행: npm test  (node --test test/)
 *
 * 주의: 실제 Anthropic API를 호출하지 않도록 더미 API 키를 주입한다.
 *       → AI 호출은 즉시 인증 오류가 나고, 서버가 이를 SSE 에러 이벤트로
 *         처리하는지(= 에러 처리 경로)까지 함께 검증된다. 크레딧 소모 0.
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');

// 반드시 server.js require 전에 설정 — dotenv는 이미 있는 환경변수를 덮어쓰지 않음
process.env.ANTHROPIC_API_KEY = 'sk-test-invalid-key-for-integration';

const { app } = require('../server');

let server, base;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {            // 0번 포트 = 비어있는 포트 자동 할당
      base = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(() => server.close());

describe('통합: 정적 파일 서빙', () => {
  test('GET / → 200, index.html을 반환한다', async () => {
    const res = await fetch(`${base}/`);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('자기소개서'), '메인 페이지 HTML이 서빙되어야 함');
  });
});

describe('통합: POST /api/analyze 입력 검증', () => {
  test('50자 미만 입력 → 400 + 한국어 안내 메시지', async () => {
    const res = await fetch(`${base}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '너무 짧은 자소서' }),
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.ok(body.error.includes('50자'), '최소 길이 안내가 포함되어야 함');
  });

  test('정상 입력 → SSE(text/event-stream) 응답 + 스트림 종료까지 처리', async () => {
    const res = await fetch(`${base}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '가'.repeat(60), jobTitle: '백엔드 개발자' }),
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.headers.get('content-type').includes('text/event-stream'),
      'SSE 헤더가 설정되어야 함');
    const body = await res.text();   // 더미 키 → 인증 실패 → 에러 이벤트 후 정상 종료
    assert.ok(body.includes('data:'), 'SSE data 이벤트 형식으로 응답해야 함');
  });
});

describe('통합: 공유 링크 생성/조회', () => {
  test('POST /api/share → id 발급 → GET /api/share/:id 로 복원', async () => {
    const post = await fetch(`${base}/api/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ result: '첨삭 결과 본문', jobTitle: '기획자', score: 82 }),
    });
    assert.strictEqual(post.status, 200);
    const { id } = await post.json();
    assert.ok(id && id.length === 12, '12자리 hex id가 발급되어야 함');

    const get = await fetch(`${base}/api/share/${id}`);
    assert.strictEqual(get.status, 200);
    const entry = await get.json();
    assert.strictEqual(entry.result, '첨삭 결과 본문');
    assert.strictEqual(entry.score, 82);
  });

  test('결과 없이 요청 → 400', async () => {
    const res = await fetch(`${base}/api/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.strictEqual(res.status, 400);
  });

  test('존재하지 않는 id → 404 + 만료 안내', async () => {
    const res = await fetch(`${base}/api/share/000000000000`);
    assert.strictEqual(res.status, 404);
    const body = await res.json();
    assert.ok(body.error.includes('만료'), '만료/미존재 안내 메시지를 반환해야 함');
  });
});

describe('통합: 레이트 리미터 (10req/60s)', () => {
  test('연속 요청 시 한도 초과분은 429로 차단된다', async () => {
    let got429 = false;
    for (let i = 0; i < 12; i++) {
      const res = await fetch(`${base}/api/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result: `rate-limit-test-${i}` }),
      });
      if (res.status === 429) { got429 = true; break; }
    }
    assert.strictEqual(got429, true, '한도를 넘긴 요청은 429가 반환되어야 함');
  });
});
