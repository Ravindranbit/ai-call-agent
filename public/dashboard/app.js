// ══════════════════════════════════════════════════════════════
// 1092 Helpline — Dashboard App
// Real-time analytics with PostgreSQL-backed data
// ══════════════════════════════════════════════════════════════

const COLORS = ['#818cf8', '#60a5fa', '#22d3ee', '#34d399', '#fbbf24', '#f87171', '#c084fc', '#fb923c'];
const LANG_NAMES = { 'en-IN': 'English', 'hi-IN': 'Hindi', 'ta-IN': 'Tamil', 'kn-IN': 'Kannada' };
const EMOTION_COLORS = {
  neutral: '#818cf8', happy: '#34d399', distress: '#fbbf24',
  high_distress: '#f87171', angry: '#f87171', confused: '#c084fc',
  fear: '#fb923c', urgency: '#ef4444'
};
const CONFIDENCE_COLORS = { low: '#f87171', medium: '#fbbf24', high: '#34d399' };

const ICONS = {
  inbox: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>',
  target: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
  alertTriangle: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  checkCircle: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  xCircle: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
  info: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
};

let currentTab = 'overview';
let autoRefreshTimer = null;

async function fetchJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

async function loadAll() {
  try {
    const [stats, memMetrics, events, calls] = await Promise.all([
      fetchJSON('/api/dashboard/stats'),
      fetchJSON('/api/call/analytics'),
      fetchJSON('/api/dashboard/events'),
      fetchJSON(`/api/dashboard/calls?limit=${document.getElementById('callLimit')?.value || 50}`)
    ]);
    setDbStatus('connected');
    renderOverview(stats, memMetrics);
    renderEventStats(events);
    renderCalls(calls.calls || []);
    renderIntents(stats);
    renderEscalations(stats, calls.calls || []);
    document.getElementById('lastUpdated').textContent = `Updated ${new Date().toLocaleTimeString()}`;
  } catch (err) {
    console.error('Dashboard load error:', err);
    setDbStatus('error');
    try {
      const memMetrics = await fetchJSON('/api/call/analytics');
      renderOverviewFromMemory(memMetrics);
      document.getElementById('lastUpdated').textContent = `In-memory only · ${new Date().toLocaleTimeString()}`;
    } catch (_) {}
  }
}

// ── OVERVIEW ──
function renderOverview(stats, memMetrics) {
  const t = stats?.totals || {};
  document.getElementById('totalCalls').textContent = t.total_calls || memMetrics.totalCalls || 0;
  document.getElementById('avgTurns').textContent = Number(t.avg_turns || memMetrics.avgTurnsPerCall || 0).toFixed(1);
  document.getElementById('activeCalls').textContent = memMetrics.activeCalls || 0;
  const totalCalls = Number(t.total_calls || memMetrics.totalCalls || 1);
  const escalated = Number(t.escalated_calls || memMetrics.escalations?.total || 0);
  document.getElementById('escalationRate').textContent = (totalCalls > 0 ? ((escalated / totalCalls) * 100).toFixed(1) : '0') + '%';

  renderDonut('langChart', (stats?.languageDistribution || []).map(r => ({ label: LANG_NAMES[r.language_code] || r.language_code, value: Number(r.count) })), COLORS);
  renderDonut('emotionChart', (stats?.emotionDistribution || []).map(r => ({ label: capitalize(r.primary_emotion), value: Number(r.count) })), Object.values(EMOTION_COLORS));
  const conf = memMetrics.confidenceBuckets || {};
  renderDonut('confidenceChart', [
    { label: 'High (>0.7)', value: conf.high || 0 },
    { label: 'Medium', value: conf.medium || 0 },
    { label: 'Low (<0.4)', value: conf.low || 0 }
  ], [CONFIDENCE_COLORS.high, CONFIDENCE_COLORS.medium, CONFIDENCE_COLORS.low]);
}

function renderOverviewFromMemory(m) {
  document.getElementById('totalCalls').textContent = m.totalCalls || 0;
  document.getElementById('avgTurns').textContent = m.avgTurnsPerCall || 0;
  document.getElementById('activeCalls').textContent = m.activeCalls || 0;
  document.getElementById('escalationRate').textContent = m.escalationRate || '0%';
  renderDonut('langChart', Object.entries(m.languageDistribution || {}).map(([k, v]) => ({ label: LANG_NAMES[k] || k, value: v })), COLORS);
  renderDonut('emotionChart', Object.entries(m.emotionDistribution || {}).map(([k, v]) => ({ label: capitalize(k), value: v })), Object.values(EMOTION_COLORS));
  const conf = m.confidenceBuckets || {};
  renderDonut('confidenceChart', [
    { label: 'High', value: conf.high || 0 }, { label: 'Medium', value: conf.medium || 0 }, { label: 'Low', value: conf.low || 0 }
  ], [CONFIDENCE_COLORS.high, CONFIDENCE_COLORS.medium, CONFIDENCE_COLORS.low]);
}

// ── DONUT ──
function renderDonut(containerId, data, colors) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) { container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">${ICONS.inbox}</div><div class="empty-state-text">No data yet</div></div>`; return; }
  let gradient = '', cumulative = 0;
  data.forEach((d, i) => { const pct = (d.value / total) * 100; gradient += `${colors[i % colors.length]} ${cumulative}% ${cumulative + pct}%${i < data.length - 1 ? ',' : ''}`; cumulative += pct; });
  const legendItems = data.map((d, i) => `<div class="legend-item"><span class="legend-dot" style="background:${colors[i % colors.length]}"></span><span class="legend-label">${d.label}</span><span class="legend-value">${d.value}</span></div>`).join('');
  container.innerHTML = `<div class="donut-chart"><div class="donut-visual" style="background: conic-gradient(${gradient});"><div class="donut-center">${total}</div></div><div class="donut-legend">${legendItems}</div></div>`;
}

// ── EVENT STATS ──
function renderEventStats(events) {
  const container = document.getElementById('eventStats');
  if (!container) return;
  if (!events || events.length === 0) { container.innerHTML = `<div class="empty-state"><div class="empty-state-text">No events recorded</div></div>`; return; }
  container.innerHTML = events.map(e => `<div class="event-stat-item"><span class="event-stat-name">${formatEventName(e.event_type)}</span><span class="event-stat-count">${e.count}</span></div>`).join('');
}

// ── CALL HISTORY (with dialect + urgency columns) ──
function renderCalls(calls) {
  const tbody = document.getElementById('callsBody');
  if (!tbody) return;
  if (!calls || calls.length === 0) { tbody.innerHTML = `<tr><td colspan="10"><div class="empty-state"><div class="empty-state-icon">${ICONS.inbox}</div><div class="empty-state-text">No calls recorded yet</div></div></td></tr>`; return; }
  tbody.innerHTML = calls.map(c => {
    const lang = LANG_NAMES[c.language_code] || c.language_code || '—';
    const dialect = c.dialect && c.dialect !== 'standard' ? `<span class="badge badge-purple">${capitalize(c.dialect)}</span>` : '—';
    const escBadge = c.escalated ? `<span class="badge badge-red">${ICONS.xCircle} Yes</span>` : `<span class="badge badge-green">${ICONS.checkCircle} No</span>`;
    const urgentBadge = c.is_urgent ? `<span class="badge badge-red">⚡ Yes</span>` : '—';
    const emotionBadge = c.primary_emotion ? `<span class="badge badge-${getEmotionBadgeClass(c.primary_emotion)}">${capitalize(c.primary_emotion)}</span>` : '—';
    const started = c.started_at ? new Date(c.started_at).toLocaleString() : '—';
    return `<tr onclick="showCallDetail('${c.call_sid}')">
      <td><code style="font-size:11px;color:var(--text-muted)">…${(c.call_sid || '').slice(-12)}</code></td>
      <td>${c.from_number || '—'}</td><td>${lang}</td><td>${dialect}</td>
      <td>${c.primary_intent || '—'}</td><td>${emotionBadge}</td><td>${c.turns || 0}</td>
      <td>${urgentBadge}</td><td>${escBadge}</td>
      <td style="font-size:11.5px;color:var(--text-muted)">${started}</td></tr>`;
  }).join('');
}

// ── CALL DETAIL MODAL ──
async function showCallDetail(callSid) {
  const modal = document.getElementById('callModal');
  const body = document.getElementById('modalBody');
  modal.classList.add('open');
  body.innerHTML = '<p style="color:var(--text-muted)">Loading events…</p>';
  try {
    const [eventsRes, callsRes, transcriptRes] = await Promise.all([
      fetchJSON(`/api/dashboard/calls/${callSid}/events`),
      fetchJSON(`/api/dashboard/calls?limit=200`),
      fetchJSON(`/api/dashboard/calls/${callSid}/transcript`).catch(() => ({ transcript: [] }))
    ]);
    const call = (callsRes.calls || []).find(c => c.call_sid === callSid) || {};
    const events = eventsRes.events || [];
    const transcript = transcriptRes.transcript || [];

    // Build transcript chat bubbles
    let transcriptHtml = '';
    if (transcript.length > 0) {
      const bubbles = transcript.map(t => {
        const isUser = t.speaker === 'user';
        const icon = isUser ? '👤' : '🤖';
        const bgClass = isUser ? 'transcript-user' : 'transcript-ai';
        const confStr = t.confidence ? ` <span style="opacity:0.5;font-size:11px">(${(t.confidence * 100).toFixed(0)}%)</span>` : '';
        const metaStr = t.intent && isUser ? ` <span style="opacity:0.5;font-size:11px">[${t.intent}${t.emotion ? ', ' + t.emotion : ''}]</span>` : '';
        return `<div class="transcript-bubble ${bgClass}">
          <span class="transcript-icon">${icon}</span>
          <div class="transcript-content">${t.text || '—'}${confStr}${metaStr}</div>
        </div>`;
      }).join('');
      transcriptHtml = `<div class="detail-label" style="margin:18px 0 10px">Transcript · ${transcript.length} messages</div>
        <div class="transcript-container">${bubbles}</div>`;
    }

    body.innerHTML = `
      <div class="detail-grid">
        <div class="detail-item"><div class="detail-label">Call SID</div><div class="detail-value"><code style="font-size:12px">${callSid}</code></div></div>
        <div class="detail-item"><div class="detail-label">From</div><div class="detail-value">${call.from_number || '—'}</div></div>
        <div class="detail-item"><div class="detail-label">Language</div><div class="detail-value">${LANG_NAMES[call.language_code] || call.language_code || '—'}</div></div>
        <div class="detail-item"><div class="detail-label">Dialect</div><div class="detail-value">${capitalize(call.dialect || 'standard')}</div></div>
        <div class="detail-item"><div class="detail-label">Intent</div><div class="detail-value">${call.primary_intent || '—'}</div></div>
        <div class="detail-item"><div class="detail-label">Emotion</div><div class="detail-value">${capitalize(call.primary_emotion || '—')}</div></div>
        <div class="detail-item"><div class="detail-label">Urgent</div><div class="detail-value">${call.is_urgent ? '<span style="color:var(--red)">⚡ Yes</span>' : 'No'}</div></div>
        <div class="detail-item"><div class="detail-label">Escalated</div><div class="detail-value">${call.escalated ? '<span style="color:var(--red)">Yes</span>' : '<span style="color:var(--green)">No</span>'}</div></div>
      </div>
      ${call.conversation_summary ? `<div style="margin-bottom:18px"><div class="detail-label">Conversation Summary</div><div class="detail-value" style="font-weight:450;font-size:13px;margin-top:4px;color:var(--text-secondary);line-height:1.5">${call.conversation_summary}</div></div>` : ''}
      ${transcriptHtml}
      <div class="detail-label" style="margin-bottom:10px;margin-top:18px">Event Timeline · ${events.length} events</div>
      <div class="events-timeline">${events.map(e => `<div class="timeline-event"><span class="timeline-type">${formatEventName(e.event_type)}</span><span class="timeline-time">${new Date(e.created_at).toLocaleTimeString()}</span></div>`).join('')}${events.length === 0 ? '<div class="empty-state-text">No events recorded</div>' : ''}</div>
      
      <div class="feedback-container" style="margin-top: 24px; padding: 16px; background: rgba(96, 165, 250, 0.05); border: 1px solid rgba(96, 165, 250, 0.2); border-radius: 8px;">
        <div class="detail-label" style="color: var(--blue); margin-bottom: 8px;">Agent Feedback (Auto-saving)</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
          <div>
            <label style="font-size:11px; color:var(--text-muted); margin-bottom:4px; display:block;">Accuracy</label>
            <select id="fbAccuracy_${callSid}" onchange="submitAgentFeedback('${callSid}', '${call.primary_intent || ''}')" style="width: 100%; padding: 8px; border-radius: 4px; background: var(--bg-elevated); border: 1px solid var(--border); color: var(--text);">
              <option value="correct">✅ Completely Correct</option>
              <option value="partially_correct">⚠️ Partially Correct</option>
              <option value="incorrect">❌ Incorrect</option>
            </select>
          </div>
          <div>
            <label style="font-size:11px; color:var(--text-muted); margin-bottom:4px; display:block;">Correct Intent (if wrong)</label>
            <input type="text" id="fbIntent_${callSid}" value="${call.primary_intent || ''}" onchange="submitAgentFeedback('${callSid}', '${call.primary_intent || ''}')" style="width: 100%; padding: 8px; border-radius: 4px; background: var(--bg-elevated); border: 1px solid var(--border); color: var(--text);">
          </div>
        </div>
        <textarea id="fbNotes_${callSid}" placeholder="Agent notes or details on dialect nuances... (saves when you click outside)" onblur="submitAgentFeedback('${callSid}', '${call.primary_intent || ''}')" style="width: 100%; padding: 8px; border-radius: 4px; background: var(--bg-elevated); border: 1px solid var(--border); color: var(--text); min-height: 60px; margin-bottom: 8px; font-family: inherit; font-size: 13px;"></textarea>
        <div style="text-align: right;">
          <span id="fbSuccess_${callSid}" style="color: var(--green); font-size: 12px; opacity: 0; transition: opacity 0.3s; font-weight: 500;">✓ Saved automatically!</span>
        </div>
      </div>
      `;
  } catch (err) { body.innerHTML = `<p style="color:var(--red)">Error loading: ${err.message}</p>`; }
}

async function submitAgentFeedback(callSid, originalIntent) {
  const accuracy = document.getElementById(`fbAccuracy_${callSid}`).value;
  const correctedIntent = document.getElementById(`fbIntent_${callSid}`).value;
  const notes = document.getElementById(`fbNotes_${callSid}`).value;
  
  try {
    const res = await fetch('/api/agent/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callSid,
        confirmationStatus: accuracy,
        originalIntent: originalIntent,
        correctedIntent: correctedIntent,
        agentNotes: notes,
        correctedBy: 'human_agent'
      })
    });
    
    if (res.ok) {
      const msg = document.getElementById(`fbSuccess_${callSid}`);
      if (msg) {
        msg.style.opacity = '1';
        setTimeout(() => msg.style.opacity = '0', 3000);
      }
      // Reload feedback tab data if we are on it
      if (currentTab === 'feedback') loadFeedback();
    }
  } catch (err) {
    console.error('Failed to submit feedback', err);
    alert('Failed to submit feedback. Check console.');
  }
}

// ── INTENTS ──
function renderIntents(stats) {
  const container = document.getElementById('intentBars');
  if (!container) return;
  const intents = stats?.intentDistribution || [];
  if (intents.length === 0) { container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">${ICONS.target}</div><div class="empty-state-text">No intents detected yet</div></div>`; return; }
  const maxCount = Math.max(...intents.map(i => Number(i.count)));
  container.innerHTML = intents.map((item, idx) => {
    const pct = maxCount > 0 ? (Number(item.count) / maxCount) * 100 : 0;
    return `<div class="bar-row"><span class="bar-label">${item.primary_intent}</span><div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${COLORS[idx % COLORS.length]}">${item.count}</div></div><span class="bar-count">${item.count}</span></div>`;
  }).join('');
}

// ── ESCALATIONS ──
function renderEscalations(stats, calls) {
  const totalEl = document.getElementById('totalEscalations');
  const barsEl = document.getElementById('escalationBars');
  const tbody = document.getElementById('escBody');
  const reasons = stats?.escalationReasons || [];
  const totalEsc = reasons.reduce((s, r) => s + Number(r.count), 0);
  if (totalEl) totalEl.textContent = totalEsc;
  if (barsEl) {
    if (reasons.length === 0) { barsEl.innerHTML = `<div class="empty-state"><div class="empty-state-icon">${ICONS.alertTriangle}</div><div class="empty-state-text">No escalations recorded</div></div>`; }
    else {
      const maxCount = Math.max(...reasons.map(r => Number(r.count)));
      barsEl.innerHTML = reasons.map((r, i) => `<div class="bar-row"><span class="bar-label">${r.escalation_reason}</span><div class="bar-track"><div class="bar-fill" style="width:${maxCount > 0 ? (Number(r.count) / maxCount) * 100 : 0}%;background:${COLORS[i % COLORS.length]}">${r.count}</div></div><span class="bar-count">${r.count}</span></div>`).join('');
    }
  }
  if (tbody) {
    const escCalls = (calls || []).filter(c => c.escalated);
    if (escCalls.length === 0) { tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-state-text">No escalated calls</div></div></td></tr>`; }
    else { tbody.innerHTML = escCalls.map(c => `<tr onclick="showCallDetail('${c.call_sid}')"><td><code style="font-size:11px;color:var(--text-muted)">…${(c.call_sid || '').slice(-12)}</code></td><td>${LANG_NAMES[c.language_code] || c.language_code || '—'}</td><td>${c.primary_intent || '—'}</td><td>${c.escalation_reason || '—'}</td><td>${c.turns || 0}</td><td style="font-size:11.5px;color:var(--text-muted)">${c.started_at ? new Date(c.started_at).toLocaleString() : '—'}</td></tr>`).join(''); }
  }
}

// ── AGENT PANEL: Live Calls ──
async function loadLiveCalls() {
  try {
    const data = await fetchJSON('/api/agent/live-calls');
    const container = document.getElementById('liveCallsContainer');
    const countEl = document.getElementById('agentLiveCalls');
    if (countEl) countEl.textContent = data.count || 0;
    if (!container) return;
    if (!data.calls || data.calls.length === 0) {
      container.innerHTML = '<p class="empty-state">No active calls at the moment.</p>';
      return;
    }
    container.innerHTML = data.calls.map(c => {
      const msgs = (c.recentMessages || []).map(m => `<div class="live-call-msg ${m.role}">${m.role === 'user' ? '👤' : '🤖'} ${(m.content || '').slice(0, 120)}</div>`).join('');
      return `<div class="live-call-card ${c.isUrgent ? 'urgent' : ''}">
        <div class="live-call-header">
          <span class="live-call-sid">…${(c.callSid || '').slice(-12)}</span>
          <div class="live-call-badges">
            ${c.isUrgent ? '<span class="badge badge-red">⚡ URGENT</span>' : ''}
            ${c.dialect && c.dialect !== 'standard' ? `<span class="badge badge-purple">${capitalize(c.dialect)}</span>` : ''}
            <span class="badge badge-${getEmotionBadgeClass(c.emotion)}">${capitalize(c.emotion)}</span>
          </div>
        </div>
        <div class="live-call-body">
          <div class="live-call-field"><span class="live-call-field-label">Stage</span><span class="live-call-field-value">${capitalize(c.stage)}</span></div>
          <div class="live-call-field"><span class="live-call-field-label">Intent</span><span class="live-call-field-value">${c.intent || '—'}</span></div>
          <div class="live-call-field"><span class="live-call-field-label">Turns</span><span class="live-call-field-value">${c.turnCount}</span></div>
          <div class="live-call-field"><span class="live-call-field-label">Duration</span><span class="live-call-field-value">${Math.round((c.callDuration || 0) / 1000)}s</span></div>
        </div>
        ${c.lastRestatement ? `<div style="margin-top:10px;padding:8px 12px;background:var(--accent-glow);border-radius:var(--radius-xs);font-size:12px;color:var(--accent)">📋 "${c.lastRestatement}"</div>` : ''}
        ${msgs ? `<div class="live-call-messages">${msgs}</div>` : ''}
      </div>`;
    }).join('');
  } catch (err) { console.error('Live calls error:', err); }
}

// ── FEEDBACK TAB ──
async function loadFeedback() {
  try {
    const data = await fetchJSON('/api/agent/feedback/stats');
    if (!data) return;
    // KPI cards
    const statusMap = {};
    (data.confirmationStatusCounts || []).forEach(r => { statusMap[r.confirmation_status] = Number(r.count); });
    const fbCorrect = document.getElementById('fbCorrect');
    const fbPartial = document.getElementById('fbPartial');
    const fbIncorrect = document.getElementById('fbIncorrect');
    if (fbCorrect) fbCorrect.textContent = statusMap.correct || 0;
    if (fbPartial) fbPartial.textContent = statusMap.partially_correct || 0;
    if (fbIncorrect) fbIncorrect.textContent = statusMap.incorrect || 0;

    // Dialect bars
    renderBarChart('dialectBars', (data.dialectBreakdown || []).map(r => ({ label: capitalize(r.dialect), count: Number(r.count) })));
    // Correction bars
    renderBarChart('correctionBars', (data.intentCorrections || []).map(r => ({ label: `${r.original_intent} → ${r.corrected_intent}`, count: Number(r.count) })));

    // Recent feedback table
    const tbody = document.getElementById('feedbackBody');
    if (tbody) {
      const rows = data.recentFeedback || [];
      if (rows.length === 0) { tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-state-text">No feedback logged yet</div></div></td></tr>`; }
      else {
        tbody.innerHTML = rows.map(r => {
          const statusClass = r.confirmation_status === 'correct' ? 'badge-correct' : r.confirmation_status === 'partially_correct' ? 'badge-partial' : r.confirmation_status === 'incorrect' ? 'badge-incorrect' : 'badge-unknown';
          return `<tr>
            <td><code style="font-size:11px;color:var(--text-muted)">…${(r.call_sid || '').slice(-12)}</code></td>
            <td><span class="badge ${statusClass}">${capitalize(r.confirmation_status)}</span></td>
            <td>${r.original_intent || '—'}</td><td>${r.corrected_intent || '—'}</td>
            <td>${r.dialect && r.dialect !== 'standard' ? capitalize(r.dialect) : '—'}</td>
            <td>${capitalize(r.corrected_by || 'system')}</td>
            <td style="font-size:11.5px;color:var(--text-muted)">${r.created_at ? new Date(r.created_at).toLocaleString() : '—'}</td>
          </tr>`;
        }).join('');
      }
    }
  } catch (err) { console.error('Feedback load error:', err); }
}

function renderBarChart(containerId, items) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!items || items.length === 0) { container.innerHTML = '<div class="empty-state"><div class="empty-state-text">No data yet</div></div>'; return; }
  const maxCount = Math.max(...items.map(i => i.count));
  container.innerHTML = items.map((item, idx) => {
    const pct = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
    return `<div class="bar-row"><span class="bar-label">${item.label}</span><div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${COLORS[idx % COLORS.length]}">${item.count}</div></div><span class="bar-count">${item.count}</span></div>`;
  }).join('');
}

// ── NAVIGATION ──
function switchTab(tabName) {
  currentTab = tabName;
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const tabEl = document.getElementById(`tab-${tabName}`);
  if (tabEl) tabEl.classList.add('active');
  const navEl = document.querySelector(`.nav-item[data-tab="${tabName}"]`);
  if (navEl) navEl.classList.add('active');
  const titles = { overview: 'Overview', calls: 'Call History', intents: 'Intents', escalations: 'Escalations', agent: 'Agent Panel', feedback: 'Feedback & Learning' };
  document.getElementById('pageTitle').textContent = titles[tabName] || 'Dashboard';
  if (tabName === 'agent') loadLiveCalls();
  if (tabName === 'feedback') loadFeedback();
}

function setDbStatus(status) {
  const dot = document.querySelector('.status-dot');
  const text = document.querySelector('.status-text');
  dot.className = 'status-dot ' + (status === 'connected' ? 'connected' : status === 'error' ? 'error' : '');
  text.textContent = status === 'connected' ? 'PostgreSQL Connected' : status === 'error' ? 'DB Offline (in-memory)' : 'Connecting…';
}

function capitalize(str) { if (!str) return '—'; return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' '); }
function formatEventName(type) { return (type || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }
function getEmotionBadgeClass(emotion) {
  const map = { neutral: 'blue', happy: 'green', distress: 'amber', high_distress: 'red', angry: 'red', confused: 'purple', fear: 'amber', urgency: 'red' };
  return map[emotion] || 'blue';
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-item').forEach(item => item.addEventListener('click', () => switchTab(item.dataset.tab)));
  document.getElementById('refreshBtn').addEventListener('click', () => {
    const btn = document.getElementById('refreshBtn');
    btn.classList.add('spinning');
    loadAll().finally(() => setTimeout(() => btn.classList.remove('spinning'), 600));
  });
  document.getElementById('callLimit')?.addEventListener('change', loadAll);
  document.getElementById('modalClose').addEventListener('click', () => document.getElementById('callModal').classList.remove('open'));
  document.getElementById('callModal').addEventListener('click', (e) => { if (e.target === e.currentTarget) document.getElementById('callModal').classList.remove('open'); });
  document.getElementById('menuToggle').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));
  document.getElementById('refreshAgent')?.addEventListener('click', loadLiveCalls);

  loadAll();
  autoRefreshTimer = setInterval(() => {
    loadAll();
    if (currentTab === 'agent') loadLiveCalls();
  }, 15000);
});
