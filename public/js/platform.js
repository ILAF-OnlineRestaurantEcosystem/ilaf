// لوحة منصة CafeFlow: كل الكافيهات والمطاعم المشتركة، مشتركة بين أصحاب المنصة
import { $, $$, esc, moneyText, toast, openSheet, closeSheet, timeAgo, THEMES, themePref, setTheme } from './common.js';
import { icon } from './art.js';

const TOKEN_KEY = 'cf.platform.token';
// نسخة التجربة على الموقع الثابت (GitHub Pages): المنصة كلها بتشتغل بمتصفح الزائر بدون سيرفر
const DEMO = window.__CAFE_DEMO__?.platform ?? null;
const P = { token: null, me: null, tenants: [], filter: 'all', q: '', view: 'tenants' };

const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* */ } };

async function papi(path, { method = 'GET', body } = {}) {
  if (DEMO) {
    const r = await DEMO.api(path, { method, body, token: P.token });
    if (r.status === 401 && path !== '/login' && path !== '/setup') { signOut(); }
    if (r.status >= 400) throw Object.assign(new Error(r.data?.error || 'صار خطأ، جرب كمان مرة.'), { status: r.status });
    return r.data;
  }
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (P.token) headers['x-platform-token'] = P.token;
  let res;
  try {
    res = await fetch('/api/platform' + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error('ما في اتصال بالسيرفر. تأكد من الشبكة وجرب كمان مرة.');
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/login' && path !== '/setup') { signOut(); }
  if (!res.ok) throw Object.assign(new Error(data.error || 'صار خطأ، جرب كمان مرة.'), { status: res.status });
  return data;
}

// شعار CafeFlow: فنجان وبخار وموجة "فلو"
const LOGO = `<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="16" fill="var(--pf-mark)"/><path d="M17 27h25v9a12.5 12.5 0 0 1-25 0z" fill="none" stroke="#d4a359" stroke-width="3.4" stroke-linejoin="round"/><path d="M42 30h3.5a5 5 0 0 1 0 10H41" fill="none" stroke="#d4a359" stroke-width="3.2" stroke-linecap="round"/><path d="M23 21c0-4 4-4 4-8M30 21c0-4 4-4 4-8" fill="none" stroke="#f6ead4" stroke-width="2.6" stroke-linecap="round"/><path d="M13 52c6-3.5 12 3.5 18 0s12-3.5 18 0" fill="none" stroke="#d4a359" stroke-width="3" stroke-linecap="round"/></svg>`;

// ───────── الدخول ─────────
let setupMode = false;
async function showAuth() {
  $('#app').hidden = true;
  $('#auth').hidden = false;
  let info = { needsSetup: false };
  try { info = await papi('/info'); } catch (err) { $('#authErr').textContent = err.message; }
  setupMode = info.needsSetup;
  $('#keyField').hidden = !setupMode;
  $('#nameField').hidden = !setupMode;
  $('#authTitle').textContent = setupMode ? 'أهلاً بـ CafeFlow' : 'دخول المنصة';
  $('#authSub').textContent = setupMode
    ? 'أول مرة: اعمل حسابك (ID وكلمة سر)، وبعدين ضيف شريكك من قسم الفريق.'
    : 'لوحة تحكم المحلات المشتركة بـ CafeFlow';
  $('#authBtn').textContent = setupMode ? 'اعمل الحساب وادخل' : 'دخول';
  if (DEMO && !setupMode) {
    $('#authSub').textContent = `نسخة تجربة: ادخل بـ ${DEMO.login.username} وكلمة السر ${DEMO.login.password}`;
    $('#a_user').value = DEMO.login.username;
  }
  $('#a_pass').autocomplete = setupMode ? 'new-password' : 'current-password';
  (setupMode ? $('#a_key') : $('#a_user')).focus();
}
async function submitAuth(e) {
  e.preventDefault();
  const btn = $('#authBtn');
  btn.classList.add('is-busy');
  $('#authErr').textContent = '';
  try {
    const body = { username: $('#a_user').value, password: $('#a_pass').value };
    const r = setupMode
      ? await papi('/setup', { method: 'POST', body: { ...body, key: $('#a_key').value, name: $('#a_name').value } })
      : await papi('/login', { method: 'POST', body });
    P.token = r.token;
    write(TOKEN_KEY, r.token);
    P.me = r.user;
    $('#a_pass').value = '';
    await enterApp();
  } catch (err) {
    $('#authErr').textContent = err.message;
  } finally {
    btn.classList.remove('is-busy');
  }
}
function signOut() {
  P.token = null;
  write(TOKEN_KEY, null);
  showAuth();
}

// ───────── المنصة ─────────
async function enterApp() {
  $('#auth').hidden = true;
  $('#app').hidden = false;
  $('#meName').innerHTML = `${icon('user')}<span>${esc(P.me.name)}</span><small dir="ltr">@${esc(P.me.username)}</small>`;
  renderThemeBtn();
  if (DEMO && !$('.pf-demo')) {
    $('.pf-brand').insertAdjacentHTML('beforeend', '<span class="pf-demo" title="كل البيانات بمتصفحك بس">تجربة</span>');
    $('[data-pf="tenants"] .pf-head').insertAdjacentHTML('afterend', `<p class="pf-demo-note">${icon('sparkle')}<span>هاي <b>نسخة تجربة</b> بتشتغل بمتصفحك بس: جرّب تضيف محل، تفتح صفحة الزباين ولوحة الكاشير، وتجمّد حساب. البيانات ما بتوصل لحدا، والنسخة الحقيقية بتشتغل على سيرفر.</span></p>`);
  }
  setView(P.view);
  await loadTenants();
}
function setView(v) {
  P.view = v;
  $$('[data-pf]').forEach((s) => { s.hidden = s.dataset.pf !== v; });
  $$('[data-pf-view]').forEach((b) => { if (b.dataset.pfView === v) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  if (v === 'team') renderTeam();
}

async function loadTenants() {
  try {
    P.tenants = await papi('/tenants');
    renderTenants();
  } catch (err) { toast(err.message, 'err'); }
}
const frozen = (t) => t.status === 'suspended';
const typeIcon = (t) => (t.type === 'restaurant' ? 'utensils' : 'cup');
function renderTenants() {
  const all = P.tenants;
  const active = all.filter((t) => t.status === 'active');
  const sum = (f) => all.reduce((s, t) => s + (t.stats?.[f] ?? 0), 0);
  $('#tenantsSub').textContent = `${all.length} محل · ${active.length} شغّال${all.length - active.length ? ` · ${all.length - active.length} مجمّد` : ''}`;
  $('#kpis').innerHTML = [
    ['المحلات', all.length, `${all.filter((t) => t.type === 'cafe').length} كافيه · ${all.filter((t) => t.type === 'restaurant').length} مطعم`],
    ['طلبات اليوم', sum('todayOrders'), `${sum('openOrders')} مفتوحة هلق`],
    ['مبيعات الشهر', moneyText(sum('monthRevenue')), 'كل المحلات مع بعض'],
    ['ربح الشهر', moneyText(sum('monthProfit')), 'حسب تكاليف الأصناف'],
  ].map(([label, value, sub]) => `<div class="kpi"><span>${label}</span><strong>${value}</strong><small>${sub}</small></div>`).join('');

  const q = P.q.trim();
  const list = all.filter((t) => {
    if (P.filter === 'suspended' && t.status !== 'suspended') return false;
    if (['cafe', 'restaurant'].includes(P.filter) && t.type !== P.filter) return false;
    return !q || t.id.includes(q) || t.name.includes(q) || (t.ownerName ?? '').includes(q) || (t.ownerPhone ?? '').includes(q);
  });
  $('#tenantGrid').innerHTML = list.length ? list.map((t) => `
    <article class="pf-card ${frozen(t) ? 'is-frozen' : ''}">
      <header class="pf-card-head">
        <span class="pf-id" title="رقم المحل (ID)">#${esc(t.id)}</span>
        <span class="pf-type ${t.type}">${icon(typeIcon(t))}${esc(t.typeLabel)}</span>
        ${frozen(t) ? `<span class="badge badge-ice">${icon('snow')}مجمّد</span>` : '<span class="pf-live" title="شغّال"></span>'}
        <span class="pf-tools">
          ${frozen(t) ? '' : `<button class="icon-btn pf-freeze" type="button" data-freeze="${esc(t.id)}" aria-label="جمّد ${esc(t.name)}" title="تجميد الحساب">${icon('snow')}</button>`}
          <button class="icon-btn" type="button" data-edit-tenant="${esc(t.id)}" aria-label="تعديل ${esc(t.name)}" title="تعديل">${icon('edit')}</button>
        </span>
      </header>
      <h3>${esc(t.name)}</h3>
      <p class="muted">${t.ownerName ? esc(t.ownerName) : 'بدون صاحب مسجّل'}${t.ownerPhone ? ` · <span dir="ltr">${esc(t.ownerPhone)}</span>` : ''}</p>
      <div class="pf-stats">
        <div><b>${t.stats.todayOrders}</b><span>طلبات اليوم</span></div>
        <div><b>${moneyText(t.stats.monthRevenue)}</b><span>مبيعات الشهر</span></div>
        <div><b>${t.stats.openOrders}</b><span>مفتوحة هلق</span></div>
      </div>
      ${frozen(t) ? `<p class="pf-frozen">${icon('lock')}<span>مجمّد ${t.frozenAt ? timeAgo(t.frozenAt) : ''}${t.frozenBy ? ` على إيد @${esc(t.frozenBy)}` : ''}${t.frozenReason ? ` · ${esc(t.frozenReason)}` : ''}<br><small>الزباين والكاشير ما بيقدروا يفتحوا أي صفحة</small></span></p>` : ''}
      <p class="pf-last">${t.stats.lastOrderAt ? `آخر طلب ${timeAgo(t.stats.lastOrderAt)}` : 'لسا ما في طلبات'} · ${t.stats.items} صنف · ${t.stats.tables} طاولة</p>
      <footer class="pf-card-foot">
        ${frozen(t)
          ? `<button class="btn btn-brass btn-sm" type="button" data-unfreeze="${esc(t.id)}">${icon('unlock')}فك التجميد</button>`
          : `<button class="btn btn-brass btn-sm" type="button" data-open-admin="${esc(t.id)}">${icon('grid')}لوحة الكاشير</button>
        <a class="btn btn-ghost btn-sm" href="${esc(storeHref(t.id))}" target="_blank" rel="noopener">${icon('bag')}صفحة الزبائن</a>`}
      </footer>
    </article>`).join('') : `<div class="empty"><p>${all.length ? 'ما في محلات مطابقة.' : 'لسا ما في محلات. ضيف أول محل من الزر فوق.'}</p></div>`;
}

// ───────── نافذة ─────────
let editorSave = null;
function openEditor({ title, body, onSave, saveLabel = 'حفظ', extra = '' }) {
  $('#editorTitle').textContent = title;
  $('#editorForm').innerHTML = body + '<p class="form-err" id="formErr" role="alert"></p>';
  $('#editorFoot').innerHTML = `${extra}${onSave ? `<button class="btn btn-brass" type="button" id="editorSave">${icon('check')}${saveLabel}</button>` : ''}`;
  editorSave = onSave ? async () => {
    const btn = $('#editorSave');
    btn.classList.add('is-busy');
    try { await onSave(); } catch (err) { $('#formErr').textContent = err.message; } finally { btn.classList.remove('is-busy'); }
  } : null;
  if (onSave) $('#editorSave').onclick = editorSave;
  openSheet($('#editor'));
}
const val = (id) => $('#' + id)?.value ?? '';
const seg = (name, options, current) => `<div class="segmented" style="--n:${options.length}" role="group">${options.map(([v, l]) => `<button type="button" data-seg="${name}" data-v="${v}" aria-pressed="${v === current}">${l}</button>`).join('')}</div>`;
const segVal = (name) => $(`[data-seg="${name}"][aria-pressed="true"]`)?.dataset.v;
const randomPin = () => String(Math.floor(1000 + Math.random() * 9000));
// روابط صفحات المحل: على السيرفر /1001 و /1001/admin، وبنسخة التجربة customer.html?store=…
const storeHref = (id, admin = false) => (DEMO ? DEMO.storeUrl(id, admin) : `/${id}${admin ? '/admin' : ''}`);
const links = (id) => ({ customer: new URL(storeHref(id), location.href).href, admin: new URL(storeHref(id, true), location.href).href });
function qrSvg(url) {
  if (typeof window.qrcode !== 'function') return '';
  const q = window.qrcode(0, 'M');
  q.addData(url);
  q.make();
  return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
}
function linksBlock(id, pin = null) {
  const l = links(id);
  return `
    <div class="pf-links">
      <div class="pf-qr">${qrSvg(l.customer)}</div>
      <div class="pf-link-rows">
        <div class="pf-link"><span>رقم المحل (ID)</span><b dir="ltr">${esc(id)}</b></div>
        <div class="pf-link"><span>رابط الزبائن (والـ QR)</span><code dir="ltr">${esc(l.customer)}</code><button class="btn btn-quiet btn-sm" type="button" data-copy="${esc(l.customer)}">${icon('clipboard')}انسخ</button></div>
        <div class="pf-link"><span>لوحة الكاشير</span><code dir="ltr">${esc(l.admin)}</code><button class="btn btn-quiet btn-sm" type="button" data-copy="${esc(l.admin)}">${icon('clipboard')}انسخ</button></div>
        ${pin ? `<div class="pf-link"><span>رمز دخول الكاشير</span><b dir="ltr">${esc(pin)}</b></div>` : ''}
      </div>
    </div>`;
}

function openNewTenant() {
  openEditor({
    title: 'محل جديد',
    saveLabel: 'اعمل المحل',
    body: `
      <div class="form-grid">
        <label class="field full"><span>اسم المحل</span><input class="input" id="t_name" maxlength="40" placeholder="مثلاً: كافي البحر / مطعم السرايا"></label>
        <div class="field full"><span>نوع المحل</span>${seg('ttype', [['cafe', 'كافيه'], ['restaurant', 'مطعم']], 'cafe')}</div>
        <label class="field"><span>صاحب المحل</span><input class="input" id="t_owner" maxlength="40"></label>
        <label class="field"><span>تلفونه</span><input class="input" id="t_phone" maxlength="20" inputmode="tel" dir="ltr"></label>
        <label class="field"><span>رمز دخول الكاشير (4–8 أرقام)</span><input class="input" id="t_pin" maxlength="8" inputmode="numeric" dir="ltr" value="${randomPin()}"></label>
        <label class="field"><span>ملاحظات (لإلكم بس)</span><input class="input" id="t_notes" maxlength="300" placeholder="مثلاً: اشتراك شهري"></label>
      </div>
      <label class="switch" style="margin-top:6px"><input type="checkbox" id="t_demo"><span class="track"></span>حط طلبات تجريبية (للعرض على الزبون بس)</label>
      <p class="muted" style="margin-top:8px">المحل بيبلّش بقائمة جاهزة حسب نوعه (كافيه أو مطعم)، وصاحبه بيعدّلها من لوحة الكاشير.</p>`,
    onSave: async () => {
      const t = await papi('/tenants', { method: 'POST', body: {
        name: val('t_name'), type: segVal('ttype'), ownerName: val('t_owner'), ownerPhone: val('t_phone'),
        pin: val('t_pin'), notes: val('t_notes'), demo: $('#t_demo').checked,
      } });
      P.tenants.push(t);
      renderTenants();
      openEditor({
        title: `انعمل "${t.name}" ✓`,
        body: `<p class="muted">ابعت لصاحب المحل رابط لوحة الكاشير والرمز، واطبع الـ QR لطاولاته.</p>${linksBlock(t.id, t.pin)}`,
      });
    },
  });
}

function openEditTenant(id) {
  const t = P.tenants.find((x) => x.id === id);
  if (!t) return;
  openEditor({
    title: `${t.name} · #${t.id}`,
    saveLabel: 'احفظ',
    body: `
      ${linksBlock(t.id)}
      <div class="form-grid">
        <label class="field full"><span>اسم المحل</span><input class="input" id="t_name" maxlength="40" value="${esc(t.name)}"></label>
        <div class="field full"><span>نوع المحل</span>${seg('ttype', [['cafe', 'كافيه'], ['restaurant', 'مطعم']], t.type)}</div>
        <label class="field"><span>صاحب المحل</span><input class="input" id="t_owner" maxlength="40" value="${esc(t.ownerName ?? '')}"></label>
        <label class="field"><span>تلفونه</span><input class="input" id="t_phone" maxlength="20" inputmode="tel" dir="ltr" value="${esc(t.ownerPhone ?? '')}"></label>
        <label class="field"><span>رمز كاشير جديد (اتركه فاضي إذا ما بدك تغيّره)</span><input class="input" id="t_pin" maxlength="8" inputmode="numeric" dir="ltr" autocomplete="off"></label>
        <label class="field"><span>ملاحظات (لإلكم بس)</span><input class="input" id="t_notes" maxlength="300" value="${esc(t.notes ?? '')}"></label>
      </div>
      <label class="switch" style="margin-top:6px"><input type="checkbox" id="t_active" ${t.status === 'active' ? 'checked' : ''}><span class="track"></span>الحساب شغّال (إذا طفيته بيتجمّد: الزباين والكاشير ما بيقدروا يوصلوا)</label>
      <p class="muted" style="margin-top:8px">انعمل ${new Date(t.createdAt).toLocaleDateString('en-GB')}${t.createdBy && t.createdBy !== 'system' ? ` على إيد @${esc(t.createdBy)}` : ''}</p>`,
    onSave: async () => {
      const pin = val('t_pin').trim();
      if (pin) await papi(`/tenants/${t.id}/pin`, { method: 'POST', body: { pin } });
      const updated = await papi(`/tenants/${t.id}`, { method: 'PATCH', body: {
        name: val('t_name'), type: segVal('ttype'), ownerName: val('t_owner'), ownerPhone: val('t_phone'), notes: val('t_notes'),
        status: $('#t_active').checked ? 'active' : 'suspended',
      } });
      Object.assign(t, updated);
      renderTenants();
      closeSheet($('#editor'));
      toast(pin ? 'انحفظ، والرمز الجديد صار شغّال' : 'انحفظ', 'ok');
    },
  });
}

// ───────── تجميد الحساب ─────────
function openFreeze(id) {
  const t = P.tenants.find((x) => x.id === id);
  if (!t) return;
  openEditor({
    title: `تجميد ${t.name} · #${t.id}`,
    saveLabel: 'جمّد الحساب',
    body: `
      <div class="pf-freeze-info">${icon('snow')}<div>
        <p><b>شو بيصير لما تجمّده؟</b></p>
        <ul>
          <li>صفحة الزباين ولوحة الكاشير بيتسكّروا، وبيطلعلهم "الحساب مجمّد".</li>
          <li>اللي فاتحين الصفحة هلق بتتسكّر عندهم بنفس اللحظة، والكاشير بيطلع من حسابه.</li>
          <li>البيانات (المنيو والطلبات والتقارير) بتضل محفوظة زي ما هي، وبترجع كلها لما تفك التجميد.</li>
        </ul></div></div>
      <label class="field"><span>السبب (لإلكم بس، اختياري)</span><input class="input" id="f_reason" maxlength="120" placeholder="مثلاً: الاشتراك مش مدفوع"></label>`,
    onSave: async () => {
      Object.assign(t, await papi(`/tenants/${t.id}/freeze`, { method: 'POST', body: { reason: val('f_reason') } }));
      renderTenants();
      closeSheet($('#editor'));
      toast(`${t.name} انجمّد ❄️`, 'ok');
    },
  });
}
async function unfreeze(id, btn) {
  const t = P.tenants.find((x) => x.id === id);
  if (!t) return;
  btn?.classList.add('is-busy');
  try {
    const updated = await papi(`/tenants/${t.id}/unfreeze`, { method: 'POST' });
    delete t.frozenAt; delete t.frozenBy; delete t.frozenReason;
    Object.assign(t, updated);
    renderTenants();
    toast(`${t.name} رجع شغّال ✓`, 'ok');
  } catch (err) { toast(err.message, 'err'); } finally { btn?.classList.remove('is-busy'); }
}

async function openAdmin(id, btn) {
  btn?.classList.add('is-busy');
  // النافذة لازم تنفتح بنفس الضغطة (المتصفح بيمنع النوافذ بعد انتظار)
  const win = window.open('about:blank', '_blank');
  try {
    const { token } = await papi(`/tenants/${id}/session`, { method: 'POST' });
    const url = `${storeHref(id, true)}#cf=${token}`;
    if (win) win.location.href = url; else location.href = url;
  } catch (err) {
    win?.close();
    toast(err.message, 'err');
  } finally { btn?.classList.remove('is-busy'); }
}

// ───────── الفريق ─────────
async function renderTeam() {
  try {
    const users = await papi('/users');
    $('#team').innerHTML = users.map((u) => `
      <div class="pf-member">
        <span class="pf-avatar">${esc(u.name.slice(0, 1))}</span>
        <div><b>${esc(u.name)}</b><small dir="ltr">@${esc(u.username)}</small></div>
        ${u.id === P.me.id ? '<span class="badge badge-gold">إنت</span>' : `<button class="btn btn-quiet btn-sm btn-danger" type="button" data-del-user="${esc(u.id)}">${icon('trash')}احذف</button>`}
      </div>`).join('');
  } catch (err) { toast(err.message, 'err'); }
}
function openNewUser() {
  openEditor({
    title: 'ضيف شريك للمنصة',
    saveLabel: 'ضيف',
    body: `
      <p class="muted">بيشوف كل المحلات ويقدر يضيف ويعدّل متلك بالضبط.</p>
      <div class="form-grid">
        <label class="field"><span>اسمه</span><input class="input" id="u_name" maxlength="40"></label>
        <label class="field"><span>اسم المستخدم (ID) بالإنجليزي</span><input class="input" id="u_user" maxlength="24" dir="ltr" autocomplete="off" placeholder="ahmad"></label>
        <label class="field full"><span>كلمة سر مؤقتة (6 أحرف أو أكثر، وبيغيّرها هو بعدين)</span><input class="input" id="u_pass" type="text" dir="ltr" autocomplete="off"></label>
      </div>`,
    onSave: async () => {
      const u = await papi('/users', { method: 'POST', body: { name: val('u_name'), username: val('u_user'), password: val('u_pass') } });
      closeSheet($('#editor'));
      toast(`انضاف @${u.username} ✓ ابعتله رابط المنصة وكلمة السر`, 'ok');
      renderTeam();
    },
  });
}

function renderThemeBtn() {
  const [, label, ic] = THEMES.find(([k]) => k === themePref()) ?? THEMES[2];
  $('#themeBtn').innerHTML = icon(ic);
  $('#themeBtn').title = `المظهر: ${label}`;
}

function bind() {
  $('#authForm').addEventListener('submit', submitAuth);
  $('#pwForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await papi('/me/password', { method: 'POST', body: { current: $('#pw_cur').value, next: $('#pw_new').value } });
      $('#pw_cur').value = '';
      $('#pw_new').value = '';
      toast('تغيّرت كلمة السر ✓', 'ok');
    } catch (err) { toast(err.message, 'err'); }
  });
  $('#tSearch').addEventListener('input', (e) => { P.q = e.target.value; renderTenants(); });
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('button, a');
    if (!b) return;
    const d = b.dataset;
    if (d.seg) { $$(`[data-seg="${d.seg}"]`).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); return; }
    if (d.f) { P.filter = d.f; $$('#tFilter [data-f]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); return renderTenants(); }
    if (d.pfView) return setView(d.pfView);
    if (d.openAdmin) return openAdmin(d.openAdmin, b);
    if (d.editTenant) return openEditTenant(d.editTenant);
    if (d.freeze) return openFreeze(d.freeze);
    if (d.unfreeze) return unfreeze(d.unfreeze, b);
    if (d.copy) {
      try { await navigator.clipboard.writeText(d.copy); toast('انسخ ✓', 'ok'); } catch { toast(d.copy); }
      return;
    }
    if (d.delUser) {
      if (b.dataset.armed !== '1') { b.dataset.armed = '1'; b.innerHTML = `${icon('trash')}متأكد؟`; setTimeout(() => { if (b.isConnected) { b.dataset.armed = ''; b.innerHTML = `${icon('trash')}احذف`; } }, 4000); return; }
      try { await papi(`/users/${d.delUser}`, { method: 'DELETE' }); renderTeam(); } catch (err) { toast(err.message, 'err'); }
      return;
    }
    if (b.id === 'newTenant') return openNewTenant();
    if (b.id === 'newUser') return openNewUser();
    if (b.id === 'logoutBtn') { try { await papi('/logout', { method: 'POST' }); } catch { /* */ } return signOut(); }
    if (b.id === 'themeBtn') {
      const keys = THEMES.map(([k]) => k);
      setTheme(keys[(keys.indexOf(themePref()) + 1) % keys.length]);
      return renderThemeBtn();
    }
  });
  // الأرقام بتتحدّث كل دقيقة
  setInterval(() => { if (P.token && P.view === 'tenants' && !document.hidden) loadTenants(); }, 60_000);
}

async function boot() {
  $$('[data-logo]').forEach((el) => { el.innerHTML = LOGO; });
  $$('[data-icon]').forEach((el) => { el.innerHTML = icon(el.dataset.icon); });
  $('#editorClose').innerHTML = icon('close');
  $('#newTenant').innerHTML = `${icon('plus')}محل جديد`;
  $('#newUser').innerHTML = `${icon('plus')}ضيف شريك`;
  bind();
  if (DEMO) await DEMO.ready; // حساب التجربة بيدخل لحاله
  P.token = read(TOKEN_KEY);
  if (!P.token) return showAuth();
  try {
    P.me = await papi('/me');
    await enterApp();
  } catch { showAuth(); }
}
boot();
