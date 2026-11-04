// Panel Porque: un borrador compartido, tres modalidades equivalentes.
// Sin conexión: espejo de la ÚLTIMA VERSIÓN GUARDADA + aviso (no conserva
// entradas sin guardar). Reconectar jamás publica solo.
import { pendingOf, canonicalDraft, contentHashOf } from '/shared/contracts.mjs';
import { t, modalityName, initI18n } from '/i18n.mjs';

const $ = (id) => document.getElementById(id);
const S = { csrf: null, drafts: [], draft: null, mode: 'C', review: null, offline: false, speaking: false };
const L = () => getLang();
const PEND_KEY = { name: 'pendName', price: 'pendPrice', modality: 'pendModality', description: 'pendDesc' };
const faltanDe = (pending) => (pending ?? []).map((k) => t(L(), PEND_KEY[k] ?? k));

async function api(path, opts = {}) {
  try {
    const r = await fetch(path, {
      ...opts,
      headers: { 'content-type': 'application/json', ...(S.csrf ? { 'x-csrf': S.csrf } : {}), ...(opts.headers ?? {}) },
    });
    setOffline(false);
    return { status: r.status, body: await r.json() };
  } catch {
    setOffline(true);
    return { status: 0, body: { ok: false, error: 'OFFLINE' } };
  }
}
function setOffline(v) {
  S.offline = v;
  $('offline-bar').style.display = v ? 'block' : 'none';
  if (v && S.draft) mirrorSave();
}
const mirrorSave = () => S.draft && localStorage.setItem('porque.mirror', JSON.stringify(S.draft));
function mirrorLoad() {
  try {
    const m = JSON.parse(localStorage.getItem('porque.mirror') ?? 'null');
    if (m) { S.draft = m; renderEditor(); alert(t(L(), 'mirrorRecovered', { rev: m.revision })); }
    else alert(t(L(), 'mirrorNone'));
  } catch { alert(t(L(), 'mirrorBad')); }
}

// ---- Auth (cuentas + vendedor heredado) ----
S.accountType = null; // 'user' | 'legacy'
function enterApp(csrf, accountType) {
  S.csrf = csrf;
  S.accountType = accountType;
  $('login-sec').hidden = true;
  $('app').hidden = false;
  loadDrafts();
  cargarApoyos();
}
function showTab(which, focus) {
  const entrar = which === 'entrar';
  $('tab-entrar').setAttribute('aria-pressed', String(entrar));
  $('tab-registro').setAttribute('aria-pressed', String(!entrar));
  $('form-entrar').hidden = !entrar;
  $('form-registro').hidden = entrar;
  $('login-msg').textContent = '';
  for (const id of ['login-error', 'reg-error']) { $(id).hidden = true; $(id).textContent = ''; }
  if (focus !== false) (entrar ? $('login-email') : $('reg-name')).focus();
}
function fieldError(id, msg, focusId) {
  const el = $(id);
  el.textContent = msg;
  el.hidden = false;
  if (focusId) $(focusId).focus();
}
$('tab-entrar').addEventListener('click', () => showTab('entrar'));
$('tab-registro').addEventListener('click', () => showTab('registro'));
$('btn-login-account').addEventListener('click', async () => {
  const email = $('login-email').value.trim();
  const password = $('login-password').value;
  $('login-password').value = '';
  if (!email) { fieldError('login-error', t(L(), 'loginEmailReq'), 'login-email'); return; }
  if (!password) { fieldError('login-error', t(L(), 'loginPassReq'), 'login-password'); return; }
  $('login-msg').textContent = t(L(), 'loggingIn');
  const { status, body } = await api('/api/account/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  if (body.ok) enterApp(body.csrf, 'user');
  else { $('login-msg').textContent = ''; fieldError('login-error', status === 429 ? t(L(), 'loginBlocked') : t(L(), 'loginInvalid'), 'login-email'); }
});
$('btn-register').addEventListener('click', async () => {
  const name = $('reg-name').value.trim();
  const email = $('reg-email').value.trim();
  const password = $('reg-password').value;
  $('reg-password').value = '';
  if (!name) { fieldError('reg-error', t(L(), 'regNameReq'), 'reg-name'); return; }
  if (!email) { fieldError('reg-error', t(L(), 'regEmailReq'), 'reg-email'); return; }
  if (password.length < 12) { fieldError('reg-error', t(L(), 'regPassReq'), 'reg-password'); return; }
  $('login-msg').textContent = t(L(), 'registering');
  const { status, body } = await api('/api/account/register', { method: 'POST', body: JSON.stringify({ name, email, password }) });
  if (body.ok) enterApp(body.csrf, 'user');
  else {
    $('login-msg').textContent = '';
    if (status === 409) fieldError('reg-error', t(L(), 'regExists'), 'login-email');
    else if (status === 429) fieldError('reg-error', t(L(), 'regLimit'), null);
    else fieldError('reg-error', t(L(), 'regFail', { detail: body.detail || body.error || '' }), null);
  }
});
$('btn-login').addEventListener('click', async () => {
  const secret = $('login-secret').value;
  $('login-secret').value = '';
  const { status, body } = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ secret }) });
  if (body.ok) enterApp(body.csrf, 'legacy');
  else $('login-msg').textContent = status === 429 ? t(L(), 'legacyBlocked') : t(L(), 'legacyDenied');
});
$('btn-logout').addEventListener('click', async () => {
  await api(S.accountType === 'user' ? '/api/account/logout' : '/api/auth/logout', { method: 'POST' });
  S.csrf = null; S.draft = null; S.accountType = null; location.reload();
});
$('btn-mirror').addEventListener('click', mirrorLoad);

// Campos con guardado diferido: si cambian tras revisar, la revisión deja de valer.
const DIRTY_FIELDS = ['f-name', 'f-desc', 'f-price-text', 'f-init-name', 'f-init-desc', 'f-purpose', 'f-goal'];
let cleanSnap = '';
function snapFields() {
  return DIRTY_FIELDS.map((id) => { const el = $(id); return el ? el.value : ''; }).join('|');
}
function markClean() { cleanSnap = snapFields(); }
function isDirty() { return snapFields() !== cleanSnap; }
function onFieldInput() {
  if (S.review && isDirty()) {
    S.review = null; $('review').hidden = true; $('btn-publish').hidden = true;
    $('draft-meta').textContent = t(L(), 'dirtyReview');
  }
}
DIRTY_FIELDS.forEach((id) => { const el = $(id); if (el) el.addEventListener('input', onFieldInput); });

// ---- Borradores ----
function textoBorrador(d) {
  const nombre = d.name || t(L(), 'draftNoName');
  const faltan = faltanDe(d.pending);
  const estado = faltan.length ? t(L(), 'draftMissing', { items: faltan.join(', ') }) : t(L(), 'draftReady');
  return `${d.kind === 'initiative' ? t(L(), 'draftMineInit') : ''}${nombre} — ${estado}`;
}
async function loadDrafts() {
  const { body } = await api('/api/drafts');
  if (!body.ok) return;
  S.drafts = body.drafts;
  const inits = S.drafts.filter((d) => d.kind === 'initiative');
  const prods = S.drafts.filter((d) => d.kind !== 'initiative');
  const items = (lista) => lista.map((d) =>
    `<li><button data-d="${d.id}">${escapeHtml(textoBorrador(d))}</button></li>`).join('');
  $('drafts-initiative').innerHTML = items(inits) || `<li class="nota">${escapeHtml(t(L(), 'noInitsMine'))}</li>`;
  $('drafts-products').innerHTML = items(prods) || `<li class="nota">${escapeHtml(t(L(), 'noProdsMine'))}</li>`;
}
document.querySelectorAll('.lista-borradores').forEach((ul) => ul.addEventListener('click', (e) => {
  const b = e.target.closest('[data-d]');
  if (b) selectDraft(b.dataset.d);
}));
$('btn-new').addEventListener('click', async () => {
  const { body } = await api('/api/drafts', { method: 'POST', body: JSON.stringify({ clientOpId: crypto.randomUUID() }) });
  if (body.ok) { await loadDrafts(); selectDraft(body.draft.id); }
});
$('btn-new-initiative').addEventListener('click', async () => {
  const { body } = await api('/api/drafts', { method: 'POST', body: JSON.stringify({ clientOpId: crypto.randomUUID(), kind: 'initiative' }) });
  if (body.ok) { await loadDrafts(); selectDraft(body.draft.id); }
  else alert(t(L(), 'newInitFail', { detail: body.detail || body.error }));
});
function selectDraft(id) {
  S.draft = S.drafts.find((d) => d.id === id) ?? null;
  S.review = null;
  $('review').hidden = true; $('btn-publish').hidden = true;
  qIndex = 0;
  const ok = $('publish-ok');
  if (ok) ok.hidden = true;
  renderEditor();
}
// Resuelve relativas y absolutas contra el origen actual.
const resolveUrl = (u) => new URL(u, location.origin).href;
function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function renderEditor() {
  const d = S.draft;
  $('editor').hidden = !d;
  if (!d) return;
  const isInit = d.kind === 'initiative';
  const faltan = faltanDe(d.pending);
  $('draft-meta').textContent = `${t(L(), 'metaSaved')}${faltan.length ? ` · ${t(L(), 'draftMissing', { items: faltan.join(', ') })}` : ` · ${t(L(), 'draftReady')}`}`;
  try {
    $('draft-tecnico').textContent = `rev ${d.revision} · ${t(L(), 'diagStatus')} ${d.status} · ${t(L(), 'diagPend')}: ${(d.pending ?? []).join(', ') || t(L(), 'pendNone')} · ${t(L(), 'diagContent')} ${contentHashOf(canonicalDraft(d)).slice(0, 12)}…`;
  } catch { /* diagnóstico informativo */ }
  $('product-modes').style.display = '';
  $('mode-C').hidden = isInit || S.mode !== 'C';
  $('mode-A').hidden = S.mode !== 'A';
  $('mode-B').hidden = S.mode !== 'B';
  $('mode-a-note').hidden = !isInit;
  $('init-box').hidden = !isInit;
  if (isInit) {
    if (document.activeElement !== $('f-init-name')) $('f-init-name').value = d.name ?? '';
    document.querySelectorAll('[data-imode]').forEach((x) =>
      x.setAttribute('aria-pressed', String(x.dataset.imode === d.modality)));
    $('init-modality-view').textContent = d.modality
      ? t(L(), 'modalityNow', { m: modalityName(L(), d.modality) })
      : t(L(), 'modalityPending');
    $('f-init-desc').value = d.description ?? '';
    $('f-purpose').value = d.purpose ?? '';
    $('f-goal-view').textContent = Number.isInteger(d.goalCents)
      ? t(L(), 'goalNow', { amt: (d.goalCents / 100).toFixed(2) })
      : t(L(), 'goalNone');
    if (document.activeElement !== $('f-goal')) $('f-goal').value = '';
  } else {
    $('f-name').value = d.name ?? '';
    $('f-desc').value = d.description ?? '';
    $('f-price-view').textContent = Number.isInteger(d.priceCents) ? t(L(), 'priceNow', { amt: (d.priceCents / 100).toFixed(2) }) : t(L(), 'priceNone');
  }
  askQuestion();
  mirrorSave();
  markClean();
}

async function savePatch(patch) {
  const { status, body } = await api(`/api/drafts/${S.draft.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ baseRevision: S.draft.revision, clientOpId: crypto.randomUUID(), patch }),
  });
  if (body.ok) {
    S.draft = body.draft; S.review = null; $('review').hidden = true; $('btn-publish').hidden = true;
    await loadDrafts(); selectDraft(S.draft.id);
    return true;
  }
  if (status === 409 && body.conflict) { showConflict(body.conflict); return false; }
  alert(t(L(), 'saveFail', { detail: body.detail || body.error }));
  return false;
}

function showConflict(c) {
  S.conflict = c;
  const box = $('conflict');
  box.hidden = false;
  const fmt = (s) => `${escapeHtml(s.name ?? '—')} · ${Number.isInteger(s.priceCents) ? '$' + (s.priceCents / 100).toFixed(2) : escapeHtml(t(L(), 'noPrice'))} · rev ${s.revision}`;
  box.innerHTML = `<h3>${escapeHtml(t(L(), 'conflictTitle'))}</h3>
    <p><strong>${escapeHtml(t(L(), 'conflictServer'))}</strong> ${fmt(c.server)}</p>
    <p><strong>${escapeHtml(t(L(), 'conflictMine'))}</strong> ${fmt(c.client)}</p>
    <button id="cf-theirs" class="big">${escapeHtml(t(L(), 'cfKeepServer'))}</button>
    <button id="cf-mine" class="big">${escapeHtml(t(L(), 'cfKeepMine'))}</button>`;
  $('cf-mine').addEventListener('click', () => resolveConflict(c.id, 'mine'));
  $('cf-theirs').addEventListener('click', () => resolveConflict(c.id, 'theirs'));
}
async function resolveConflict(cid, choice) {
  const { body } = await api(`/api/drafts/${S.draft.id}/conflicts/${cid}/resolve`, {
    method: 'POST', body: JSON.stringify({ choice, clientOpId: crypto.randomUUID() }),
  });
  if (body.ok) { $('conflict').hidden = true; S.conflict = null; S.draft = body.draft; await loadDrafts(); selectDraft(S.draft.id); }
}

// ---- Modos ----
document.querySelector('#product-modes').addEventListener('click', (e) => {
  const b = e.target.closest('[data-mode]');
  if (!b) return;
  S.mode = b.dataset.mode; // cambiar de modalidad no pierde el borrador
  document.querySelectorAll('#product-modes [data-mode]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  const isInit = S.draft?.kind === 'initiative';
  $('mode-A').hidden = S.mode !== 'A';
  $('mode-B').hidden = S.mode !== 'B';
  $('mode-C').hidden = isInit || S.mode !== 'C';
});

// ---- Modo C ----
$('btn-save-c').addEventListener('click', async () => {
  const patch = { name: $('f-name').value, description: $('f-desc').value };
  if ($('f-price-text').value.trim()) patch.priceText = $('f-price-text').value.trim();
  if (await savePatch(patch)) $('f-price-text').value = '';
});
$('p-plus').addEventListener('click', () => stepPrice(100));
$('p-minus').addEventListener('click', () => stepPrice(-100));
document.querySelectorAll('[data-quick]').forEach((b) =>
  b.addEventListener('click', () => savePatch({ priceCents: Number(b.dataset.quick) })));
function stepPrice(delta) {
  const cur = Number.isInteger(S.draft?.priceCents) ? S.draft.priceCents : 0;
  savePatch({ priceCents: Math.max(0, cur + delta) });
}

// ---- Iniciativa: modalidad + presentación, propósito y meta ----
document.querySelector('#init-box .modos').addEventListener('click', (e) => {
  const b = e.target.closest('[data-imode]');
  if (!b || !S.draft) return;
  savePatch({ modality: b.dataset.imode });
});
function parseGoalUsdToCents(text) {
  const t0 = String(text ?? '').trim().replace(',', '.');
  if (!t0) return { value: null };
  if (!/^\d+(\.\d{1,2})?$/.test(t0)) return { error: t(L(), 'goalInvalid') };
  const cents = Math.round(Number(t0) * 100);
  if (!Number.isSafeInteger(cents) || cents < 1 || cents > 100000000) {
    return { error: t(L(), 'goalRange') };
  }
  return { value: cents };
}
$('btn-save-init').addEventListener('click', async () => {
  const goal = parseGoalUsdToCents($('f-goal').value);
  if (goal.error) { alert(goal.error); return; }
  const patch = { name: $('f-init-name').value, description: $('f-init-desc').value, purpose: $('f-purpose').value };
  if (goal.value !== null) patch.goalCents = goal.value;
  if (await savePatch(patch)) $('f-goal').value = '';
});

// ---- Modo A: dictado (doble de transcripción etiquetado) ----
let recorder = null, recChunks = [], recTimer = null, recSecs = 0, recMime = '';
$('btn-rec').addEventListener('click', async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recMime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
    recorder = new MediaRecorder(stream, recMime ? { mimeType: recMime } : undefined);
    recChunks = [];
    recorder.ondataavailable = (e) => e.data.size && recChunks.push(e.data);
    recorder.onstop = () => stream.getTracks().forEach((t) => t.stop());
    recorder.start();
    recSecs = 0;
    $('grabando').hidden = false;
    $('btn-rec').disabled = true; $('btn-rec-stop').disabled = false; $('btn-rec-cancel').disabled = false;
    recTimer = setInterval(() => {
      recSecs += 1;
      $('rec-time').textContent = String(recSecs);
      if (recSecs === 50) $('rec-info').textContent = t(L(), 'rec50');
    }, 1000);
  } catch {
    // Sin voz validada: mensaje explícito + ruta manual por texto.
    $('rec-info').textContent = t(L(), 'micDenied');
    $('fake-script').focus();
  }
});
function stopRec(cancelled) {
  clearInterval(recTimer);
  $('grabando').hidden = true;
  $('btn-rec').disabled = false; $('btn-rec-stop').disabled = true; $('btn-rec-cancel').disabled = true;
  if (!recorder) return;
  const mime = recorder.mimeType || recMime || t(L(), 'recUnknown');
  const bytes = recChunks.reduce((n, c) => n + c.size, 0);
  try { recorder.stop(); } catch { /* noop */ }
  recorder = null;
  if (cancelled) { recChunks = []; $('rec-info').textContent = t(L(), 'recCancelled'); return; }
  // El silencio no confirma: solo informa formato para el intake.
  api('/api/audio/intake', { method: 'POST', body: JSON.stringify({ mime, bytes, durationMs: recSecs * 1000 }) })
    .then(({ body }) => {
      $('rec-info').textContent = body.ok
        ? t(L(), 'recVerdict', { mime: mime || '?', verdict: body.verdict, reason: body.reason ?? '' })
        : t(L(), 'recRejected', { detail: body.detail ?? body.error });
    });
  recChunks = []; // sin retención de audio por defecto
}
$('btn-rec-stop').addEventListener('click', () => stopRec(false));
$('btn-rec-cancel').addEventListener('click', () => stopRec(true));
$('btn-transcribe').addEventListener('click', async () => {
  if (!S.draft) { alert(t(L(), 'chooseDraftFirst')); return; }
  const script = $('fake-script').value || t(L(), 'fakeScriptDefault');
  const tt = await api('/api/audio/transcribe', { method: 'POST', body: JSON.stringify({ script }) });
  const text = tt.body?.result?.transcript ?? '';
  const { body } = await api('/api/ai/propose', {
    method: 'POST', body: JSON.stringify({ draftId: S.draft.id, baseRevision: S.draft.revision, text }),
  });
  if (!body.ok) return;
  S.proposal = { p: body.proposal, text };
  showProposal(body.proposal, text);
});
// La modalidad nunca se fija por voz: del dictado solo valen nombre/descripción.
function pickInitiativePatch(patch) {
  const out = {};
  if (typeof patch?.name === 'string' && patch.name.trim()) out.name = patch.name;
  if (typeof patch?.description === 'string' && patch.description.trim()) out.description = patch.description;
  return Object.keys(out).length ? out : null;
}
function showProposal(p, text) {
  const box = $('proposal');
  const isInit = S.draft?.kind === 'initiative';
  box.hidden = false;
  box.innerHTML = `<span class="fake">${escapeHtml(t(L(), 'fakeBadge'))}</span>
    <p><strong>${escapeHtml(t(L(), 'proposalGot'))}</strong> ${escapeHtml(text)}</p>
    ${isInit ? `<p class="nota"><strong>${escapeHtml(t(L(), 'proposalInitNote'))}</strong></p>` : ''}
    <p><strong>${escapeHtml(t(L(), 'proposalTitle'))}</strong> ${escapeHtml(t(L(), 'proposalBase', { rev: p.baseRevision }))}${p.stale ? `<em>${escapeHtml(t(L(), 'proposalStale', { rev: p.currentRevision }))}</em>` : ''}:</p>
    <pre>${escapeHtml(JSON.stringify(p.patch, null, 2))}</pre>
    <p>${escapeHtml(t(L(), 'proposalMissing', { items: p.missing.join(', ') || t(L(), 'missingNone') }))}</p>
    <button id="pp-apply" class="big">${escapeHtml(t(L(), 'ppApply'))}</button>
    <button id="pp-drop" class="big">${escapeHtml(t(L(), 'ppDrop'))}</button>`;
  $('pp-apply').addEventListener('click', async () => {
    if (p.stale) { alert(t(L(), 'proposalStaleAlert')); return; }
    if (isInit) {
      const safe = pickInitiativePatch(p.patch);
      if (!safe) { alert(t(L(), 'proposalEmptyInit')); return; }
      await savePatch(safe);
    } else {
      await savePatch(p.patch);
    }
    S.proposal = null;
    box.hidden = true;
  });
  $('pp-drop').addEventListener('click', () => { S.proposal = null; box.hidden = true; });
}

// ---- Modo B: pasos (preguntas según kind del borrador) ----
function qsProduct() {
  return [
    { key: 'name', ask: t(L(), 'qName') },
    { key: 'price', ask: t(L(), 'qPrice') },
    { key: 'description', ask: t(L(), 'qDesc') },
  ];
}
function qsInitiative() {
  return [
    { key: 'name', ask: t(L(), 'qInitName') },
    { key: 'modality', ask: t(L(), 'qModality') },
    { key: 'description', ask: t(L(), 'qDesc') },
    { key: 'purpose', ask: t(L(), 'qPurpose'), optional: true },
  ];
}
function currentQuestions() {
  return S.draft?.kind === 'initiative' ? qsInitiative() : qsProduct();
}
// Normaliza tildes/mayusculas: donaciones->donations, negocio->business, ambas->both.
function normalizeModalityAnswer(text) {
  const tt = String(text ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if (!tt) return null;
  if (tt.includes('ambas') || tt.includes('ambos') || tt.includes('both')) return 'both';
  if (tt.includes('donaci') && tt.includes('negocio')) return 'both';
  if (tt.includes('donaci') || tt.includes('donation')) return 'donations';
  if (tt.includes('negocio') || tt.includes('business')) return 'business';
  return null;
}
let qIndex = 0;
function askQuestion() {
  const qs = currentQuestions();
  const q = qs[qIndex % qs.length];
  $('q-text').textContent = q.ask;
  $('q-answer').value = '';
}
$('btn-repeat').addEventListener('click', askQuestion);
$('btn-speak').addEventListener('click', () => {
  if (!('speechSynthesis' in window)) { alert(t(L(), 'speakMissing')); return; }
  S.speaking = true; // la voz de la app nunca activa una confirmación
  const u = new SpeechSynthesisUtterance($('q-text').textContent);
  u.lang = L() === 'en' ? 'en-US' : 'es-ES';
  u.onend = u.onerror = () => { S.speaking = false; };
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
});
$('btn-answer').addEventListener('click', async () => {
  const qs = currentQuestions();
  const q = qs[qIndex % qs.length];
  const v = $('q-answer').value.trim();
  if (!v) {
    if (q.optional) { qIndex += 1; askQuestion(); } // respuesta vacía salta lo opcional
    return;
  }
  if (q.key === 'modality') {
    const m = normalizeModalityAnswer(v);
    // Si no se entiende, se repite la pregunta con guía sin avanzar.
    if (!m) { $('q-text').textContent = `${t(L(), 'modalityGuide')} ${q.ask}`; $('q-answer').focus(); return; }
    // Elegir modalidad por voz solo edita el borrador: publicar exige revisión+publicación explícitas.
    if (await savePatch({ modality: m })) { qIndex += 1; askQuestion(); }
    return;
  }
  const patch = q.key === 'price' ? { priceText: v } : { [q.key]: v };
  if (await savePatch(patch)) { qIndex += 1; askQuestion(); }
});

// ---- Revisión y publicación ----
function renderReview(review) {
  const s = review.snapshot;
  const isInit = (S.draft?.kind ?? s.kind) === 'initiative';
  const extraInit = isInit
    ? `<p>${escapeHtml(t(L(), 'modalityWord'))}: <strong>${escapeHtml(s.modality ? modalityName(L(), s.modality) : t(L(), 'modalityNone'))}</strong></p>
    ${s.purpose ? `<p>${escapeHtml(t(L(), 'fPurpose'))}: ${escapeHtml(s.purpose)}</p>` : ''}
    ${Number.isInteger(s.goalCents) ? `<p>${escapeHtml(t(L(), 'goalNow', { amt: (s.goalCents / 100).toFixed(2) }))}</p>` : ''}`
    : '';
  $('review').hidden = false;
  $('review').innerHTML = `<h3>${escapeHtml(t(L(), 'revBoxTitle'))}</h3>
    ${isInit ? `<p><span class="aviso-demo">${escapeHtml(t(L(), 'initBadge'))}</span></p>` : ''}
    <p><strong>${escapeHtml(s.name ?? '—')}</strong> · ${Number.isInteger(s.priceCents) ? '$' + (s.priceCents / 100).toFixed(2) + ' USD' : escapeHtml(isInit ? t(L(), 'revNoPriceInit') : t(L(), 'revNoPrice'))}</p>
    <p>${escapeHtml(s.description ?? '')}</p>
    ${extraInit}
    <p class="nota">${escapeHtml(t(L(), 'revChanged'))}</p>`;
  try {
    $('draft-tecnico').textContent = t(L(), 'revDiag', { hash: review.contentHash.slice(0, 12) });
  } catch { /* diagnóstico informativo */ }
  $('btn-publish').hidden = false;
}
$('btn-review').addEventListener('click', async () => {
  hidePublishOk();
  if (isDirty()) {
    S.review = null; $('review').hidden = true; $('btn-publish').hidden = true;
    $('draft-meta').textContent = t(L(), 'saveFirst');
    return;
  }
  const { body } = await api(`/api/drafts/${S.draft.id}/review`, { method: 'POST' });
  if (!body.ok) return;
  S.review = body.review;
  renderReview(body.review);
});
function hidePublishOk() { const ok = $('publish-ok'); if (ok) ok.hidden = true; }
async function shareHrefFor(pub) {
  // Iniciativas: canónica si hay, si no local. Productos: catálogo.
  if ((pub?.kind ?? S.draft?.kind ?? 'product') === 'initiative' && pub?.id) {
    try {
      const { body } = await api(`/api/share/initiative/${encodeURIComponent(pub.id)}`);
      if (body?.ok && body.share) return resolveUrl(body.share.url ?? body.share.localPath);
    } catch { /* usa enlace local */ }
    return resolveUrl(`/i/${pub.id}`);
  }
  return resolveUrl('/#explorar');
}
function showPublishOk(pub) {
  S.lastPub = pub;
  const box = $('publish-ok');
  if (!box || !pub) return;
  const isInit = (pub.kind ?? S.draft?.kind ?? 'product') === 'initiative';
  const nombre = pub.name ?? t(L(), 'draftNoName');
  const ver = pub.version != null ? ' (v' + pub.version + ')' : '';
  $('publish-ok-msg').textContent = t(L(), 'publishedMsg', { name: nombre, ver });
  $('publish-ok-estado').textContent = '';
  box.hidden = false;
  $('btn-ver-pagina').onclick = async () => {
    location.href = isInit && pub.id ? resolveUrl(`/i/${pub.id}`) : resolveUrl('/#explorar');
  };
  $('btn-copiar-enlace').onclick = async () => {
    const url = await shareHrefFor(pub);
    try {
      await navigator.clipboard.writeText(url);
      $('publish-ok-estado').textContent = t(L(), 'linkCopied');
    } catch {
      $('publish-ok-estado').textContent = t(L(), 'copyFail', { url });
    }
  };
  $('btn-compartir-qr').onclick = async () => {
    if (isInit && pub.id) {
      // La sección Compartir (con QR) vive en la página de la iniciativa.
      location.href = resolveUrl(`/i/${pub.id}`);
      return;
    }
    const url = resolveUrl('/#explorar');
    try {
      await navigator.clipboard.writeText(url);
      $('publish-ok-estado').textContent = t(L(), 'catalogCopied');
    } catch {
      $('publish-ok-estado').textContent = t(L(), 'copyFail', { url });
    }
  };
}
$('btn-publish').addEventListener('click', async () => {
  if (!S.review || isDirty()) {
    S.review = null; $('review').hidden = true; $('btn-publish').hidden = true;
    $('draft-meta').textContent = t(L(), 'dirtyReview');
    return;
  }
  const { body } = await api(`/api/drafts/${S.draft.id}/publish`, {
    method: 'POST',
    body: JSON.stringify({ reviewToken: S.review.reviewToken, contentHash: S.review.contentHash, clientOpId: crypto.randomUUID() }),
  });
  if (body.ok) {
    const pub = body.initiative ?? body.product;
    S.review = null; $('review').hidden = true; $('btn-publish').hidden = true;
    await loadDrafts(); selectDraft(S.draft.id); cargarApoyos();
    showPublishOk(pub);
  } else {
    $('publish-ok-estado').textContent = t(L(), 'publishFail', { detail: body.detail || body.error });
    $('publish-ok').hidden = false;
  }
});

// ---- Apoyos: lista del propietario por iniciativa publicada ----
function apoyoKindName(k) {
  if (k === 'intent') return t(L(), 'supKindIntent');
  if (k === 'simulated') return t(L(), 'supKindSim');
  if (k) return k;
  return t(L(), 'supKindFallback');
}
function fmtApoyoFecha(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso ?? '') : d.toLocaleString(L() === 'en' ? 'en-US' : 'es-EC');
}
function fmtApoyoMonto(cents) {
  return Number.isInteger(cents) ? `$${(cents / 100).toFixed(2)} USD` : t(L(), 'supNoAmount');
}
function apoyoItem(s) {
  return `<li class="apoyo">
    <strong>${escapeHtml(apoyoKindName(s.kind))}</strong>
    · ${escapeHtml(fmtApoyoMonto(s.amountCents))}
    · ${escapeHtml(s.nickname || t(L(), 'supNoNick'))}
    <br><span class="nota">${escapeHtml(s.message || t(L(), 'supNoMsg'))} · ${escapeHtml(s.status ?? 'expressed')} · ${escapeHtml(fmtApoyoFecha(s.createdAt))}</span>
  </li>`;
}
async function cargarApoyos() {
  const box = $('apoyos');
  if (!box) return;
  box.innerHTML = `<p class="nota">${escapeHtml(t(L(), 'supLoading'))}</p>`;
  const { body: pub } = await api('/api/initiatives');
  if (!pub?.ok || !Array.isArray(pub.initiatives)) {
    box.innerHTML = `<p class="nota">${escapeHtml(t(L(), 'supLoadFail'))}</p>`;
    return;
  }
  if (!pub.initiatives.length) {
    box.innerHTML = `<p class="nota">${escapeHtml(t(L(), 'supNoPubs'))}</p>`;
    return;
  }
  const bloques = [];
  for (const init of pub.initiatives) {
    const { status, body } = await api(`/api/initiatives/${encodeURIComponent(init.id)}/supports`);
    if (status === 404 || !body?.ok) continue; // ajena o no disponible: se omite sin romper
    const items = Array.isArray(body.supports) ? body.supports : [];
    bloques.push(`<article class="ficha">
      <h3>${escapeHtml(init.name ?? t(L(), 'supInitNoName'))}</h3>
      ${items.length ? `<ul>${items.map(apoyoItem).join('')}</ul>` : `<p class="nota">${escapeHtml(t(L(), 'supEmpty'))}</p>`}
      <p class="nota">${escapeHtml(t(L(), 'supHonest'))}</p>
    </article>`);
  }
  box.innerHTML = bloques.length
    ? bloques.join('')
    : `<p class="nota">${escapeHtml(t(L(), 'supNoneAll'))}</p>`;
}
$('btn-apoyos').addEventListener('click', cargarApoyos);

// ---- Idioma en vivo: re-renderiza lo dinámico sin perder campos,
// sin tocar la sesión y sin publicar. ----
function refreshLang() {
  const keep = {};
  for (const id of [...DIRTY_FIELDS, 'q-answer', 'fake-script']) {
    const el = $(id);
    if (el) keep[id] = el.value;
  }
  const active = document.activeElement?.id;
  const snap = cleanSnap;
  const logged = !$('app').hidden;
  if (logged) {
    loadDrafts();
    cargarApoyos();
  }
  if (S.draft) {
    renderEditor();
    for (const [id, v] of Object.entries(keep)) { const el = $(id); if (el) el.value = v; }
    cleanSnap = snap; // conserva el estado sucio exacto anterior al cambio
    if (S.review && isDirty()) {
      S.review = null; $('review').hidden = true; $('btn-publish').hidden = true;
    }
    if (S.review && !$('review').hidden) renderReview(S.review);
    else if (isDirty()) $('draft-meta').textContent = t(L(), 'dirtyReview');
  }
  if (!$('conflict').hidden && S.conflict) showConflict(S.conflict);
  if (!$('proposal').hidden && S.proposal) showProposal(S.proposal.p, S.proposal.text);
  if (!$('publish-ok').hidden && S.lastPub) showPublishOk(S.lastPub);
  if (active && $(active)) {
    try { $(active).focus({ preventScroll: true }); } catch { /* noop */ }
  }
}

// ---- Arranque: recupera csrf (status) y tipo de sesión (me). ----
const getLang = initI18n(refreshLang);
if (new URLSearchParams(location.search).get('a') === 'registro') showTab('registro', false);
api('/api/auth/status').then(({ body: st }) => {
  if (!st.ok) return;
  api('/api/account/me').then(({ body }) => {
    enterApp(st.csrf, body?.user ? 'user' : 'legacy');
  });
});
window.addEventListener('online', () => setOffline(false));
window.addEventListener('offline', () => setOffline(true));
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});

