// test_phase12_13_14.js — Comprehensive test for Memory, Escalation, and Analytics
const http = require('http');

const BASE = 'http://localhost:3000';

function postRequest(path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const data = new URLSearchParams(body).toString();
    const options = {
      hostname: url.hostname, port: url.port,
      path: url.pathname + url.search, method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(data) }
    };
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getRequest(path) {
  return new Promise((resolve, reject) => {
    http.get(`${BASE}${path}`, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    }).on('error', reject);
  });
}

function extractSay(xml) {
  const match = xml.match(/<Say[^>]*>([\s\S]*?)<\/Say>/);
  return match ? match[1].replace(/&apos;/g, "'").replace(/&amp;/g, '&').trim() : '';
}

function extractAllSays(xml) {
  const matches = [...xml.matchAll(/<Say[^>]*>([\s\S]*?)<\/Say>/g)];
  return matches.map(m => m[1].replace(/&apos;/g, "'").replace(/&amp;/g, '&').trim());
}

function hasDial(xml) {
  return /<Dial/.test(xml);
}

async function runTests() {
  console.log('# Phase 12, 13, 14 — Test Report');
  console.log(`> **Date:** ${new Date().toISOString().split('T')[0]}\n`);

  let total = 0, passed = 0;
  function check(name, condition, detail) {
    total++;
    if (condition) { passed++; console.log(`✅ ${name}`); }
    else { console.log(`❌ ${name} — ${detail || 'failed'}`); }
  }

  // ══════════════════════════════════════════════════════════
  // PHASE 12 — MEMORY
  // ══════════════════════════════════════════════════════════
  console.log('\n## Phase 12 — Memory + Context\n');

  const memSid = `MEMORY_TEST_${Date.now()}`;

  // Simulate a multi-turn conversation
  const turns = [
    'I want to buy a saree for my sister',
    'She likes red color',
    'Her birthday is next week',
    'I want silk material',
    'Can you suggest something under 5000 rupees?',
    'What about a Kanchipuram saree?',
    'Do you have any with golden border?',
    'I also want gift wrapping'
  ];

  let lastResponse = '';
  for (let i = 0; i < turns.length; i++) {
    const xml = await postRequest(`/api/call/converse?lang=en-IN`, {
      CallSid: memSid, From: '+91test', SpeechResult: turns[i], Confidence: '0.95'
    });
    lastResponse = extractSay(xml);
    console.log(`  Turn ${i + 1}: "${turns[i].slice(0, 40)}..." → "${lastResponse.slice(0, 60)}..."`);
  }

  // After 8 turns, the AI should remember context from earlier
  const memoryTestXml = await postRequest(`/api/call/converse?lang=en-IN`, {
    CallSid: memSid, From: '+91test', SpeechResult: 'What color did I say earlier?', Confidence: '0.95'
  });
  const memoryResponse = extractSay(memoryTestXml);
  console.log(`  Memory test: "What color did I say earlier?" → "${memoryResponse}"`);
  check('Memory retains facts across turns', /red|colour|color/i.test(memoryResponse), `Got: ${memoryResponse.slice(0, 80)}`);

  // ══════════════════════════════════════════════════════════
  // PHASE 13 — ESCALATION
  // ══════════════════════════════════════════════════════════
  console.log('\n## Phase 13 — Escalation\n');

  // Test 1: User directly requests a human (English)
  const escSid1 = `ESC_HUMAN_${Date.now()}`;
  const escXml1 = await postRequest(`/api/call/converse?lang=en-IN`, {
    CallSid: escSid1, From: '+91test', SpeechResult: 'I want to talk to a real person', Confidence: '0.9'
  });
  const escSays1 = extractAllSays(escXml1);
  check('English: "talk to a real person" → escalation', hasDial(escXml1) || /connect|hold|person/i.test(escSays1.join(' ')),
    `Got: ${escSays1.join(' | ').slice(0, 80)}`);

  // Test 2: User requests human in Hindi
  const escSid2 = `ESC_HINDI_${Date.now()}`;
  const escXml2 = await postRequest(`/api/call/converse?lang=hi-IN`, {
    CallSid: escSid2, From: '+91test', SpeechResult: 'मुझे किसी इंसान से बात करनी है', Confidence: '0.9'
  });
  const escSays2 = extractAllSays(escXml2);
  check('Hindi: human request → escalation', hasDial(escXml2) || /प्रतीक्षा|जोड़|connect/i.test(escSays2.join(' ')),
    `Got: ${escSays2.join(' | ').slice(0, 80)}`);

  // Test 3: User requests human in Tamil
  const escSid3 = `ESC_TAMIL_${Date.now()}`;
  const escXml3 = await postRequest(`/api/call/converse?lang=ta-IN`, {
    CallSid: escSid3, From: '+91test', SpeechResult: 'ஒரு நபரிடம் பேச வேண்டும்', Confidence: '0.9'
  });
  const escSays3 = extractAllSays(escXml3);
  check('Tamil: human request → escalation', hasDial(escXml3) || /காத்திருங்கள்|இணைக்கிறேன்|connect/i.test(escSays3.join(' ')),
    `Got: ${escSays3.join(' | ').slice(0, 80)}`);

  // Test 4: Repeated confusion → escalation
  const escSid4 = `ESC_CONFUSION_${Date.now()}`;
  for (let i = 0; i < 5; i++) {
    await postRequest(`/api/call/converse?lang=en-IN`, {
      CallSid: escSid4, From: '+91test', SpeechResult: 'aaaa bbb ccc', Confidence: '0.35'
    });
  }
  const escXml4 = await postRequest(`/api/call/converse?lang=en-IN`, {
    CallSid: escSid4, From: '+91test', SpeechResult: 'still confused', Confidence: '0.35'
  });
  const confusionHandled = /connect|hold|sorry|trouble|again/i.test(extractSay(escXml4)) || hasDial(escXml4);
  check('Repeated confusion (5+) → escalation or graceful handling', confusionHandled);

  // Test 5: Normal conversation — should NOT escalate
  const escSid5 = `ESC_NORMAL_${Date.now()}`;
  const escXml5 = await postRequest(`/api/call/converse?lang=en-IN`, {
    CallSid: escSid5, From: '+91test', SpeechResult: 'What time is it?', Confidence: '0.9'
  });
  check('Normal conversation → no escalation', !hasDial(escXml5));

  // ══════════════════════════════════════════════════════════
  // PHASE 14 — ANALYTICS
  // ══════════════════════════════════════════════════════════
  console.log('\n## Phase 14 — Analytics\n');

  // Test analytics endpoint
  const metrics = await getRequest('/api/call/analytics');
  console.log('  Metrics snapshot:', JSON.stringify({
    totalTurns: metrics.totalTurns,
    escalations: metrics.escalations?.total,
    confidenceBuckets: metrics.confidenceBuckets,
    intentCount: Object.keys(metrics.intentDistribution || {}).length,
    emotionCount: Object.keys(metrics.emotionDistribution || {}).length
  }));

  check('Analytics endpoint returns data', metrics && typeof metrics.totalTurns === 'number');
  check('Analytics tracks turns', metrics.totalTurns > 0, `totalTurns=${metrics.totalTurns}`);
  check('Analytics tracks confidence buckets', metrics.confidenceBuckets && (metrics.confidenceBuckets.high > 0 || metrics.confidenceBuckets.low > 0));
  check('Analytics tracks intents', Object.keys(metrics.intentDistribution || {}).length > 0);
  check('Analytics tracks emotions', Object.keys(metrics.emotionDistribution || {}).length > 0);
  check('Analytics tracks escalations', typeof metrics.escalations?.total === 'number');
  check('Analytics has uptime', typeof metrics.uptimeSeconds === 'number' && metrics.uptimeSeconds > 0);
  check('Analytics has escalation rate', typeof metrics.escalationRate === 'string');

  // Test recent calls endpoint
  const recentCalls = await getRequest('/api/call/analytics/calls');
  check('Recent calls endpoint returns data', recentCalls && typeof recentCalls.count === 'number');

  // ══════════════════════════════════════════════════════════
  // SUMMARY
  // ══════════════════════════════════════════════════════════
  console.log(`\n---\n\n## 📊 Results: ${passed}/${total} passed\n`);

  if (passed === total) {
    console.log('🎉 All phases validated successfully!');
  } else {
    console.log(`⚠️ ${total - passed} test(s) need attention.`);
  }
}

runTests().catch(console.error);
