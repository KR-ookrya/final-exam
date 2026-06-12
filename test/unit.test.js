/**
 * 단위 테스트 (Unit Test)
 * 대상: server.js의 clean(), rateLimit(), shareStore
 * 실행: npm test  (node --test test/)
 * 프레임워크: Node.js 내장 테스트 러너(node:test) — 추가 의존성 0
 */
const { test, describe } = require('node:test');
const assert = require('node:assert');

// API 키가 없어도 require 가능하도록 더미 키 주입 (.env가 있으면 .env 값이 우선되지 않도록 먼저 설정)
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'sk-test-dummy';

const { clean, rateLimit, shareStore } = require('../server');

/* ── clean() — 입력 정제 함수 ─────────────────────────────────── */
describe('clean() 입력 정제', () => {
  test('XSS 위험 문자(< >)를 제거한다', () => {
    assert.strictEqual(clean('<script>alert(1)</script>안녕'), 'scriptalert(1)/script안녕');
    assert.ok(!clean('<img src=x>').includes('<'));
    assert.ok(!clean('<img src=x>').includes('>'));
  });

  test('최대 길이를 초과하면 잘라낸다 (기본 5,000자)', () => {
    const long = 'a'.repeat(6000);
    assert.strictEqual(clean(long).length, 5000);
    assert.strictEqual(clean(long, 100).length, 100);
  });

  test('문자열이 아닌 입력은 빈 문자열을 반환한다', () => {
    assert.strictEqual(clean(null), '');
    assert.strictEqual(clean(undefined), '');
    assert.strictEqual(clean(12345), '');
    assert.strictEqual(clean({ a: 1 }), '');
  });

  test('앞뒤 공백을 제거한다', () => {
    assert.strictEqual(clean('  안녕하세요  '), '안녕하세요');
  });
});

/* ── rateLimit() — IP당 10req/60s 제한 ────────────────────────── */
describe('rateLimit() 요청 제한', () => {
  // Express req/res 흉내내는 mock
  function mockReq(ip) { return { ip, socket: { remoteAddress: ip } }; }
  function mockRes() {
    const r = { statusCode: 200, body: null };
    r.status = (c) => { r.statusCode = c; return r; };
    r.json = (b) => { r.body = b; return r; };
    return r;
  }

  test('10번째 요청까지는 통과시킨다', () => {
    const ip = 'unit-test-ip-1';
    let passed = 0;
    for (let i = 0; i < 10; i++) {
      rateLimit(mockReq(ip), mockRes(), () => passed++);
    }
    assert.strictEqual(passed, 10);
  });

  test('11번째 요청은 429로 차단한다', () => {
    const ip = 'unit-test-ip-2';
    const last = mockRes();
    let blockedNext = false;
    for (let i = 0; i < 10; i++) rateLimit(mockReq(ip), mockRes(), () => {});
    rateLimit(mockReq(ip), last, () => { blockedNext = true; });

    assert.strictEqual(blockedNext, false, '11번째 요청에서 next()가 호출되면 안 됨');
    assert.strictEqual(last.statusCode, 429);
    assert.ok(last.body && last.body.error, '에러 메시지를 반환해야 함');
  });

  test('IP가 다르면 카운트가 분리된다', () => {
    let passed = false;
    for (let i = 0; i < 10; i++) rateLimit(mockReq('unit-test-ip-3'), mockRes(), () => {});
    rateLimit(mockReq('unit-test-ip-4'), mockRes(), () => { passed = true; });
    assert.strictEqual(passed, true, '다른 IP의 첫 요청은 통과해야 함');
  });
});

/* ── shareStore — 공유 결과 저장소 ────────────────────────────── */
describe('shareStore 공유 저장소', () => {
  test('저장한 항목을 동일 키로 조회할 수 있다', () => {
    shareStore.set('unit-key', { result: '테스트 결과', exp: Date.now() + 86_400_000 });
    const entry = shareStore.get('unit-key');
    assert.strictEqual(entry.result, '테스트 결과');
    shareStore.delete('unit-key');
  });

  test('만료 시각(exp)이 24시간 뒤로 설정된다', () => {
    const exp = Date.now() + 86_400_000;
    shareStore.set('unit-key-2', { result: 'x', exp });
    const diff = shareStore.get('unit-key-2').exp - Date.now();
    assert.ok(diff > 86_000_000 && diff <= 86_400_000, 'TTL이 약 24시간이어야 함');
    shareStore.delete('unit-key-2');
  });
});
