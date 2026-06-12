require('dotenv').config();
const express  = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const path     = require('path');
const crypto   = require('crypto');

const app    = express();
const client = new Anthropic();

app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, 'public')));

/* ── Rate limiter (10 req / 60s per IP) ─────────────────────── */
const rateMap = new Map();
function rateLimit(req, res, next) {
  const ip  = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  let e = rateMap.get(ip);
  if (!e || now > e.resetAt) e = { count: 0, resetAt: now + 60_000 };
  e.count++;
  rateMap.set(ip, e);
  if (e.count > 10) return res.status(429).json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' });
  next();
}
setInterval(() => { const now = Date.now(); for (const [k,v] of rateMap) if (now > v.resetAt) rateMap.delete(k); }, 120_000).unref();

/* ── Input sanitiser ─────────────────────────────────────────── */
function clean(v, max = 5000) {
  if (typeof v !== 'string') return '';
  return v.replace(/[<>]/g, '').trim().slice(0, max);
}

/* ── Share store (24h TTL, in-memory) ───────────────────────── */
const shareStore = new Map();
setInterval(() => { const now = Date.now(); for (const [k,v] of shareStore) if (now > v.exp) shareStore.delete(k); }, 600_000).unref();

/* ── Prompts ─────────────────────────────────────────────────── */
const SYSTEM_PROMPT = `당신은 10년 이상 경력의 전문 자기소개서 첨삭 컨설턴트입니다. 취업 준비생의 자기소개서를 심층 분석하고 실질적인 개선 방향을 제공합니다.

아래 형식에 맞춰 한국어로 상세한 피드백을 제공하세요:

## 📊 종합 평가
현재 자기소개서의 전반적인 수준과 인상을 3~4문장으로 솔직하게 평가하세요.

## 🎯 점수
전체 완성도: **X점 / 100점**
- 내용의 구체성: X점 / 25점
- 문장 표현력: X점 / 25점
- 직무 적합성: X점 / 25점
- 차별화 포인트: X점 / 25점

## ✅ 잘된 점
구체적으로 어떤 부분이 좋은지 불릿으로 나열하세요.

## ⚠️ 개선이 필요한 부분
각 문제점에 대해 **왜 문제인지**와 **어떻게 고쳐야 하는지** 구체적으로 설명하세요. 단순 나열이 아닌 실질적인 조언을 제공하세요.

## ✍️ 첨삭된 자기소개서
원문의 구조를 유지하면서 더 임팩트 있고 설득력 있는 표현으로 완성된 자기소개서를 작성하세요. 수치, 구체적 사례, 성과 중심의 표현을 활용하세요.

---
중요: 실질적이고 구체적인 피드백을 제공하세요. 칭찬만 늘어놓지 말고 명확한 개선점을 지적하세요.`;

const REWRITE_PROMPT = `당신은 자기소개서 첨삭 전문가입니다. 주어진 문단을 더 임팩트 있고 설득력 있게 다시 작성해주세요. 수치, 구체적 사례, 성과 중심 표현을 활용하고 원문의 의미·사실관계를 유지하세요. 다시 작성된 문단만 출력하고 설명은 하지 마세요.`;

const INTERVIEW_PROMPT = `당신은 HR 전문가이자 자기소개서 컨설턴트입니다. 주어진 자기소개서를 분석하여 실제 면접에서 나올 가능성이 높은 질문 10개를 예측해주세요.

각 질문에 대해 다음 형식으로 작성하세요:

**질문 N: [질문 내용]**
- **왜 물어보는가:** 면접관의 의도
- **답변 전략:** 어떤 포인트를 강조해야 하는지

직무와 회사가 주어진 경우 그에 맞춰 조율하고, 자기소개서의 구체적인 내용을 바탕으로 맞춤형 질문을 만드세요.`;

const CLICHE_PROMPT = `당신은 한국어 자기소개서 전문가입니다. 주어진 자기소개서에서 진부하거나 식상한 표현을 찾아 분석해주세요.

다음 형식으로 작성하세요:

## 발견된 진부한 표현

각 표현에 대해:
**"[원문 표현]"**
- 문제점: 이 표현이 왜 진부한지 / 어떤 인상을 주는지
- 개선 제안: 더 구체적이고 차별화된 표현

진부한 표현이 없거나 적다면 솔직히 말하고, 전반적인 표현력을 평가해주세요.`;

const CHAT_SYSTEM_PROMPT = `당신은 자기소개서 첨삭 전문가 AI 어시스턴트입니다. 이미 분석을 완료한 자기소개서에 대해 사용자와 심층 대화를 나누고 있습니다.
분석 결과를 바탕으로 사용자의 질문에 구체적이고 실용적으로 답변해주세요.
한국어로 친근하지만 전문적으로 답변하세요.`;

const DIFFERENTIATE_PROMPT = `당신은 채용 전문가입니다. 수천 건의 자기소개서를 검토한 경험을 바탕으로, 주어진 자기소개서가 경쟁자들과 비교했을 때 얼마나 차별화되어 있는지 냉정하게 분석해주세요.

## 🏆 나만의 차별화 포인트
이 지원자만의 강점과 차별점을 구체적으로 서술하세요. 없다면 솔직히 말씀해주세요.

## 🚨 경쟁자와 겹치는 부분
비슷한 직무 지원자 대부분이 언급하는 평범한 표현이나 내용을 지적하세요.

## 💡 차별화 전략 3가지
이 지원자가 독보적인 인상을 줄 수 있는 구체적인 전략을 3가지 제안하세요. 추상적 조언이 아닌 이 자기소개서에 맞는 내용으로 작성하세요.

## 🎯 합격 경쟁력 평가
현재 차별화 수준을 바탕으로 합격 가능성을 솔직하게 평가하세요.`;

const SCORE_PREDICT_PROMPT = `당신은 자기소개서 평가 전문가입니다. 원본과 첨삭본 두 버전을 비교 평가해주세요.

다음 형식으로 작성하세요:

## 📊 점수 변화 분석

| 항목 | 원본 | 첨삭본 | 변화 |
|------|:----:|:------:|:----:|
| 내용의 구체성 (25점) | X점 | X점 | ±X |
| 문장 표현력 (25점) | X점 | X점 | ±X |
| 직무 적합성 (25점) | X점 | X점 | ±X |
| 차별화 포인트 (25점) | X점 | X점 | ±X |
| **전체 완성도** | **X점** | **X점** | **±X** |

## ✨ 주요 개선 포인트
첨삭을 통해 좋아진 부분 3~4가지를 설명하세요.

## 📌 추가 개선 여지
더 개선할 수 있는 부분 2~3가지를 제안하세요.`;

const STYLE_ADAPT_PROMPT = `당신은 자기소개서 스타일 전문가입니다. 주어진 자기소개서를 지정된 회사 문화에 맞게 재작성해주세요.
원문의 경험·사실관계는 유지하면서 어조와 표현 방식만 바꾸세요.

스타일 가이드:
- 대기업/공기업: 격식체, 조직 기여 강조, 성실·책임감 표현, 명확한 구조
- 스타트업: 능동적·도전적 어조, 성장·열정 강조, 수치와 임팩트, 유연한 표현
- 외국계 기업: 간결하고 직접적인 문장, 개인 성과 중심, 글로벌 마인드 표현
- IT 기업: 기술적 역량 명시, 문제 해결 프로세스, 데이터 기반 사고 강조

재작성된 자기소개서만 출력하고 설명은 추가하지 마세요.`;

/* ── SSE helper ──────────────────────────────────────────────── */
function sseHeaders(res) {
  res.setHeader('Content-Type',    'text/event-stream');
  res.setHeader('Cache-Control',   'no-cache');
  res.setHeader('Connection',      'keep-alive');
  res.setHeader('X-Accel-Buffering','no');
}

async function streamMessages(res, opts) {
  const stream = client.messages.stream(opts);
  for await (const ev of stream) {
    if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta')
      res.write(`data: ${JSON.stringify({ text: ev.delta.text })}\n\n`);
  }
  res.write('data: [DONE]\n\n');
  res.end();
}

/* ── POST /api/analyze ───────────────────────────────────────── */
app.post('/api/analyze', rateLimit, async (req, res) => {
  const text     = clean(req.body.text     || '');
  const jobTitle = clean(req.body.jobTitle || '', 200);
  const company  = clean(req.body.company  || '', 200);

  if (text.length < 50)
    return res.status(400).json({ error: '자기소개서 내용이 너무 짧습니다. 최소 50자 이상 입력해주세요.' });

  sseHeaders(res);

  let userMsg = '다음 자기소개서를 첨삭해주세요.\n\n';
  if (jobTitle) userMsg += `지원 직무: ${jobTitle}\n`;
  if (company)  userMsg += `지원 회사: ${company}\n`;
  userMsg += `\n[자기소개서 원문]\n${text}`;

  try {
    await streamMessages(res, {
      model:      'claude-sonnet-4-6',
      max_tokens: 4096,
      system:     [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages:   [{ role: 'user', content: userMsg }],
    });
  } catch (err) {
    const msg = err.status === 401
      ? 'API 키가 유효하지 않습니다.'
      : `오류가 발생했습니다: ${err.message}`;
    res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
    res.end();
  }
});

/* ── POST /api/rewrite (paragraph re-edit) ───────────────────── */
app.post('/api/rewrite', rateLimit, async (req, res) => {
  const paragraph = clean(req.body.paragraph || '');
  const jobTitle  = clean(req.body.jobTitle  || '', 200);
  const company   = clean(req.body.company   || '', 200);

  if (paragraph.length < 10)
    return res.status(400).json({ error: '내용이 너무 짧습니다.' });

  sseHeaders(res);

  let userMsg = '';
  if (jobTitle) userMsg += `지원 직무: ${jobTitle}\n`;
  if (company)  userMsg += `지원 회사: ${company}\n`;
  userMsg += `\n[재첨삭할 문단]\n${paragraph}`;

  try {
    await streamMessages(res, {
      model:      'claude-sonnet-4-6',
      max_tokens: 1024,
      system:     [{ type: 'text', text: REWRITE_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages:   [{ role: 'user', content: userMsg }],
    });
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

/* ── POST /api/share ─────────────────────────────────────────── */
app.post('/api/share', rateLimit, (req, res) => {
  const result   = clean(req.body.result   || '', 50000);
  const jobTitle = clean(req.body.jobTitle || '', 200);
  const company  = clean(req.body.company  || '', 200);
  const score    = Number(req.body.score)  || 0;

  if (!result) return res.status(400).json({ error: '결과가 없습니다.' });

  const id = crypto.randomBytes(6).toString('hex');
  shareStore.set(id, { result, jobTitle, company, score, exp: Date.now() + 86_400_000 });
  res.json({ id });
});

/* ── GET /api/share/:id ──────────────────────────────────────── */
app.get('/api/share/:id', (req, res) => {
  const entry = shareStore.get(req.params.id);
  if (!entry) return res.status(404).json({ error: '링크가 만료되었거나 존재하지 않습니다.' });
  res.json(entry);
});

/* ── POST /api/interview ─────────────────────────────────── */
app.post('/api/interview', rateLimit, async (req, res) => {
  const text     = clean(req.body.text     || '');
  const jobTitle = clean(req.body.jobTitle || '', 200);
  const company  = clean(req.body.company  || '', 200);

  if (text.length < 50)
    return res.status(400).json({ error: '자기소개서 내용이 너무 짧습니다.' });

  sseHeaders(res);

  let userMsg = '다음 자기소개서를 바탕으로 면접 질문을 예측해주세요.\n\n';
  if (jobTitle) userMsg += `지원 직무: ${jobTitle}\n`;
  if (company)  userMsg += `지원 회사: ${company}\n`;
  userMsg += `\n[자기소개서]\n${text}`;

  try {
    await streamMessages(res, {
      model:      'claude-sonnet-4-6',
      max_tokens: 2048,
      system:     [{ type: 'text', text: INTERVIEW_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages:   [{ role: 'user', content: userMsg }],
    });
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

/* ── POST /api/cliche ────────────────────────────────────── */
app.post('/api/cliche', rateLimit, async (req, res) => {
  const text = clean(req.body.text || '');

  if (text.length < 50)
    return res.status(400).json({ error: '자기소개서 내용이 너무 짧습니다.' });

  sseHeaders(res);

  try {
    await streamMessages(res, {
      model:      'claude-sonnet-4-6',
      max_tokens: 2048,
      system:     [{ type: 'text', text: CLICHE_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages:   [{ role: 'user', content: `[자기소개서]\n${text}` }],
    });
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

/* ── POST /api/chat ──────────────────────────────────────── */
app.post('/api/chat', rateLimit, async (req, res) => {
  const messages       = req.body.messages       || [];
  const analysisResult = clean(req.body.analysisResult || '', 20000);
  const jobTitle       = clean(req.body.jobTitle  || '', 200);
  const company        = clean(req.body.company   || '', 200);

  if (!messages.length)
    return res.status(400).json({ error: '메시지가 없습니다.' });

  sseHeaders(res);

  let systemText = CHAT_SYSTEM_PROMPT;
  if (jobTitle || company) systemText += `\n지원 직무: ${jobTitle || '-'} / 지원 회사: ${company || '-'}`;
  if (analysisResult)      systemText += `\n\n[이전 분석 결과]\n${analysisResult.slice(0, 8000)}`;

  const cleanedMessages = messages.slice(-12).map(m => ({
    role:    m.role === 'assistant' ? 'assistant' : 'user',
    content: clean(m.content || '', 5000),
  }));

  try {
    await streamMessages(res, {
      model:      'claude-sonnet-4-6',
      max_tokens: 1024,
      system:     systemText,
      messages:   cleanedMessages,
    });
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

/* ── POST /api/differentiate ─────────────────────────────── */
app.post('/api/differentiate', rateLimit, async (req, res) => {
  const text     = clean(req.body.text     || '');
  const jobTitle = clean(req.body.jobTitle || '', 200);
  const company  = clean(req.body.company  || '', 200);

  if (text.length < 50)
    return res.status(400).json({ error: '자기소개서 내용이 너무 짧습니다.' });

  sseHeaders(res);

  let userMsg = '다음 자기소개서의 경쟁력과 차별화 포인트를 분석해주세요.\n\n';
  if (jobTitle) userMsg += `지원 직무: ${jobTitle}\n`;
  if (company)  userMsg += `지원 회사: ${company}\n`;
  userMsg += `\n[자기소개서]\n${text}`;

  try {
    await streamMessages(res, {
      model:      'claude-sonnet-4-6',
      max_tokens: 2048,
      system:     [{ type: 'text', text: DIFFERENTIATE_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages:   [{ role: 'user', content: userMsg }],
    });
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

/* ── POST /api/score-predict ─────────────────────────────── */
app.post('/api/score-predict', rateLimit, async (req, res) => {
  const original = clean(req.body.original || '');
  const revised  = clean(req.body.revised  || '');
  const jobTitle = clean(req.body.jobTitle || '', 200);
  const company  = clean(req.body.company  || '', 200);

  if (original.length < 50 || revised.length < 50)
    return res.status(400).json({ error: '원본 또는 첨삭본 내용이 부족합니다.' });

  sseHeaders(res);

  let userMsg = '';
  if (jobTitle) userMsg += `지원 직무: ${jobTitle}\n`;
  if (company)  userMsg += `지원 회사: ${company}\n\n`;
  userMsg += `[원본]\n${original}\n\n[첨삭본]\n${revised}`;

  try {
    await streamMessages(res, {
      model:      'claude-sonnet-4-6',
      max_tokens: 2048,
      system:     [{ type: 'text', text: SCORE_PREDICT_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages:   [{ role: 'user', content: userMsg }],
    });
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

/* ── POST /api/style-adapt ───────────────────────────────── */
app.post('/api/style-adapt', rateLimit, async (req, res) => {
  const text     = clean(req.body.text     || '');
  const style    = clean(req.body.style    || '', 50);
  const jobTitle = clean(req.body.jobTitle || '', 200);
  const company  = clean(req.body.company  || '', 200);

  if (text.length < 50)
    return res.status(400).json({ error: '자기소개서 내용이 너무 짧습니다.' });

  sseHeaders(res);

  let userMsg = `[적용 스타일]: ${style}\n`;
  if (jobTitle) userMsg += `지원 직무: ${jobTitle}\n`;
  if (company)  userMsg += `지원 회사: ${company}\n`;
  userMsg += `\n[원본 자기소개서]\n${text}`;

  try {
    await streamMessages(res, {
      model:      'claude-sonnet-4-6',
      max_tokens: 3000,
      system:     [{ type: 'text', text: STYLE_ADAPT_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages:   [{ role: 'user', content: userMsg }],
    });
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

/* ── 실행 & 테스트용 export ──────────────────────────────────── */
// `node server.js`로 직접 실행할 때만 listen, 테스트에서 require할 땐 listen하지 않음
const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n✅ AI 자기소개서 첨삭 앱 실행 중`);
    console.log(`👉 http://localhost:${PORT}\n`);
  });
}

// 단위/통합 테스트(test/*.test.js)에서 사용
module.exports = { app, clean, rateLimit, shareStore };
