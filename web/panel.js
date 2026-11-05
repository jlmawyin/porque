// Panel Porque: un paso visible y una acción principal a la vez.
// Estado único de formulario: todos los modos de entrada escriben en el
// mismo formulario y solo Guardar persiste. Nada repinta los campos con
// versiones viejas; un guardado jamás borra lo escrito mientras estaba
// en curso. Sin conexión: espejo de la ÚLTIMA VERSIÓN GUARDADA.
import { pendingOf, canonicalDraft, contentHashOf } from '/shared/contracts.mjs';
import { t, modalityName, initI18n } from '/i18n.mjs';

const $ = (id) => document.getElementById(id);
const L = () => getLang();
const S = { csrf: null, accountType: null, drafts: [], view: 'initiative', ws: null, apoyosLoaded: false };
const PEND_KEY = { name: 'pendName', price: 'pendPrice', modality: 'pendModality', description: 'pendDesc' };
const faltanDe = (pending) => (pending ?? []).map((k) => t(L(), PEND_KEY[k] ?? k));
const COVERS = ['/img/portada-apoyo.svg', '/img/portada-artesania.svg', '/img/portada-negocio.svg', '/img/portada-huerta.svg'];

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
  $('offline-bar').style.display = v ? 'block' : 'none';
  if (v && S.ws?.draft) mirrorSave();
}
const mirrorSave = () => S.ws?.draft && localStorage.setItem('porque.mirror', JSON.stringify(S.ws.draft));
function mirrorGet() {
  try {
    const m = JSON.parse(localStorage.getItem('porque.mirror') ?? 'null');
    return m?.id ? m : null;
  } catch { return null; }
}
const resolveUrl = (u) => new URL(u, location.origin).href;
function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// ---- Auth (cuentas + vendedor heredado) ----
function enterApp(csrf, accountType) {
  S.csrf = csrf;
  S.accountType = accountType;
  $('login-sec').hidden = true;
  $('app').hidden = false;
  loadDrafts();
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
  S.csrf = null; S.ws = null; S.accountType = null; location.reload();
});
window.addEventListener('online', () => setOffline(false));
window.addEventListener('offline', () => setOffline(true));

// ---- Vistas (pestañas reales, con teclado) ----
const VIEWS = ['initiative', 'products', 'apoyos', 'share'];
const VIEW_TAB = { initiative: 'tab-view-init', products: 'tab-view-prod', apoyos: 'tab-view-sup', share: 'tab-view-share' };
const VIEW_PANEL = { initiative: 'view-initiative', products: 'view-products', apoyos: 'view-apoyos', share: 'view-share' };
function showView(name, focusTab) {
  if (!VIEWS.includes(name)) return;
  S.view = name;
  for (const v of VIEWS) {
    $(VIEW_TAB[v]).setAttribute('aria-selected', String(v === name));
    $(VIEW_TAB[v]).tabIndex = v === name ? 0 : -1;
    $(VIEW_PANEL[v]).hidden = (S.drafts.length === 0 && !S.ws) || v !== name;
  }
  if (focusTab) $(VIEW_TAB[name]).focus();
  if (name === 'apoyos' && !S.apoyosLoaded) { S.apoyosLoaded = true; cargarApoyos(); }
  if (name === 'share') renderShareList();
}
for (const v of VIEWS) {
  $(VIEW_TAB[v]).addEventListener('click', () => showView(v, false));
  $(VIEW_TAB[v]).addEventListener('keydown', (e) => {
    const i = VIEWS.indexOf(v);
    let n = null;
    if (e.key === 'ArrowRight') n = VIEWS[(i + 1) % VIEWS.length];
    else if (e.key === 'ArrowLeft') n = VIEWS[(i + VIEWS.length - 1) % VIEWS.length];
    else if (e.key === 'Home') n = VIEWS[0];
    else if (e.key === 'End') n = VIEWS[VIEWS.length - 1];
    if (n) { e.preventDefault(); showView(n, true); }
  });
}

// ---- Estado derivado Borrador / Publicado / Con cambios ----
function draftState(d) {
  if (!d?.published) return 'draft';
  // Publicado limpia solo si el borrador no cambió desde esa versión:
  // cualquier PATCH/resolve sube la revisión del borrador.
  return d.revision === d.published.draftRevision ? 'published' : 'changed';
}
function stateChip(d) {
  const st = draftState(d);
  const label = st === 'published'
    ? `${t(L(), 'statePub')} v${d.published.version}`
    : t(L(), st === 'changed' ? 'stateChanged' : 'stateDraft');
  return `<span class="chip" data-state="${st}">${escapeHtml(label)}</span>`;
}
function draftName(d) { return d.name || t(L(), 'draftNoName'); }

// ---- Listas + bienvenida + retomables ----
async function loadDrafts() {
  const { body } = await api('/api/drafts');
  if (!body.ok) return;
  S.drafts = body.drafts;
  renderLists();
}
function renderLists() {
  const firstAccess = S.drafts.length === 0 && !S.ws;
  $('welcome').hidden = !firstAccess;
  $('views-bar').style.display = firstAccess ? 'none' : '';
  for (const v of VIEWS) $(VIEW_PANEL[v]).hidden = firstAccess || v !== S.view;
  if (firstAccess) { $('workspace').hidden = true; S.ws = null; return; }
  for (const kind of ['initiative', 'product']) {
    const lista = S.drafts.filter((d) => (d.kind ?? 'product') === kind);
    const ul = kind === 'initiative' ? $('drafts-initiative') : $('drafts-products');
    ul.innerHTML = lista.length
      ? lista.map((d) => `<li>${stateChip(d)} <strong>${escapeHtml(draftName(d))}</strong>
        <button class="big" data-open="${d.id}">${escapeHtml(t(L(), 'openDraft'))}</button></li>`).join('')
      : `<li class="nota">${escapeHtml(t(L(), kind === 'initiative' ? 'noInitsMine' : 'noProdsMine'))}</li>`;
    const pendientes = lista.filter((d) => (d.pending ?? []).length > 0);
    const box = kind === 'initiative' ? $('resume-initiative') : $('resume-products');
    box.innerHTML = pendientes.length
      ? `<h3>${escapeHtml(t(L(), 'resumeTitle'))}</h3><ul class="lista-borradores">` + pendientes.map((d) =>
        `<li><strong>${escapeHtml(draftName(d))}</strong> <span class="nota">${escapeHtml(t(L(), 'draftMissing', { items: faltanDe(d.pending).join(', ') }))}</span>
        <button class="big" data-open="${d.id}">${escapeHtml(t(L(), 'resumeBtn'))}</button></li>`).join('') + '</ul>'
      : '';
  }
  if (S.view === 'share') renderShareList();
}
document.querySelectorAll('.lista-borradores').forEach((ul) => ul.addEventListener('click', (e) => {
  const b = e.target.closest('[data-open]');
  if (b) openDraft(b.dataset.open);
}));
document.querySelectorAll('#resume-initiative, #resume-products').forEach((box) => box.addEventListener('click', (e) => {
  const b = e.target.closest('[data-open]');
  if (b) openDraft(b.dataset.open);
}));
document.querySelectorAll('[data-nuevo]').forEach((b) => b.addEventListener('click', () => {
  const opt = b.dataset.nuevo;
  if (opt === 'products') { showView('products', false); openCreate('product', null); }
  else openCreate('initiative', opt === 'both' ? 'both' : 'donations');
}));
$('btn-new-initiative').addEventListener('click', () => openCreate('initiative', null));
$('btn-new').addEventListener('click', () => openCreate('product', null));

// ---- Espacio de trabajo: un solo formulario, un solo guardado ----
const emptyForm = () => ({ name: '', description: '', priceCents: null, priceText: '', modality: null, purpose: '', goalText: '', imageRef: '' });
function formFromDraft(d) {
  return {
    name: d.name ?? '', description: d.description ?? '',
    priceCents: Number.isInteger(d.priceCents) ? d.priceCents : null, priceText: '',
    modality: d.modality ?? null, purpose: d.purpose ?? '',
    goalText: '', imageRef: d.imageRef ?? '',
  };
}
const snapOf = (f) => JSON.stringify(f);
function formHasContent(f) {
  return !!(f.name.trim() || f.description.trim() || f.purpose.trim() || f.goalText.trim()
    || f.priceText.trim() || f.priceCents !== null || f.modality || f.imageRef);
}
function isDirty() {
  if (!S.ws) return false;
  if (S.ws.savedSnap === null) return formHasContent(S.ws.form);
  return snapOf(S.ws.form) !== S.ws.savedSnap;
}
function setForm(patch) {
  Object.assign(S.ws.form, patch);
  if (S.ws.review && isDirty()) invalidateReview();
  renderWsStatus();
}
function invalidateReview() {
  S.ws.review = null;
  S.ws.step = 1;
  renderSteps();
  $('draft-meta').textContent = t(L(), 'dirtyReview');
}
function openCreate(kind, presetModality) {
  S.ws = {
    kind, draft: null, form: emptyForm(), savedSnap: null, opId: crypto.randomUUID(),
    step: 1, review: null, mode: 'C', saving: false, lastPub: null, conflict: null, proposal: null,
  };
  if (presetModality) S.ws.form.modality = presetModality;
  qIndex = 0;
  showWorkspace();
}
function openDraft(id) {
  const d = S.drafts.find((x) => x.id === id);
  if (!d) return;
  S.ws = {
    kind: d.kind ?? 'product', draft: d, form: formFromDraft(d), savedSnap: null,
    opId: crypto.randomUUID(), step: 1, review: null, mode: 'C', saving: false, lastPub: null, conflict: null, proposal: null,
  };
  S.ws.savedSnap = snapOf(S.ws.form);
  qIndex = 0;
  showWorkspace();
}
function showWorkspace() {
  const ws = S.ws;
  renderLists();
  showView(ws.kind === 'initiative' ? 'initiative' : 'products', false);
  $('workspace').hidden = false;
  $('conflict').hidden = true;
  $('proposal').hidden = true;
  formError(null);
  writeForm();
  renderMode();
  renderSteps();
  renderWsStatus();
  renderRecover();
  askQuestion();
  $('ws-title').textContent = ws.kind === 'initiative' ? t(L(), 'wsTitleInit') : t(L(), 'wsTitleProd');
  $('ws-title').focus({ preventScroll: true });
  $('workspace').scrollIntoView({ block: 'nearest' });
}
function closeWorkspace() {
  S.ws = null;
  $('workspace').hidden = true;
  renderLists();
}
$('btn-workspace-back').addEventListener('click', () => {
  const kind = S.ws?.kind ?? 'initiative';
  closeWorkspace();
  showView(kind === 'initiative' ? 'initiative' : 'products', false);
});
function writeForm() {
  const f = S.ws.form;
  $('f-name').value = f.name;
  $('f-desc').value = f.description;
  $('f-price-text').value = f.priceText;
  $('f-purpose').value = f.purpose;
  $('f-goal').value = f.goalText;
  document.querySelectorAll('input[name="cover"]').forEach((r) => { r.checked = r.value === f.imageRef; });
  renderCoverCurrent();
}
function renderMode() {
  const ws = S.ws;
  const isInit = ws.kind === 'initiative';
  document.querySelectorAll('#product-modes [data-mode]').forEach((x) =>
    x.setAttribute('aria-pressed', String(x.dataset.mode === ws.mode)));
  $('mode-C').hidden = ws.mode !== 'C';
  $('mode-A').hidden = ws.mode !== 'A';
  $('mode-B').hidden = ws.mode !== 'B';
  $('mode-a-note').hidden = !isInit;
  const presave = !ws.draft;
  $('mode-a-presave').hidden = !presave;
  $('btn-transcribe').disabled = presave;
  $('label-name').textContent = isInit ? t(L(), 'formNameInit') : t(L(), 'fProdName');
  $('label-desc').textContent = isInit ? t(L(), 'formDescInit') : t(L(), 'fDesc');
  $('price-block').hidden = isInit;
  $('imode-block').hidden = !isInit;
  document.querySelectorAll('[data-imode]').forEach((x) =>
    x.setAttribute('aria-pressed', String(x.dataset.imode === ws.form.modality)));
  const hidePg = isInit && ws.form.modality === 'business';
  $('pg-block').hidden = hidePg;
  $('init-modality-view').textContent = !isInit ? '' : ws.form.modality
    ? t(L(), 'modalityNow', { m: modalityName(L(), ws.form.modality) })
    : t(L(), 'modalityPending');
  const goalSaved = Number.isInteger(ws.draft?.goalCents) ? ws.draft.goalCents : null;
  $('f-goal-view').textContent = goalSaved !== null
    ? t(L(), 'goalNow', { amt: (goalSaved / 100).toFixed(2) })
    : t(L(), 'goalNone');
  const pc = ws.form.priceCents;
  $('f-price-view').textContent = Number.isInteger(pc)
    ? t(L(), 'priceNow', { amt: (pc / 100).toFixed(2) }) + (isDirty() ? ` (${t(L(), 'unsavedTag')})` : '')
    : t(L(), 'priceNone');
}
function renderCoverCurrent() {
  const f = S.ws.form;
  const el = $('cover-current');
  if (!f.imageRef) { el.hidden = true; el.textContent = ''; return; }
  el.hidden = false;
  el.textContent = COVERS.includes(f.imageRef)
    ? t(L(), 'coverCurrent', { name: coverLabel(f.imageRef) })
    : t(L(), 'coverCustom');
}
function coverLabel(ref) {
  const map = { '/img/portada-apoyo.svg': 'coverApoyo', '/img/portada-artesania.svg': 'coverArtesania', '/img/portada-negocio.svg': 'coverNegocio', '/img/portada-huerta.svg': 'coverHuerta' };
  return map[ref] ? t(L(), map[ref]) : ref;
}
function renderSteps() {
  const ws = S.ws;
  for (const n of [1, 2, 3]) {
    $(`step-${n}`).hidden = ws.step !== n;
    const li = $(`step${n}li`);
    if (ws.step === n) li.setAttribute('aria-current', 'step');
    else li.removeAttribute('aria-current');
  }
}
function renderWsStatus() {
  const ws = S.ws;
  if (!ws) return;
  $('ws-state').outerHTML = stateChip(ws.draft ?? { published: null }).replace('class="chip"', 'id="ws-state" class="chip"');
  renderMode();
  if (!ws.draft) {
    $('draft-meta').textContent = '';
  } else if (!isDirty()) {
    const faltan = faltanDe(ws.draft.pending);
    $('draft-meta').textContent = `${t(L(), 'metaSaved')}${faltan.length ? ` · ${t(L(), 'draftMissing', { items: faltan.join(', ') })}` : ` · ${t(L(), 'draftReady')}`}`;
  }
  try {
    const d = ws.draft;
    $('draft-tecnico').textContent = d
      ? `rev ${d.revision} · ${t(L(), 'diagStatus')} ${d.status} · ${t(L(), 'diagPend')}: ${(d.pending ?? []).join(', ') || t(L(), 'pendNone')} · ${t(L(), 'diagContent')} ${contentHashOf(canonicalDraft(d)).slice(0, 12)}…`
      : t(L(), 'diagNew');
  } catch { /* diagnóstico informativo */ }
}
function renderRecover() {
  const ok = !!mirrorGet();
  $('btn-recover').hidden = !ok;
  $('recover-note').hidden = !ok;
}
$('btn-recover').addEventListener('click', () => {
  const m = mirrorGet();
  if (!m) { alert(t(L(), 'mirrorNone')); return; }
  S.ws = {
    kind: m.kind ?? 'product', draft: m, form: formFromDraft(m), savedSnap: null,
    opId: crypto.randomUUID(), step: 1, review: null, mode: 'C', saving: false, lastPub: null, conflict: null, proposal: null,
  };
  S.ws.savedSnap = snapOf(S.ws.form);
  qIndex = 0;
  showWorkspace();
  alert(t(L(), 'mirrorRecovered', { rev: m.revision }));
});
function formError(msg, focusId) {
  const el = $('form-error');
  if (!msg) { el.hidden = true; el.textContent = ''; return; }
  el.textContent = msg;
  el.hidden = false;
  if (focusId) $(focusId).focus();
  el.scrollIntoView({ block: 'nearest' });
}
// Entradas del formulario: todas escriben en el estado único.
for (const [id, key] of [['f-name', 'name'], ['f-desc', 'description'], ['f-purpose', 'purpose'], ['f-goal', 'goalText'], ['f-price-text', 'priceText']]) {
  $(id).addEventListener('input', () => setForm({ [key]: $(id).value }));
}
document.querySelectorAll('input[name="cover"]').forEach((r) =>
  r.addEventListener('change', () => setForm({ imageRef: r.value })));
document.querySelector('#imode-block .modos').addEventListener('click', (e) => {
  const b = e.target.closest('[data-imode]');
  if (!b || !S.ws) return;
  setForm({ modality: b.dataset.imode }); // pendiente: se guarda con Guardar
});
document.querySelector('#product-modes').addEventListener('click', (e) => {
  const b = e.target.closest('[data-mode]');
  if (!b || !S.ws) return;
  S.ws.mode = b.dataset.mode;
  renderMode();
});
function stepPrice(delta) {
  if (!S.ws) return;
  const cur = Number.isInteger(S.ws.form.priceCents) ? S.ws.form.priceCents : 0;
  setForm({ priceCents: Math.max(0, cur + delta) }); // pendiente: se guarda con Guardar
}
$('p-plus').addEventListener('click', () => stepPrice(100));
$('p-minus').addEventListener('click', () => stepPrice(-100));
document.querySelectorAll('[data-quick]').forEach((b) =>
  b.addEventListener('click', () => S.ws && setForm({ priceCents: Number(b.dataset.quick) })));
function parseGoalUsdToCents(text) {
  const raw = String(text ?? '').trim().replace(',', '.');
  if (!raw) return { value: null };
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return { error: t(L(), 'goalInvalid') };
  const cents = Math.round(Number(raw) * 100);
  if (!Number.isSafeInteger(cents) || cents < 1 || cents > 100000000) {
    return { error: t(L(), 'goalRange') };
  }
  return { value: cents };
}

// ---- Guardado único: crea con datos o aplica diferencias ----
function saveFocusField(detail) {
  const d = String(detail ?? '').toLowerCase();
  if (d.includes('name') || d.includes('nombre')) return 'f-name';
  if (d.includes('descripci') || d.includes('description')) return 'f-desc';
  if (d.includes('price') || d.includes('precio') || d.includes('importe')) return 'f-price-text';
  if (d.includes('purpose') || d.includes('propósito')) return 'f-purpose';
  return null;
}
function diffPatch(form, draft, goalCents) {
  const p = {};
  const eq = (a, b) => (a ?? null) === (b ?? null);
  if (!eq(form.name.trim(), draft.name ?? '')) p.name = form.name.trim();
  if (!eq(form.description.trim(), draft.description ?? '')) p.description = form.description.trim();
  if (!eq(form.modality, draft.modality)) p.modality = form.modality;
  if (!eq(form.purpose.trim(), draft.purpose ?? '')) p.purpose = form.purpose.trim();
  const gd = Number.isInteger(draft.goalCents) ? draft.goalCents : null;
  if (goalCents !== null && goalCents !== gd) p.goalCents = goalCents;
  if (form.priceText.trim()) p.priceText = form.priceText.trim();
  else if (Number.isInteger(form.priceCents) && form.priceCents !== (Number.isInteger(draft.priceCents) ? draft.priceCents : null)) {
    p.priceCents = form.priceCents;
  }
  const img = form.imageRef || null;
  if (img !== (draft.imageRef ?? null)) p.imageRef = img;
  return p;
}
$('btn-save-continue').addEventListener('click', saveAndContinue);
async function saveAndContinue() {
  const ws = S.ws;
  if (!ws || ws.saving) return; // un solo guardado en curso
  formError(null);
  const f = ws.form;
  f.name = f.name.trim(); f.description = f.description.trim(); f.purpose = f.purpose.trim();
  writeForm();
  if (!f.name) { formError(t(L(), 'nameReq'), 'f-name'); return; }
  if (!f.description) { formError(t(L(), 'descReq'), 'f-desc'); return; }
  const goal = parseGoalUsdToCents(f.goalText);
  if (goal.error) { formError(goal.error, 'f-goal'); return; }
  const submitted = snapOf(f); // foto de lo enviado: lo escrito durante el vuelo se conserva
  ws.saving = true;
  $('btn-save-continue').disabled = true;
  $('draft-meta').textContent = t(L(), 'saving');
  try {
    if (!ws.draft) {
      const initial = { name: f.name, description: f.description };
      if (f.modality) initial.modality = f.modality;
      if (f.purpose) initial.purpose = f.purpose;
      if (goal.value !== null) initial.goalCents = goal.value;
      if (f.priceText.trim()) initial.priceText = f.priceText.trim();
      else if (Number.isInteger(f.priceCents)) initial.priceCents = f.priceCents;
      if (f.imageRef) initial.imageRef = f.imageRef;
      const { status, body } = await api('/api/drafts', { method: 'POST', body: JSON.stringify({ clientOpId: ws.opId, kind: ws.kind, initial }) });
      if (body.ok) { afterSave(body.draft, submitted); await goReview(); return; }
      formError(status === 0 ? t(L(), 'saveOffline') : t(L(), 'saveFail', { detail: body.detail || body.error }), status === 0 ? null : saveFocusField(body.detail || body.error));
      return; // misma opId: reintentar es seguro (idempotencia del servidor)
    }
    const patch = diffPatch(f, ws.draft, goal.value);
    if (!Object.keys(patch).length) { await goReview(); return; } // sin cambios: continuar
    const { status, body } = await api(`/api/drafts/${ws.draft.id}`, { method: 'PATCH', body: JSON.stringify({ baseRevision: ws.draft.revision, clientOpId: crypto.randomUUID(), patch }) });
    if (body.ok) { afterSave(body.draft, submitted); await goReview(); return; }
    if (status === 409 && body.conflict) { showConflict(body.conflict); return; }
    formError(status === 0 ? t(L(), 'saveOffline') : t(L(), 'saveFail', { detail: body.detail || body.error }), status === 0 ? null : saveFocusField(body.detail || body.error));
  } finally {
    ws.saving = false;
    $('btn-save-continue').disabled = false;
    renderWsStatus();
    if (isDirty()) $('draft-meta').textContent = t(L(), 'dirtyReview');
  }
}
// Integra lo guardado campo a campo: lo que no cambió durante el vuelo
// toma el valor del servidor; lo escrito mientras tanto se conserva.
function afterSave(draft, submitted) {
  const ws = S.ws;
  ws.draft = draft;
  const sent = JSON.parse(submitted);
  const cur = ws.form;
  const takeServer = (key, serverVal) => { if (cur[key] === sent[key]) cur[key] = serverVal; };
  takeServer('name', draft.name ?? '');
  takeServer('description', draft.description ?? '');
  takeServer('modality', draft.modality ?? null);
  takeServer('purpose', draft.purpose ?? '');
  takeServer('priceCents', Number.isInteger(draft.priceCents) ? draft.priceCents : null);
  takeServer('imageRef', draft.imageRef ?? '');
  if (cur.priceText === sent.priceText) cur.priceText = '';
  if (cur.goalText === sent.goalText) cur.goalText = '';
  ws.savedSnap = snapOf({ ...cur, priceText: '', goalText: '' });
  ws.opId = crypto.randomUUID();
  writeForm();
  loadDrafts();
  mirrorSave();
  renderRecover();
}
$('btn-cancel-form').addEventListener('click', () => {
  const ws = S.ws;
  if (!ws) return;
  if (!ws.draft) {
    const kind = ws.kind;
    closeWorkspace(); // sin persistencia: cancelar no crea filas
    showView(kind === 'initiative' ? 'initiative' : 'products', false);
    if (S.drafts.length === 0) document.querySelector('[data-nuevo]').focus();
    else (kind === 'initiative' ? $('btn-new-initiative') : $('btn-new')).focus();
    return;
  }
  ws.form = formFromDraft(ws.draft);
  ws.savedSnap = snapOf(ws.form);
  writeForm();
  closeWorkspace();
});
function showConflict(c) {
  S.ws.conflict = c;
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
  box.scrollIntoView({ block: 'nearest' });
}
async function resolveConflict(cid, choice) {
  const ws = S.ws;
  const { body } = await api(`/api/drafts/${ws.draft.id}/conflicts/${cid}/resolve`, {
    method: 'POST', body: JSON.stringify({ choice, clientOpId: crypto.randomUUID() }),
  });
  if (!body.ok) return;
  $('conflict').hidden = true;
  ws.conflict = null;
  ws.draft = body.draft;
  ws.form = formFromDraft(body.draft);
  ws.savedSnap = snapOf(ws.form);
  writeForm();
  ws.step = 1;
  renderSteps();
  renderWsStatus();
  loadDrafts();
}

// ---- Modo A: dictado (doble etiquetado); la propuesta rellena, no guarda ----
let recorder = null, recChunks = [], recTimer = null, recSecs = 0, recMime = '';
$('btn-rec').addEventListener('click', async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recMime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
    recorder = new MediaRecorder(stream, recMime ? { mimeType: recMime } : undefined);
    recChunks = [];
    recorder.ondataavailable = (e) => e.data.size && recChunks.push(e.data);
    recorder.onstop = () => stream.getTracks().forEach((tr) => tr.stop());
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
  api('/api/audio/intake', { method: 'POST', body: JSON.stringify({ mime, bytes, durationMs: recSecs * 1000 }) })
    .then(({ body }) => {
      $('rec-info').textContent = body.ok
        ? t(L(), 'recVerdict', { mime: mime || '?', verdict: body.verdict, reason: body.reason ?? '' })
        : t(L(), 'recRejected', { detail: body.detail ?? body.error });
    });
  recChunks = [];
}
$('btn-rec-stop').addEventListener('click', () => stopRec(false));
$('btn-rec-cancel').addEventListener('click', () => stopRec(true));
$('btn-transcribe').addEventListener('click', async () => {
  const ws = S.ws;
  if (!ws?.draft) return; // Hablar requiere borrador: disponible tras guardar
  const script = $('fake-script').value || t(L(), 'fakeScriptDefault');
  const tt = await api('/api/audio/transcribe', { method: 'POST', body: JSON.stringify({ script }) });
  const text = tt.body?.result?.transcript ?? '';
  const { body } = await api('/api/ai/propose', {
    method: 'POST', body: JSON.stringify({ draftId: ws.draft.id, baseRevision: ws.draft.revision, text }),
  });
  if (!body.ok) return;
  ws.proposal = { p: body.proposal, text };
  showProposal(body.proposal, text);
});
function pickInitiativePatch(patch) {
  const out = {};
  if (typeof patch?.name === 'string' && patch.name.trim()) out.name = patch.name;
  if (typeof patch?.description === 'string' && patch.description.trim()) out.description = patch.description;
  return Object.keys(out).length ? out : null;
}
function showProposal(p, text) {
  const ws = S.ws;
  const box = $('proposal');
  const isInit = ws.kind === 'initiative';
  box.hidden = false;
  box.innerHTML = `<span class="fake">${escapeHtml(t(L(), 'fakeBadge'))}</span>
    <p><strong>${escapeHtml(t(L(), 'proposalGot'))}</strong> ${escapeHtml(text)}</p>
    ${isInit ? `<p class="nota"><strong>${escapeHtml(t(L(), 'proposalInitNote'))}</strong></p>` : ''}
    <p><strong>${escapeHtml(t(L(), 'proposalTitle'))}</strong> ${escapeHtml(t(L(), 'proposalBase', { rev: p.baseRevision }))}${p.stale ? `<em>${escapeHtml(t(L(), 'proposalStale', { rev: p.currentRevision }))}</em>` : ''}:</p>
    <pre>${escapeHtml(JSON.stringify(p.patch, null, 2))}</pre>
    <p>${escapeHtml(t(L(), 'proposalMissing', { items: p.missing.join(', ') || t(L(), 'missingNone') }))}</p>
    <button id="pp-apply" class="big">${escapeHtml(t(L(), 'ppApplyFill'))}</button>
    <button id="pp-drop" class="big">${escapeHtml(t(L(), 'ppDrop'))}</button>`;
  $('pp-apply').addEventListener('click', () => {
    if (p.stale) { alert(t(L(), 'proposalStaleAlert')); return; }
    const patch = isInit ? pickInitiativePatch(p.patch) : p.patch;
    if (!patch || !Object.keys(patch).length) {
      if (isInit) alert(t(L(), 'proposalEmptyInit'));
      return;
    }
    const fill = {};
    if (typeof patch.name === 'string') fill.name = patch.name;
    if (typeof patch.description === 'string') fill.description = patch.description;
    if (!isInit && Number.isInteger(patch.priceCents)) fill.priceCents = patch.priceCents;
    setForm(fill);
    writeForm();
    ws.proposal = null;
    box.hidden = true;
    $('draft-meta').textContent = t(L(), 'appliedUnsaved');
  });
  $('pp-drop').addEventListener('click', () => { ws.proposal = null; box.hidden = true; });
}

// ---- Modo B: pasos que rellenan el mismo formulario ----
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
  return S.ws?.kind === 'initiative' ? qsInitiative() : qsProduct();
}
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
  const u = new SpeechSynthesisUtterance($('q-text').textContent);
  u.lang = L() === 'en' ? 'en-US' : 'es-ES';
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
});
$('btn-answer').addEventListener('click', () => {
  const ws = S.ws;
  if (!ws) return;
  const qs = currentQuestions();
  const q = qs[qIndex % qs.length];
  const v = $('q-answer').value.trim();
  if (!v) {
    if (q.optional) { qIndex += 1; askQuestion(); }
    return;
  }
  if (q.key === 'modality') {
    const m = normalizeModalityAnswer(v);
    if (!m) { $('q-text').textContent = `${t(L(), 'modalityGuide')} ${q.ask}`; $('q-answer').focus(); return; }
    setForm({ modality: m });
    qIndex += 1; askQuestion();
    return;
  }
  setForm({ [q.key === 'price' ? 'priceText' : q.key]: v });
  writeForm();
  qIndex += 1; askQuestion();
});

// ---- Revisión como vista previa + publicación ----
function coverFor(ref, kind) {
  if (ref && (ref.startsWith('/img/') || ref.startsWith('https://'))) return ref;
  return kind === 'initiative' ? '/img/portada-apoyo.svg' : '/img/portada-artesania.svg';
}
async function goReview() {
  const ws = S.ws;
  const { body } = await api(`/api/drafts/${ws.draft.id}/review`, { method: 'POST' });
  if (!body.ok) return;
  ws.review = body.review;
  ws.step = 2;
  renderSteps();
  renderPreview();
  $('review').focus({ preventScroll: true });
  $('review').scrollIntoView({ block: 'nearest' });
}
function renderPreview() {
  const ws = S.ws;
  const s = ws.review.snapshot;
  const isInit = ws.kind === 'initiative';
  const showPg = isInit && s.modality !== 'business';
  const faltan = faltanDe(pendingOf(s));
  $('review').setAttribute('tabindex', '-1');
  $('review').innerHTML = `<h3>${escapeHtml(t(L(), 'previewTitle'))}</h3>
    <img class="previa-portada" src="${escapeHtml(coverFor(s.imageRef, ws.kind))}" alt="${escapeHtml(t(L(), 'coverPreviewAlt'))}">
    ${isInit && s.modality ? `<p><span class="etiqueta-modalidad">${escapeHtml(modalityName(L(), s.modality))}</span></p>` : ''}
    <p class="previa-nombre"><strong>${escapeHtml(s.name ?? '—')}</strong></p>
    ${Number.isInteger(s.priceCents) && !isInit ? `<p class="precio">$${(s.priceCents / 100).toFixed(2)} USD</p>` : ''}
    <p>${escapeHtml(s.description ?? '')}</p>
    ${showPg && s.purpose ? `<h4>${escapeHtml(t(L(), 'purposeTitle'))}</h4><p>${escapeHtml(s.purpose)}</p>` : ''}
    ${showPg && Number.isInteger(s.goalCents) ? `<p><strong>${escapeHtml(t(L(), 'metaGoal'))}</strong> $${(s.goalCents / 100).toFixed(2)} USD</p>` : ''}
    ${isInit && s.modality && s.modality !== 'donations' ? `<p class="nota">${escapeHtml(t(L(), 'previewProdNote'))}</p>` : ''}`;
  $('review-missing').textContent = faltan.length
    ? t(L(), 'reviewMissing', { items: faltan.join(', ') })
    : t(L(), 'reviewReady');
}
$('btn-back-edit').addEventListener('click', () => {
  S.ws.step = 1;
  renderSteps();
  $('ws-title').focus({ preventScroll: true });
});
function hideResult() {
  $('publish-result').innerHTML = '';
  $('publish-result-estado').textContent = '';
}
$('btn-publish').addEventListener('click', async () => {
  const ws = S.ws;
  hideResult();
  if (!ws.review || isDirty()) {
    invalidateReview();
    return;
  }
  const { body } = await api(`/api/drafts/${ws.draft.id}/publish`, {
    method: 'POST',
    body: JSON.stringify({ reviewToken: ws.review.reviewToken, contentHash: ws.review.contentHash, clientOpId: crypto.randomUUID() }),
  });
  if (body.ok) {
    const pub = body.initiative ?? body.product;
    ws.lastPub = { kind: ws.kind, id: pub.id, name: pub.name, version: pub.version };
    ws.review = null;
    ws.step = 3;
    await loadDrafts();
    ws.draft = S.drafts.find((d) => d.id === ws.draft.id) ?? ws.draft;
    ws.form = formFromDraft(ws.draft);
    ws.savedSnap = snapOf(ws.form);
    writeForm();
    renderSteps();
    renderWsStatus();
    renderResult();
    if (S.view === 'share') renderShareList();
    return;
  }
  $('review-missing').textContent = t(L(), 'publishFail', { detail: body.detail || body.error });
});
function renderResult() {
  const ws = S.ws;
  const pub = ws.lastPub;
  $('publish-result').innerHTML = `<h3>${escapeHtml(t(L(), ws.kind === 'initiative' ? 'publishedInitMsg' : 'publishedProdMsg'))}</h3>
    <p><strong>${escapeHtml(pub.name ?? t(L(), 'draftNoName'))}</strong> (v${pub.version})</p>`;
  $('publish-result-estado').textContent = '';
  $('btn-descargar-qr').hidden = ws.kind !== 'initiative';
  $('btn-ver-pagina').onclick = async () => {
    location.href = ws.kind === 'initiative' ? resolveUrl(`/i/${pub.id}?lang=${L()}`) : resolveUrl('/#explorar');
  };
  $('btn-copiar-enlace').onclick = async () => {
    const url = await shareHrefFor(ws);
    try {
      await navigator.clipboard.writeText(url);
      $('publish-result-estado').textContent = t(L(), 'linkCopied');
    } catch {
      $('publish-result-estado').textContent = t(L(), 'copyFail', { url });
    }
  };
  $('btn-descargar-qr').onclick = () => downloadQr(pub.id, $('publish-result-estado'));
}
async function shareHrefFor(ws) {
  const pub = ws.lastPub;
  if (ws.kind === 'initiative' && pub?.id) {
    try {
      const { body } = await api(`/api/share/initiative/${encodeURIComponent(pub.id)}`);
      if (body?.ok && body.share) return resolveUrl(body.share.url ?? body.share.localPath);
    } catch { /* usa enlace local */ }
    return resolveUrl(`/i/${pub.id}`);
  }
  return resolveUrl('/#explorar');
}
function qrReasonText(reason) {
  if (reason === t('es', 'qrNoPublic')) return t(L(), 'qrNoPublic');
  if (reason === t('es', 'qrNoDep')) return t(L(), 'qrNoDep');
  return reason;
}
async function downloadQr(productId, estadoEl) {
  try {
    const { body } = await api(`/api/share/initiative/${encodeURIComponent(productId)}`);
    const qr = body?.share?.qr;
    if (body?.ok && qr?.available && qr.dataUrl) {
      const a = document.createElement('a');
      a.href = qr.dataUrl;
      a.download = `qr-iniciativa-${productId}.gif`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      estadoEl.textContent = t(L(), 'qrDownloaded');
      return;
    }
    estadoEl.textContent = qr?.reason ? qrReasonText(qr.reason) : t(L(), 'sumDown');
  } catch {
    estadoEl.textContent = t(L(), 'supportOffline');
  }
}

// ---- Vista Compartir: lo publicado con acciones ----
function renderShareList() {
  const box = $('share-list');
  if (!box) return;
  const pubs = S.drafts.filter((d) => d.published);
  if (!pubs.length) {
    box.innerHTML = `<p class="nota">${escapeHtml(t(L(), 'shareEmpty'))}</p>`;
    return;
  }
  box.innerHTML = pubs.map((d) => {
    const isInit = (d.kind ?? 'product') === 'initiative';
    return `<article class="ficha" data-share="${d.id}">
      <h3>${escapeHtml(draftName(d))} ${stateChip(d)}</h3>
      <div class="ctas">
        <button class="big" data-act="ver">${escapeHtml(t(L(), 'btnSeePage'))}</button>
        <button class="big" data-act="copiar">${escapeHtml(t(L(), 'copyLink'))}</button>
        ${isInit ? `<button class="big" data-act="qr">${escapeHtml(t(L(), 'qrDownload'))}</button>` : ''}
      </div>
      <p role="status" data-estado></p>
    </article>`;
  }).join('');
}
$('share-list').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const card = b.closest('[data-share]');
  const d = S.drafts.find((x) => x.id === card.dataset.share);
  if (!d?.published) return;
  const estado = card.querySelector('[data-estado]');
  const isInit = (d.kind ?? 'product') === 'initiative';
  const localUrl = isInit ? resolveUrl(`/i/${d.published.productId}?lang=${L()}`) : resolveUrl('/#explorar');
  if (b.dataset.act === 'ver') { location.href = localUrl; return; }
  if (b.dataset.act === 'copiar') {
    let url = localUrl;
    if (isInit) {
      try {
        const { body } = await api(`/api/share/initiative/${encodeURIComponent(d.published.productId)}`);
        if (body?.ok && body.share) url = resolveUrl(body.share.url ?? body.share.localPath);
      } catch { /* usa enlace local */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      estado.textContent = t(L(), 'linkCopied');
    } catch {
      estado.textContent = t(L(), 'copyFail', { url });
    }
    return;
  }
  if (b.dataset.act === 'qr' && isInit) downloadQr(d.published.productId, estado);
});

// ---- Apoyos del propietario ----
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
    if (status === 404 || !body?.ok) continue;
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

// ---- Idioma en vivo: re-renderiza sin tocar los campos ----
function refreshLang() {
  renderLists();
  if (S.view === 'share') renderShareList();
  if (S.apoyosLoaded && S.view === 'apoyos') cargarApoyos();
  const ws = S.ws;
  if (!ws) return;
  $('ws-title').textContent = ws.kind === 'initiative' ? t(L(), 'wsTitleInit') : t(L(), 'wsTitleProd');
  if (!ws.saving) {
    if (!ws.draft) $('draft-meta').textContent = '';
    else if (isDirty()) $('draft-meta').textContent = t(L(), 'dirtyReview');
  }
  renderMode();
  renderSteps();
  renderCoverCurrent();
  if (!$('conflict').hidden && ws.conflict) showConflict(ws.conflict);
  if (!$('proposal').hidden && ws.proposal) showProposal(ws.proposal.p, ws.proposal.text);
  if (ws.step === 2 && ws.review) renderPreview();
  if (ws.step === 3 && ws.lastPub) renderResult();
  const ans = $('q-answer').value;
  askQuestion();
  $('q-answer').value = ans;
}

// ---- Arranque ----
const getLang = initI18n(refreshLang);
if (new URLSearchParams(location.search).get('a') === 'registro') showTab('registro', false);
api('/api/auth/status').then(({ body: st }) => {
  if (!st.ok) return;
  api('/api/account/me').then(({ body }) => {
    enterApp(st.csrf, body?.user ? 'user' : 'legacy');
  });
});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});

