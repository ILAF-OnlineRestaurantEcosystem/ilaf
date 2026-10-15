import { $, $$, esc, api, money, moneyText, toast, openSheet, closeSheet, chime, unlockAudio, timeAgo, STATUS, SUGAR, THEMES, themePref, setTheme } from './common.js';
import { brandLogo, fitLogo, brandMark, artTile, itemArt, icon, ART_KEYS, ART_LABELS } from './art.js';

const S = {
  token: null,
  data: null,          // settings, categories, items, offers, zones, tables
  orders: [],          // الطلبات المفتوحة
  calls: [],
  view: 'floor',
  sound: true,
  selected: null,
  menuCat: 'all',
  search: '',
  month: null, // الشهر المعروض بالتقارير (2026-10)
  report: null,
  justIn: new Set(),
  unseen: 0,
  socket: null,
};
const relay = window.__CAFE_DEMO__?.relay ?? null;
const store = {
  get(k) { try { return localStorage.getItem('cm.admin.' + k); } catch { return null; } },
  set(k, v) { try { if (v == null) localStorage.removeItem('cm.admin.' + k); else localStorage.setItem('cm.admin.' + k, v); } catch { /* */ } },
};
const cur = () => S.data?.settings.currency ?? '₪';
const itemById = (id) => S.data.items.find((i) => i.id === id);
const zoneById = (id) => S.data.zones.find((z) => z.id === id);
const OPEN = ['new', 'preparing', 'ready', 'served'];
const TAKEAWAY = 0; // الطلب الخارجي بيتسجّل على "طاولة 0"
const placeLabel = (o) => (o.table === TAKEAWAY ? `طلب خارجي${o.takeaway?.name ? ` · ${o.takeaway.name}` : ''}` : `طاولة ${o.table}`);
const NEXT = { new: ['preparing', 'ابدأ التحضير'], preparing: ['ready', 'جاهز'], ready: ['served', 'تم التقديم'] };

async function call(path, opts = {}) {
  try {
    return await api('/admin' + path, { ...opts, token: S.token });
  } catch (err) {
    if (err.status === 401 && path !== '/login') { logout(true); }
    throw err;
  }
}

// ───────── الدخول ─────────
let pin = '';
function showLogin(message = '') {
  $('#app').hidden = true;
  $('#login').hidden = false;
  $('#loginLogo').innerHTML = brandLogo({ word: 'محمد', prefix: 'كافي', mode: 'static' });
  fitLogo($('#loginLogo svg'));
  $('#pinPad').innerHTML = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button type="button" data-pin="${n}">${n}</button>`).join('')
    + `<button type="button" data-pin="back" aria-label="حذف">${icon('arrow')}</button><button type="button" data-pin="0">0</button><button type="button" data-pin="ok" aria-label="دخول">${icon('check')}</button>`;
  pin = '';
  renderPin();
  $('#loginErr').textContent = message;
}
function renderPin() {
  $('#pinDots').innerHTML = Array.from({ length: Math.max(4, pin.length) }, (_, i) => `<i class="${i < pin.length ? 'on' : ''}"></i>`).join('');
}
async function tryLogin() {
  if (pin.length < 4) { $('#loginErr').textContent = 'الرمز من 4 أرقام على الأقل'; return; }
  unlockAudio();
  try {
    const { token } = await api('/admin/login', { method: 'POST', body: { pin } });
    S.token = token;
    store.set('token', token);
    $('#login').hidden = true;
    await boot();
  } catch (err) {
    pin = '';
    renderPin();
    const dots = $('#pinDots');
    dots.classList.remove('shake'); void dots.offsetWidth; dots.classList.add('shake');
    $('#loginErr').textContent = err.message;
  }
}
async function logout(expired = false) {
  if (!expired) call('/logout', { method: 'POST' }).catch(() => {});
  S.token = null;
  store.set('token', null);
  S.socket?.disconnect();
  closeDrawer();
  showLogin(expired ? 'انتهت الجلسة، ادخل من جديد.' : '');
}

// ───────── الهيكل ─────────
const VIEWS = [
  { id: 'floor', label: 'الصالة', ic: 'grid' },
  { id: 'orders', label: 'الطلبات', ic: 'list' },
  { id: 'menu', label: 'القائمة', ic: 'menu' },
  { id: 'offers', label: 'العروض', ic: 'tag' },
  { id: 'tables', label: 'الطاولات', ic: 'table' },
  { id: 'reports', label: 'التقارير', ic: 'chart' },
  { id: 'settings', label: 'الإعدادات', ic: 'gear' },
];
// المظهر: الزر بيلف فاتح ← غامق ← تلقائي
function renderThemeBtn() {
  const [, label, ic] = THEMES.find(([k]) => k === themePref()) ?? THEMES[2];
  $('#themeBtn').innerHTML = icon(ic);
  $('#themeBtn').title = `المظهر: ${label} (اضغط للتغيير)`;
  $('#themeBtn').setAttribute('aria-label', `المظهر: ${label}`);
}
function cycleTheme() {
  const keys = THEMES.map(([k]) => k);
  setTheme(keys[(keys.indexOf(themePref()) + 1) % keys.length]);
  renderThemeBtn();
  toast(`المظهر: ${THEMES.find(([k]) => k === themePref())[1]}`, 'ok');
  if (S.view === 'settings') renderSettings();
}

function renderShell() {
  const s = S.data.settings;
  renderThemeBtn();
  document.title = `لوحة الكاشير — ${s.cafeName}`;
  $('#sideBrand').innerHTML = `${brandMark(s.cafeName)}<small>لوحة الكاشير</small>`;
  renderNav();
  renderSoundBtn();
  $('#openMenu').innerHTML = `${icon('bag')}<span>صفحة الزبون</span>`;
  if (relay) $('#openMenu').href = customerLink();
  $('#logoutBtn').innerHTML = `${icon('logout')}<span>خروج</span>`;
  $('#closeShopBtn').innerHTML = `${icon('lock')}<span>إغلاق المحل</span>`;
  $('#editorClose').innerHTML = icon('close');
  $('#addItem').innerHTML = `${icon('plus')}صنف جديد`;
  $('#addCategory').innerHTML = `${icon('plus')}قسم`;
  $('#addOffer').innerHTML = `${icon('plus')}عرض جديد`;
  $('#addZone').innerHTML = `${icon('plus')}منطقة`;
  $('#printCards').innerHTML = `${icon('printer')}اطبع كروت الـ QR`;
  $$('[data-new-order]').forEach((b) => { b.innerHTML = `${icon('plus')}طلب جديد`; });
  $('#copyLink').innerHTML = `${icon('clipboard')}انسخ الرابط`;
  $('#legend').innerHTML = [
    ['var(--gold)', 'طلب جديد'], ['var(--amber)', 'قيد التحضير'], ['var(--seaglass)', 'جاهز'], ['var(--brass)', 'تم التقديم'], ['var(--coral)', 'نداء نادل'],
  ].map(([c, l]) => `<span><i style="background:${c}"></i>${l}</span>`).join('');
}
function renderNav() {
  const newCount = S.orders.filter((o) => o.status === 'new').length;
  $('#sideNav').innerHTML = VIEWS.map((v) => {
    let badge = '';
    if (v.id === 'floor' && S.calls.length) badge = `<span class="nav-count coral">${S.calls.length}</span>`;
    if (v.id === 'orders' && newCount) badge = `<span class="nav-count">${newCount}</span>`;
    return `<button class="nav-btn" type="button" data-view-btn="${v.id}" ${S.view === v.id ? 'aria-current="page"' : ''}>${icon(v.ic)}<span>${v.label}</span>${badge}</button>`;
  }).join('');
}
function renderSoundBtn() {
  const b = $('#soundBtn');
  b.innerHTML = S.sound ? `${icon('sound')}<span>الصوت شغّال</span>` : `${icon('mute')}<span>الصوت مطفي</span>`;
  b.classList.toggle('is-off', !S.sound);
}
function setView(id) {
  S.view = id;
  store.set('view', id);
  $$('.view').forEach((v) => { v.hidden = v.dataset.view !== id; });
  const v = VIEWS.find((x) => x.id === id);
  $('#viewTitle').textContent = v.label;
  renderNav();
  renderView();
  if (id !== 'floor') closeDrawer();
}
function renderView() {
  const subs = {
    floor: `${S.data.tables.length} طاولة · ${S.orders.length} طلب مفتوح`,
    orders: 'اسحب الطلب من مرحلة لمرحلة بكبسة زر',
    menu: `${S.data.items.length} صنف في ${S.data.categories.length} أقسام`,
    offers: `${S.data.offers.filter((o) => o.active).length} عرض فعّال`,
    tables: `${S.data.zones.length} مناطق · ${S.data.tables.length} طاولة`,
    reports: 'تقرير كل شهر بأرباحه، وملف PDF جاهز',
    settings: 'اسم المحل والهوية والطقس والرمز',
  };
  $('#viewSub').textContent = subs[S.view] ?? '';
  ({ floor: renderFloor, orders: renderKanban, menu: renderMenuView, offers: renderOffers, tables: renderTablesView, reports: renderReports, settings: renderSettings })[S.view]?.();
}

let statsTimer;
async function refreshBarStats() {
  clearTimeout(statsTimer);
  statsTimer = setTimeout(async () => {
    try {
      const st = await call('/stats?range=today');
      $('#barStats').innerHTML = `
        <span class="stat-pill">طلبات اليوم <span class="num">${st.orders}</span></span>
        <span class="stat-pill">إيراد اليوم ${money(st.revenue, cur())}</span>
        <span class="stat-pill profit">ربح اليوم ${money(st.profit, cur())}</span>`;
    } catch { /* */ }
  }, 300);
}

// ───────── الصالة ─────────
function tableState(n) {
  const os = S.orders.filter((o) => o.table === n);
  const calls = S.calls.filter((c) => c.table === n);
  const st = ['new', 'ready', 'preparing', 'served'].find((s) => os.some((o) => o.status === s)) ?? null;
  return { os, calls, st };
}
function tileHtml(t) {
  const { os, calls, st } = tableState(t.number);
  const items = os.reduce((s, o) => s + o.lines.reduce((a, l) => a + l.qty, 0), 0);
  const total = os.reduce((s, o) => s + o.total, 0);
  const oldest = os.map((o) => o.createdAt).sort()[0];
  const label = st ? STATUS[st].label : calls.length ? '' : 'فاضية';
  const callLabel = calls.some((c) => c.kind === 'bill') ? 'طالب الحساب' : calls.length ? 'نداء نادل' : '';
  return `
    <button class="tile ${st ? 't-' + st : ''} ${calls.length ? 'has-call' : ''} ${S.justIn.has(t.number) ? 'just-in' : ''} ${S.selected === t.number ? 'is-selected' : ''}" type="button" data-table="${t.number}" aria-label="طاولة ${t.number}">
      ${S.justIn.has(t.number) ? '<span class="ripple"></span><span class="ripple"></span><span class="ripple"></span>' : ''}
      ${calls.length ? `<span class="tile-call" title="${callLabel}">${icon(calls.some((c) => c.kind === 'bill') ? 'receipt' : 'bell')}</span>` : ''}
      <span class="tile-no">${t.number}</span>
      <span>
        <span class="tile-state">${callLabel && !st ? callLabel : label}</span>
        ${os.length ? `<span class="tile-meta">${items} صنف · ${moneyText(total, cur())} · ${timeAgo(oldest)}</span>` : ''}
      </span>
    </button>`;
}
function takeawayTile() {
  const os = S.orders.filter((o) => o.table === TAKEAWAY);
  const st = ['new', 'ready', 'preparing', 'served'].find((s) => os.some((o) => o.status === s)) ?? null;
  const total = os.reduce((s, o) => s + o.total, 0);
  return `
    <button class="tile tile-takeaway ${st ? 't-' + st : ''} ${S.justIn.has(TAKEAWAY) ? 'just-in' : ''} ${S.selected === TAKEAWAY ? 'is-selected' : ''}" type="button" data-table="${TAKEAWAY}" aria-label="الطلبات الخارجية">
      ${S.justIn.has(TAKEAWAY) ? '<span class="ripple"></span><span class="ripple"></span><span class="ripple"></span>' : ''}
      <span class="tile-no">${icon('bag')}</span>
      <span>
        <span class="tile-state">${os.length ? `${os.length} طلب خارجي` : 'طلبات خارجية'}</span>
        <span class="tile-meta">${os.length ? `${STATUS[st]?.label ?? ''} · ${moneyText(total, cur())}` : 'تيك أواي · ما في هلق'}</span>
      </span>
    </button>`;
}
function renderFloor() {
  const byZone = S.data.zones.map((z) => ({ z, tables: S.data.tables.filter((t) => t.zoneId === z.id) })).filter((g) => g.tables.length);
  $('#floor').innerHTML = `
    <section class="zone">
      <header class="zone-title"><h2>طلبات خارجية</h2><p>تيك أواي بدون طاولة</p></header>
      <div class="tiles">${takeawayTile()}</div>
    </section>` + byZone.map(({ z, tables }) => `
    <section class="zone">
      <header class="zone-title"><h2>${esc(z.name)}</h2><p>${tables.length} طاولة · ${tables.filter((t) => tableState(t.number).os.length).length} مشغولة</p></header>
      <div class="tiles">${tables.map(tileHtml).join('')}</div>
    </section>`).join('');
  const newCount = S.orders.filter((o) => o.status === 'new').length;
  $('#floorAlerts').innerHTML = [
    newCount ? `<span class="badge badge-brass">${newCount} طلب جديد</span>` : '',
    S.calls.length ? `<span class="badge badge-coral">${S.calls.length} نداء</span>` : '',
    S.orders.filter((o) => o.status === 'ready').length ? `<span class="badge badge-sea">${S.orders.filter((o) => o.status === 'ready').length} جاهز للتقديم</span>` : '',
  ].join('');
}

// ───────── لوح الطاولة ─────────
function orderCard(o, { inKanban = false } = {}) {
  const takeaway = o.table === TAKEAWAY;
  // الطلب الخارجي: بعد ما يجهز بينسلّم وبينحسب لحاله
  const next = takeaway && ['ready', 'served'].includes(o.status) ? ['paid', 'سلّمته وانحسب'] : NEXT[o.status];
  return `
    <article class="ocard s-${o.status}" ${inKanban ? `data-table="${o.table}"` : ''}>
      <div class="ocard-head">
        <span class="num">#${o.no}</span>
        ${inKanban ? (takeaway ? `<span class="badge badge-gold">${icon('bag')}خارجي</span>` : `<span class="badge badge-mute">طاولة <span class="num" style="font-size:13px">${o.table}</span></span>`) : ''}
        <span class="status-pill ${o.status}">${STATUS[o.status].label}</span>
        ${o.source === 'barista' ? `<span class="badge badge-brass" title="الطلب اقترحه الباريستا الذكي">${icon('sparkle')}باريستا</span>` : ''}
        ${o.source === 'cashier' ? `<span class="badge badge-mute" title="الكاشير أدخل الطلب">كاشير</span>` : ''}
        ${o.edited ? `<span class="badge badge-mute" title="الكاشير عدّل الطلب">معدّل</span>` : ''}
        <time datetime="${o.createdAt}">${timeAgo(o.createdAt)}</time>
      </div>
      ${takeaway && (o.takeaway?.name || o.takeaway?.phone) ? `<p class="takeaway-who">${icon('user')}<b>${esc(o.takeaway.name || 'زبون')}</b>${o.takeaway.phone ? ` · <span dir="ltr">${esc(o.takeaway.phone)}</span>` : ''}</p>` : ''}
      <div class="olines">
        ${o.lines.map((l, i) => `
          <div class="oline"><span class="qty">${l.qty}×</span>
            <span>${esc(l.name)}${l.options?.sugar ? `<small>${SUGAR[l.options.sugar]}</small>` : ''}${l.parts ? `<small>${esc(l.parts.join(' + '))}</small>` : ''}${l.note ? `<small style="color:var(--amber)">${esc(l.note)}</small>` : ''}${l.origUnitPrice != null ? `<small class="disc-note">خصم: ${moneyText(l.origUnitPrice, cur())} ← ${moneyText(l.unitPrice, cur())} للقطعة</small>` : ''}</span>
            ${inKanban ? '' : `<span class="oline-price"><span>${l.origUnitPrice != null ? `<s>${moneyText(l.origUnitPrice * l.qty, cur())}</s> ` : ''}${money(l.lineTotal, cur())}</span>
              ${OPEN.includes(o.status) ? `<button class="disc-btn" type="button" data-disc="${o.id}" data-idx="${i}" title="خصم على هالصنف بهالفاتورة بس">${icon('tag')}خصم</button>` : ''}</span>`}
          </div>`).join('')}
      </div>
      ${inKanban ? '' : `<div class="ocard-total"><span>مجموع الطلب</span><span>${o.manualDiscount ? `<small>خصم ${moneyText(o.manualDiscount, cur())}</small> ` : ''}${money(o.total, cur())}</span></div>`}
      ${o.note ? `<p class="onote">${esc(o.note)}</p>` : ''}
      <div class="oactions">
        ${next ? `<button class="btn ${o.status === 'new' ? 'btn-brass' : 'btn-ghost'} btn-sm" type="button" data-advance="${o.id}" data-to="${next[0]}">${icon(next[0] === 'served' ? 'check' : next[0] === 'ready' ? 'bell' : 'flame')}${next[1]}</button>` : ''}
        ${OPEN.includes(o.status) ? `<button class="icon-btn" type="button" data-edit-order="${o.id}" aria-label="عدّل الطلب" title="عدّل الطلب (زيد أو شيل أصناف)">${icon('edit')}</button>` : ''}
        <button class="icon-btn" type="button" data-print="${o.id}" aria-label="اطبع تذكرة المطبخ" title="اطبع تذكرة المطبخ">${icon('printer')}</button>
        ${o.status === 'new' ? `<button class="icon-btn" type="button" data-cancel="${o.id}" aria-label="إلغاء الطلب" title="إلغاء الطلب">${icon('close')}</button>` : ''}
      </div>
    </article>`;
}
async function openTable(n) {
  S.selected = n;
  renderDrawer();
  $('#drawer').classList.add('is-open');
  $('#drawer').setAttribute('aria-hidden', 'false');
  if (S.view === 'floor') renderFloor();
  try {
    const ins = await call(`/table-insight/${n}`);
    if (S.selected !== n) return;
    const top = ins.topAtTable.slice(0, 3).map((x) => x.name).join('، ');
    const el = $('#tableInsight');
    if (el && top) el.innerHTML = `${icon('sparkle')}<span>زباين هالطاولة بيطلبوا غالباً: <b style="color:var(--foam);font-weight:500">${esc(top)}</b> (${ins.orderCount} طلب آخر شهر)</span>`;
    else el?.remove();
  } catch { /* */ }
}
function closeDrawer() {
  S.selected = null;
  $('#drawer')?.classList.remove('is-open');
  $('#drawer')?.setAttribute('aria-hidden', 'true');
  if (S.view === 'floor' && S.data) renderFloor();
}
function renderDrawer() {
  const n = S.selected;
  if (n == null) return;
  const t = S.data.tables.find((x) => x.number === n);
  const { os, calls } = tableState(n);
  const total = os.reduce((s, o) => s + o.total, 0);
  if (n === TAKEAWAY) {
    $('#drawerInner').innerHTML = `
      <header class="drawer-head">
        <span class="drawer-no">${icon('bag')}</span>
        <div class="drawer-id"><h2 id="drawerTitle">طلبات خارجية</h2><p>تيك أواي · كل طلب بينسلّم وبينحسب لحاله</p></div>
        <button class="icon-btn" type="button" data-close-drawer aria-label="إغلاق">${icon('close')}</button>
      </header>
      <div class="drawer-body">
        <button class="btn btn-brass btn-block" type="button" data-new-order data-for-table="${TAKEAWAY}">${icon('plus')}طلب خارجي جديد</button>
        ${os.length ? os.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((o) => orderCard(o)).join('') : `<div class="empty">${artTile({ art: 'cup', hue: 30 })}<p>ما في طلبات خارجية مفتوحة هلق.</p></div>`}
      </div>`;
    return;
  }
  const keepInsight = $('#tableInsight')?.outerHTML;
  $('#drawerInner').innerHTML = `
    <header class="drawer-head">
      <span class="drawer-no">${n}</span>
      <div class="drawer-id"><h2 id="drawerTitle">طاولة ${n}</h2><p>${esc(zoneById(t?.zoneId)?.name ?? '')} · ${t?.seats ?? '-'} مقاعد</p></div>
      <button class="icon-btn" type="button" data-close-drawer aria-label="إغلاق">${icon('close')}</button>
    </header>
    <div class="drawer-body">
      ${keepInsight ?? `<div class="insight" id="tableInsight">${icon('sparkle')}<span>…</span></div>`}
      <button class="btn btn-ghost btn-block" type="button" data-new-order data-for-table="${n}">${icon('plus')}طلب جديد لهالطاولة</button>
      ${calls.map((c) => `
        <div class="call-row">${icon(c.kind === 'bill' ? 'receipt' : 'bell')}
          <div><strong>${c.kind === 'bill' ? 'الزبون طالب الحساب' : 'الزبون بينادي نادل'}</strong><small>${timeAgo(c.at)}</small></div>
          <button class="btn btn-coral btn-sm" type="button" data-resolve="${c.id}">${icon('check')}تم</button>
        </div>`).join('')}
      ${os.length ? os.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((o) => orderCard(o)).join('') : `<div class="empty">${artTile({ art: 'cup', hue: 190 })}<p>ما في طلبات مفتوحة على هالطاولة.</p></div>`}
    </div>
    ${os.length ? `
      <footer class="drawer-foot">
        <div class="drawer-total"><span>حساب الطاولة</span><span>${money(total, cur())}</span></div>
        <button class="btn btn-brass btn-block" type="button" data-close-table="${n}">${icon('receipt')}تم الدفع · سكّر الطاولة</button>
      </footer>` : ''}`;
}

// ───────── الكاشير بيعمل طلب أو بيعدّله ─────────
function itemUnitPrice(it) {
  // نفس منطق السيرفر التقريبي: عرض خصم نسبة فعّال على الصنف
  const off = S.data.offers.find((o) => o.active && o.type === 'discount' && o.itemIds.includes(it.id));
  return off ? Math.round(it.price * (100 - off.percent)) / 100 : it.price;
}
function openOrderEditor({ order = null, table = null } = {}) {
  const cart = new Map();
  const keyOf = (l) => `${l.kind}:${l.id}:${l.sugar ?? ''}`;
  const add = (kind, id, qty = 1, sugar = '') => {
    const k = keyOf({ kind, id, sugar });
    const cur0 = cart.get(k);
    if (cur0) cur0.qty += qty; else cart.set(k, { kind, id, qty, sugar });
  };
  if (order) order.lines.forEach((l) => add(l.kind, l.refId, l.qty, l.options?.sugar ?? ''));
  let type = order ? (order.table === TAKEAWAY ? 'takeaway' : 'table') : (table === TAKEAWAY ? 'takeaway' : 'table');
  let cat = 'all';
  let q = '';
  const combos = () => S.data.offers.filter((o) => o.active && o.type === 'combo');
  const lineInfo = (l) => {
    if (l.kind === 'offer') { const o = S.data.offers.find((x) => x.id === l.id); return { name: o ? `عرض ${o.title}` : 'عرض', unit: o?.price ?? 0, sugarChoice: false }; }
    const it = itemById(l.id);
    return { name: it?.name ?? l.id, unit: it ? itemUnitPrice(it) : 0, sugarChoice: !!it?.sugarChoice, stock: it?.stock };
  };
  openEditor({
    title: order ? `تعديل طلب #${order.no}` : 'طلب جديد',
    saveLabel: order ? 'احفظ التعديل' : 'أرسل الطلب',
    body: `
      ${order ? `<p class="muted">${esc(placeLabel(order))}${order.manualDiscount ? ' · انتبه: الخصم اليدوي على هالطلب بينشال لما تعدّله' : ''}</p>` : `
        ${segmented('oeType', [['table', 'على طاولة'], ['takeaway', 'طلب خارجي (تيك أواي)']], type)}
        <div class="form-grid" id="oeWhere"></div>`}
      <div class="oe-pick">
        <input class="input" id="oeSearch" type="search" placeholder="دوّر على صنف…" autocomplete="off">
        <div class="oe-cats" id="oeCats"></div>
        <div class="oe-items" id="oeItems"></div>
      </div>
      <h3 class="oe-title">الطلب</h3>
      <div class="oe-cart" id="oeCart"></div>
      <label class="field"><span>ملاحظة للمطبخ (اختياري)</span><textarea class="textarea" id="oeNote" maxlength="200" placeholder="مثلاً: بدون ثلج">${esc(order?.note ?? '')}</textarea></label>`,
    onSave: async () => {
      const lines = [...cart.values()].map((l) => ({ kind: l.kind, id: l.id, qty: l.qty, options: l.sugar ? { sugar: l.sugar } : {} }));
      if (!lines.length) throw new Error('ضيف صنف واحد على الأقل.');
      if (order) {
        const o = await call(`/orders/${order.id}/lines`, { method: 'PUT', body: { lines, note: val('oeNote') } });
        applyOrder(o);
        toast(`انحفظ تعديل طلب #${o.no}`, 'ok');
        return;
      }
      const body = { lines, note: val('oeNote') };
      if (type === 'takeaway') body.takeaway = { name: val('oeName').trim(), phone: val('oePhone').trim() };
      else {
        body.table = Number(val('oeTable'));
        if (!S.data.tables.some((x) => x.number === body.table)) throw new Error('اكتب رقم طاولة صحيح.');
      }
      const o = await call('/orders', { method: 'POST', body });
      applyOrder(o);
      toast(`انبعت طلب #${o.no} · ${placeLabel(o)} · ${moneyText(o.total, cur())}`, 'ok');
    },
  });
  const renderWhere = () => {
    const el = $('#oeWhere');
    if (!el) return;
    el.innerHTML = type === 'takeaway'
      ? `<label class="field"><span>اسم الزبون</span><input class="input" id="oeName" maxlength="40" placeholder="مثلاً: أبو أحمد"></label>
         <label class="field"><span>رقم التلفون (اختياري)</span><input class="input" id="oePhone" maxlength="20" inputmode="tel" dir="ltr" placeholder="059…"></label>`
      : `<label class="field"><span>رقم الطاولة</span><input class="input" id="oeTable" type="number" min="1" max="${S.data.tables.length}" inputmode="numeric" value="${table && table !== TAKEAWAY ? table : ''}" placeholder="1 – ${S.data.tables.length}"></label>`;
  };
  const renderPick = () => {
    const cats = [['all', 'الكل'], ['offers', 'العروض'], ...S.data.categories.map((c) => [c.id, c.name])];
    $('#oeCats').innerHTML = cats.map(([id, name]) => `<button type="button" class="chip ${cat === id ? 'is-on' : ''}" data-oe-cat="${esc(id)}">${esc(name)}</button>`).join('');
    const qq = q.trim();
    const offers = cat === 'all' || cat === 'offers' ? combos().filter((o) => !qq || o.title.includes(qq)) : [];
    const items = cat === 'offers' ? [] : S.data.items.filter((i) => (cat === 'all' || i.categoryId === cat) && (!qq || i.name.includes(qq)));
    $('#oeItems').innerHTML = [
      ...offers.map((o) => `<button type="button" class="oe-item is-offer" data-oe-add="offer:${esc(o.id)}"><b>عرض ${esc(o.title)}</b><small>${moneyText(o.price, cur())}</small></button>`),
      ...items.map((it) => {
        const out = !it.available || (it.stock != null && it.stock !== '' && Number(it.stock) <= 0);
        return `<button type="button" class="oe-item ${out ? 'is-out' : ''}" data-oe-add="item:${esc(it.id)}" ${out ? 'disabled' : ''}><b>${esc(it.name)}</b><small>${out ? 'مش متوفر' : moneyText(itemUnitPrice(it), cur())}${!out && it.stock != null && it.stock !== '' ? ` · بالمخزن ${it.stock}` : ''}</small></button>`;
      }),
    ].join('') || '<p class="muted">ما في أصناف مطابقة.</p>';
  };
  const renderCart = () => {
    const rows = [...cart.entries()];
    let total = 0;
    $('#oeCart').innerHTML = rows.length ? rows.map(([k, l]) => {
      const info = lineInfo(l);
      total += info.unit * l.qty;
      return `<div class="oe-line">
        <div class="oe-line-name"><b>${esc(info.name)}</b>${info.sugarChoice ? `<select class="select oe-sugar" data-oe-sugar="${esc(k)}" aria-label="السكر">${[['', 'السكر عادي'], ...Object.entries(SUGAR)].map(([v, lbl]) => `<option value="${v}" ${l.sugar === v ? 'selected' : ''}>${lbl}</option>`).join('')}</select>` : ''}</div>
        <div class="stepper sm"><button type="button" data-oe-qty="${esc(k)}" data-d="1" aria-label="زيادة">${icon('plus')}</button><output>${l.qty}</output><button type="button" data-oe-qty="${esc(k)}" data-d="-1" aria-label="${l.qty === 1 ? 'شيل' : 'إنقاص'}">${icon(l.qty === 1 ? 'trash' : 'minus')}</button></div>
        <span class="oe-line-total">${moneyText(info.unit * l.qty, cur())}</span>
      </div>`;
    }).join('') + `<div class="oe-total"><span>المجموع</span><b>${moneyText(Math.round(total * 100) / 100, cur())}</b></div>`
      : '<p class="muted">لسا ما ضفت أصناف. اختار من فوق.</p>';
  };
  renderWhere();
  renderPick();
  renderCart();
  const form = $('#editorForm');
  form.oninput = (e) => { if (e.target.id === 'oeSearch') { q = e.target.value; renderPick(); } };
  form.onchange = (e) => {
    const k = e.target.dataset.oeSugar;
    if (k == null) return;
    const l = cart.get(k);
    cart.delete(k);
    l.sugar = e.target.value;
    add(l.kind, l.id, l.qty, l.sugar);
    renderCart();
  };
  form.onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const dd = b.dataset;
    if (dd.seg === 'oeType') { type = dd.v; renderWhere(); return; }
    if (dd.oeCat) { cat = dd.oeCat; renderPick(); return; }
    if (dd.oeAdd) { const [kind, id] = dd.oeAdd.split(':'); add(kind, id, 1, ''); renderCart(); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); return; }
    if (dd.oeQty) {
      const l = cart.get(dd.oeQty);
      if (!l) return;
      l.qty += Number(dd.d);
      if (l.qty <= 0) cart.delete(dd.oeQty);
      renderCart();
    }
  };
}

// ───────── الطلبات (كانبان) ─────────
function renderKanban() {
  const cols = [['new', 'var(--gold)'], ['preparing', 'var(--amber)'], ['ready', 'var(--seaglass)'], ['served', 'var(--brass)']];
  $('#kanban').innerHTML = cols.map(([s, c]) => {
    const list = S.orders.filter((o) => o.status === s).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return `
      <section class="kcol" aria-label="${STATUS[s].label}">
        <header class="kcol-head"><h3><i style="background:${c}"></i>${STATUS[s].label}</h3><span class="num">${list.length}</span></header>
        ${list.length ? list.map((o) => `<div class="kcard">${orderCard(o, { inKanban: true })}</div>`).join('') : '<p class="kempty">ما في طلبات هون</p>'}
      </section>`;
  }).join('');
}

async function advance(id, to) {
  try {
    const o = await call(`/orders/${id}`, { method: 'PATCH', body: { status: to } });
    applyOrder(o);
    if (to === 'ready') toast(`طلب ${placeLabel(o)} جاهز`, 'ok');
    if (to === 'paid') toast(`انسلّم طلب #${o.no} وانحسب`, 'ok');
  } catch (err) { toast(err.message, 'err'); }
}
function applyOrder(o) {
  const i = S.orders.findIndex((x) => x.id === o.id);
  if (OPEN.includes(o.status)) { if (i >= 0) S.orders[i] = o; else S.orders.push(o); }
  else if (i >= 0) S.orders.splice(i, 1);
  refreshLive();
}
function refreshLive() {
  renderNav();
  if (S.view === 'floor') renderFloor();
  if (S.view === 'orders') renderKanban();
  if (S.selected != null) renderDrawer();
  if (S.view === 'floor') $('#viewSub').textContent = `${S.data.tables.length} طاولة · ${S.orders.length} طلب مفتوح`;
}

function printTicket(o) {
  const s = S.data.settings;
  $('#printArea').innerHTML = `
    <div class="ticket">
      <h1>${esc(s.cafeName)}</h1>
      <p style="text-align:center;margin:0">تذكرة المطبخ</p>
      <div class="big">${esc(placeLabel(o))}</div>${o.takeaway?.phone ? `<p style="text-align:center;margin:0" dir="ltr">${esc(o.takeaway.phone)}</p>` : ''}
      <div class="row"><span>طلب #${o.no}</span><span>${new Date(o.createdAt).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}</span></div>
      <hr>
      ${o.lines.map((l) => `<div class="row"><b>${l.qty} × ${esc(l.name)}</b></div>${l.options?.sugar ? `<small>— ${SUGAR[l.options.sugar]}</small><br>` : ''}${l.parts ? `<small>— ${esc(l.parts.join(' + '))}</small><br>` : ''}${l.note ? `<small>— ${esc(l.note)}</small><br>` : ''}`).join('')}
      ${o.note ? `<hr><b>ملاحظة:</b> ${esc(o.note)}` : ''}
      <hr><div class="row"><span>المجموع</span><b>${moneyText(o.total, cur())}</b></div>
    </div>`;
  window.print();
}

// ───────── القائمة ─────────
function renderMenuView() {
  const { categories, items } = S.data;
  const counts = Object.fromEntries(categories.map((c) => [c.id, items.filter((i) => i.categoryId === c.id).length]));
  $('#catPills').innerHTML = `<button class="chip ${S.menuCat === 'all' ? 'is-on' : ''}" type="button" data-cat="all">الكل <span class="num">${items.length}</span></button>`
    + categories.map((c) => `
      <span class="chip cat-pill ${S.menuCat === c.id ? 'is-on' : ''}">
        <button type="button" data-cat="${esc(c.id)}">${esc(c.name)} <span class="num">${counts[c.id]}</span></button>
        <button type="button" class="edit" data-edit-cat="${esc(c.id)}" aria-label="تعديل قسم ${esc(c.name)}">${icon('edit')}</button>
      </span>`).join('');
  const q = S.search.trim();
  const list = items.filter((i) => (S.menuCat === 'all' || i.categoryId === S.menuCat) && (!q || i.name.includes(q) || (i.tags ?? []).some((t) => t.includes(q))));
  $('#itemRows').innerHTML = list.length ? list.map((it) => {
    const cat = categories.find((c) => c.id === it.categoryId);
    return `
      <div class="irow ${it.available ? '' : 'is-off'}">
        ${artTile(it)}
        <div style="min-width:0"><h4>${esc(it.name)}</h4><p>${esc(it.recipe || it.desc)}</p></div>
        <span class="irow-cat muted">${esc(cat?.name ?? '')}</span>
        <span>${money(it.price, cur())}${stockBadge(it)}</span>
        <label class="switch"><input type="checkbox" data-avail="${esc(it.id)}" ${it.available ? 'checked' : ''}><span class="track"></span><span class="lbl">${it.available ? 'متوفر' : 'نفد'}</span></label>
        <button class="icon-btn" type="button" data-edit-item="${esc(it.id)}" aria-label="تعديل ${esc(it.name)}">${icon('edit')}</button>
      </div>`;
  }).join('') : '<div class="empty"><p>ما في أصناف هون. ضيف صنف جديد من الزر فوق.</p></div>';
}

/** شارة المخزن بقائمة الأصناف: باقي كم، أو نفد */
function stockBadge(it) {
  if (it.stock == null || it.stock === '') return '';
  const n = Number(it.stock);
  const cls = n <= 0 ? 'out' : n <= 5 ? 'low' : '';
  return `<small class="stock-badge ${cls}">${n <= 0 ? 'نفد من المخزن' : `بالمخزن ${n}`}</small>`;
}

// ───────── تأكيد جوّا الصفحة ─────────
function askConfirm(message, okLabel = 'تأكيد') {
  return new Promise((resolve) => {
    let ok = false;
    openEditor({ title: 'تأكيد', body: `<p style="font-size:15px;line-height:1.8">${esc(message)}</p>`, saveLabel: okLabel, onSave: async () => { ok = true; } });
    $('#editor').addEventListener('sheet:closed', () => resolve(ok), { once: true });
  });
}

// ───────── المحرر العام ─────────
let editorSave = null;
function openEditor({ title, body, onSave, onDelete, saveLabel = 'حفظ' }) {
  $('#editorTitle').textContent = title;
  $('#editorForm').innerHTML = body + '<p class="form-err" id="formErr" role="alert"></p>';
  $('#editorFoot').innerHTML = `
    ${onDelete ? `<button class="btn btn-quiet btn-danger" type="button" id="editorDelete">${icon('trash')}حذف</button>` : ''}
    <button class="btn btn-brass" type="button" id="editorSave">${icon('check')}${saveLabel}</button>`;
  editorSave = async () => {
    const btn = $('#editorSave');
    btn.classList.add('is-busy');
    try { await onSave(); closeSheet($('#editor')); } catch (err) { $('#formErr').textContent = err.message; } finally { btn.classList.remove('is-busy'); }
  };
  $('#editorSave').onclick = editorSave;
  if (onDelete) {
    let armed = false;
    $('#editorDelete').onclick = async () => {
      const b = $('#editorDelete');
      if (!armed) { armed = true; b.classList.add('is-armed'); b.innerHTML = `${icon('trash')}متأكد؟ اضغط كمان مرة`; setTimeout(() => { armed = false; if (b.isConnected) { b.classList.remove('is-armed'); b.innerHTML = `${icon('trash')}حذف`; } }, 4000); return; }
      try { await onDelete(); closeSheet($('#editor')); } catch (err) { $('#formErr').textContent = err.message; }
    };
  }
  openSheet($('#editor'));
}
const val = (id) => $('#' + id)?.value ?? '';
function segmented(name, options, current) {
  return `<div class="segmented" role="group" style="--n:${options.length}">${options.map(([v, l]) => `<button type="button" data-seg="${name}" data-v="${v}" aria-pressed="${String(v) === String(current)}">${l}</button>`).join('')}</div>`;
}
function segValue(name) { return $(`[data-seg="${name}"][aria-pressed="true"]`)?.dataset.v; }

function openItemEditor(it) {
  const isNew = !it;
  const d = it ? { ...it } : { name: '', categoryId: S.menuCat !== 'all' ? S.menuCat : S.data.categories[0]?.id, price: '', cost: '', desc: '', recipe: '', sugar: 1, caffeine: 0, tags: [], sugarChoice: false, available: true, art: 'cup', hue: 30, image: null };
  const preview = () => { $('#artPreview').outerHTML = artTile(d, '').replace('class="art ', 'id="artPreview" class="art '); };
  openEditor({
    title: isNew ? 'صنف جديد' : `تعديل ${it.name}`,
    body: `
      <div class="form-grid">
        <label class="field full"><span>اسم الصنف</span><input class="input" id="f_name" value="${esc(d.name)}" maxlength="60" data-autofocus></label>
        <label class="field"><span>القسم</span><select class="select" id="f_cat">${S.data.categories.map((c) => `<option value="${esc(c.id)}" ${c.id === d.categoryId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
        <label class="field"><span>سعر البيع (${esc(cur())})</span><input class="input" id="f_price" type="number" min="0" step="0.5" value="${esc(d.price)}" inputmode="decimal"></label>
        <label class="field"><span>التكلفة على المحل (${esc(cur())})</span><input class="input" id="f_cost" type="number" min="0" step="0.1" value="${esc(d.cost ?? '')}" inputmode="decimal" placeholder="مثلاً 3.5"></label>
        <p class="margin-hint" id="marginHint"></p>
        <label class="field"><span>الكمية بالمخزن (اتركها فاضية إذا مش بدك تحسبها)</span><input class="input" id="f_stock" type="number" min="0" step="1" value="${esc(d.stock ?? '')}" inputmode="numeric" placeholder="مثلاً 20"></label>
        <p class="muted" style="margin-top:-6px;font-size:12.5px">كل طلب بينقص منها، ولما تخلص الصنف بيصير "نفد" عند الزبائن لحاله، ونديم بيحكيلهم إنه مش متوفر حالياً.</p>
        <label class="field full"><span>وصف قصير</span><input class="input" id="f_desc" value="${esc(d.desc)}" maxlength="200"></label>
        <label class="field full"><span>من شو بيتكوّن (بيظهر للزبون وبيشرحه الباريستا)</span><textarea class="textarea" id="f_recipe" maxlength="400">${esc(d.recipe ?? '')}</textarea></label>
        <div class="field"><span>الحلاوة</span>${segmented('sugar', [[0, 'بدون'], [1, 'خفيف'], [2, 'وسط'], [3, 'حلو']], d.sugar)}</div>
        <div class="field"><span>الكافيين</span>${segmented('caffeine', [[0, 'بدون'], [1, 'خفيف'], [2, 'وسط'], [3, 'قوي']], d.caffeine)}</div>
        <label class="field full"><span>وسوم تساعد الباريستا (افصل بفاصلة)</span><input class="input" id="f_tags" value="${esc((d.tags ?? []).join('، '))}" placeholder="قهوة، حليب، شتوي"></label>
        <div class="field"><label class="switch"><input type="checkbox" id="f_sugarChoice" ${d.sugarChoice ? 'checked' : ''}><span class="track"></span>الزبون بيختار كمية السكر</label></div>
        <div class="field"><label class="switch"><input type="checkbox" id="f_available" ${d.available ? 'checked' : ''}><span class="track"></span>متوفر للطلب</label></div>
        <div class="field full"><span>الشكل</span>
          <div class="visual-row">
            ${artTile(d).replace('class="art ', 'id="artPreview" class="art ')}
            <div style="display:grid;gap:10px">
              <div class="art-picker">${ART_KEYS.map((k) => `<button type="button" data-art="${k}" aria-pressed="${k === d.art}" title="${ART_LABELS[k]}">${itemArt(k)}</button>`).join('')}</div>
              <label class="field"><span>لون الخلفية</span><input class="hue" id="f_hue" type="range" min="0" max="360" value="${d.hue}"></label>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <label class="btn btn-ghost btn-sm" style="cursor:pointer">${icon('image')}ارفع صورة<input type="file" id="f_image" accept="image/png,image/jpeg,image/webp" hidden></label>
                ${d.image ? `<button class="btn btn-quiet btn-sm" type="button" id="f_noimg">شيل الصورة</button>` : ''}
              </div>
              <input class="input" id="f_imgurl" dir="ltr" placeholder="أو الصق رابط صورة https://…" value="${d.image && d.image.startsWith('http') ? esc(d.image) : ''}">
            </div>
          </div>
        </div>
      </div>`,
    onSave: async () => {
      const body = {
        name: val('f_name'), categoryId: val('f_cat'), price: val('f_price'), desc: val('f_desc'), recipe: val('f_recipe'),
        sugar: Number(segValue('sugar')), caffeine: Number(segValue('caffeine')), tags: val('f_tags'),
        sugarChoice: $('#f_sugarChoice').checked, available: $('#f_available').checked, art: d.art, hue: Number(val('f_hue')), image: d.image,
        cost: val('f_cost'),
        stock: val('f_stock'),
      };
      if (!body.name.trim()) throw new Error('اكتب اسم الصنف.');
      if (body.price === '' || Number(body.price) < 0) throw new Error('اكتب سعر صحيح.');
      const saved = isNew ? await call('/items', { method: 'POST', body }) : await call(`/items/${it.id}`, { method: 'PUT', body });
      if (isNew) S.data.items.push(saved); else Object.assign(itemById(it.id), saved);
      toast(isNew ? `انضاف ${saved.name}` : 'انحفظ التعديل', 'ok');
      renderMenuView();
    },
    onDelete: isNew ? null : async () => {
      await call(`/items/${it.id}`, { method: 'DELETE' });
      S.data.items = S.data.items.filter((x) => x.id !== it.id);
      toast('انحذف الصنف', 'ok');
      renderMenuView();
    },
  });
  const form = $('#editorForm');
  const margin = () => {
    const price = Number(val('f_price')), cost = Number(val('f_cost'));
    const el = $('#marginHint');
    if (!price) { el.textContent = 'اكتب السعر والتكلفة لتشوف ربح القطعة.'; el.className = 'margin-hint'; return; }
    const profit = price - cost;
    el.innerHTML = `ربح القطعة: <b>${moneyText(profit, cur())}</b> (${Math.round((profit / price) * 100)}% من السعر)`;
    el.className = 'margin-hint ' + (profit < 0 ? 'bad' : 'good');
  };
  margin();
  form.oninput = (e) => {
    if (e.target.id === 'f_hue') { d.hue = Number(e.target.value); preview(); }
    if (e.target.id === 'f_price' || e.target.id === 'f_cost') margin();
    if (e.target.id === 'f_imgurl') { const v = e.target.value.trim(); d.image = /^https:\/\//.test(v) ? v : (v ? d.image : null); preview(); }
  };
  form.onchange = async (e) => {
    if (e.target.id !== 'f_image' || !e.target.files[0]) return;
    try {
      const dataUrl = await shrinkImage(e.target.files[0]);
      const { url } = await call('/upload', { method: 'POST', body: { dataUrl } });
      d.image = url;
      preview();
      toast('انرفعت الصورة، اضغط حفظ', 'ok');
    } catch (err) { toast(err.message, 'err'); }
  };
  form.onclick = (e) => {
    const a = e.target.closest('[data-art]');
    if (a) { d.art = a.dataset.art; d.image = null; $$('[data-art]').forEach((b) => b.setAttribute('aria-pressed', String(b === a))); preview(); }
    if (e.target.closest('#f_noimg')) { d.image = null; preview(); e.target.closest('#f_noimg').remove(); }
  };
}
function shrinkImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const max = 720;
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/webp', 0.85)); // المتصفحات اللي ما بتدعم webp بترجع png، والسيرفر بيقبل الاثنين
    };
    img.onerror = () => reject(new Error('ما قدرنا نقرأ الصورة.'));
    img.src = URL.createObjectURL(file);
  });
}

function openCategoryEditor(c) {
  const isNew = !c;
  const d = c ? { ...c } : { name: '', temp: null, icon: 'cup' };
  const idx = c ? S.data.categories.findIndex((x) => x.id === c.id) : -1;
  openEditor({
    title: isNew ? 'قسم جديد' : `تعديل قسم ${c.name}`,
    body: `
      <div class="form-grid">
        <label class="field full"><span>اسم القسم</span><input class="input" id="c_name" value="${esc(d.name)}" maxlength="40" data-autofocus></label>
        <div class="field full"><span>نوع القسم (بيساعد الباريستا يقترح حسب الطقس)</span>${segmented('temp', [['hot', 'ساخن'], ['cold', 'بارد'], ['', 'غير ذلك']], d.temp ?? '')}</div>
        <div class="field full"><span>الأيقونة</span><div class="art-picker">${ART_KEYS.map((k) => `<button type="button" data-art="${k}" aria-pressed="${k === d.icon}" title="${ART_LABELS[k]}">${itemArt(k)}</button>`).join('')}</div></div>
        ${isNew ? '' : `<div class="field full"><span>الترتيب بالقائمة</span><div style="display:flex;gap:8px">
          <button class="btn btn-ghost btn-sm" type="button" data-move="-1" ${idx === 0 ? 'disabled' : ''}>قدّمه</button>
          <button class="btn btn-ghost btn-sm" type="button" data-move="1" ${idx === S.data.categories.length - 1 ? 'disabled' : ''}>أخّره</button></div></div>`}
      </div>`,
    onSave: async () => {
      const body = { name: val('c_name'), temp: segValue('temp') || null, icon: d.icon };
      if (!body.name.trim()) throw new Error('اكتب اسم القسم.');
      const saved = isNew ? await call('/categories', { method: 'POST', body }) : await call(`/categories/${c.id}`, { method: 'PUT', body });
      if (isNew) S.data.categories.push(saved); else Object.assign(S.data.categories.find((x) => x.id === c.id), saved);
      toast('انحفظ القسم', 'ok');
      renderMenuView();
    },
    onDelete: isNew ? null : async () => {
      await call(`/categories/${c.id}`, { method: 'DELETE' });
      S.data.categories = S.data.categories.filter((x) => x.id !== c.id);
      if (S.menuCat === c.id) S.menuCat = 'all';
      renderMenuView();
    },
  });
  $('#editorForm').onclick = async (e) => {
    const a = e.target.closest('[data-art]');
    if (a) { d.icon = a.dataset.art; $$('[data-art]').forEach((b) => b.setAttribute('aria-pressed', String(b === a))); }
    const m = e.target.closest('[data-move]');
    if (m) {
      const list = S.data.categories;
      const j = idx + Number(m.dataset.move);
      [list[idx], list[j]] = [list[j], list[idx]];
      await call('/categories-order', { method: 'PUT', body: { ids: list.map((x) => x.id) } });
      list.forEach((x, i) => { x.order = i + 1; });
      closeSheet($('#editor'));
      renderMenuView();
      toast('تغيّر الترتيب', 'ok');
    }
  };
  $('#editorForm').oninput = null;
  $('#editorForm').onchange = null;
}

// ───────── العروض ─────────
function offerValue(o) { return o.itemIds.reduce((s, id) => s + (itemById(id)?.price ?? 0), 0); }
function renderOffers() {
  const offers = S.data.offers;
  $('#offerCards').innerHTML = offers.length ? offers.map((o) => `
    <article class="offer ${o.active ? '' : 'is-off'}">
      <div class="offer-top">
        <h3 class="offer-title">${esc(o.title)}</h3>
        <span class="badge ${o.type === 'combo' ? 'badge-brass' : 'badge-coral'}">${o.type === 'combo' ? 'عرض مجمّع' : `خصم ${o.percent}%`}</span>
      </div>
      <p class="offer-desc">${esc(o.description)}</p>
      <div class="offer-arts">${o.itemIds.map(itemById).filter(Boolean).map((i) => artTile(i)).join('')}</div>
      <p class="muted">${o.itemIds.map((id) => esc(itemById(id)?.name ?? '؟')).join(' + ')}</p>
      <div class="offer-foot">
        ${o.type === 'combo' ? `<div class="offer-price">${money(o.price, cur())}<s>${money(offerValue(o), cur())}</s></div>` : '<span></span>'}
        <div class="offer-actions">
          <label class="switch"><input type="checkbox" data-offer-active="${o.id}" ${o.active ? 'checked' : ''}><span class="track"></span>${o.active ? 'فعّال' : 'موقوف'}</label>
          <button class="icon-btn" type="button" data-edit-offer="${o.id}" aria-label="تعديل العرض">${icon('edit')}</button>
        </div>
      </div>
    </article>`).join('') : '<div class="empty"><p>ما في عروض. اعمل أول عرض من الزر فوق.</p></div>';
}
function openOfferEditor(o) {
  const isNew = !o;
  const d = o ? { ...o, itemIds: [...o.itemIds] } : { type: 'combo', title: '', description: '', itemIds: [], price: '', percent: 15, active: true };
  const renderPicked = () => {
    const v = offerValue(d);
    $('#offerValue').innerHTML = d.type === 'combo'
      ? `القيمة الأصلية: ${money(v, cur())}${Number(val('o_price')) && Number(val('o_price')) < v ? ` · توفير ${money(v - Number(val('o_price')), cur())}` : ''}`
      : `${d.itemIds.length} صنف عليه الخصم`;
  };
  openEditor({
    title: isNew ? 'عرض جديد' : `تعديل ${o.title}`,
    body: `
      <div class="form-grid">
        <div class="field full"><span>نوع العرض</span>${segmented('otype', [['combo', 'عرض مجمّع بسعر ثابت'], ['discount', 'خصم نسبة على أصناف']], d.type)}</div>
        <label class="field"><span>اسم العرض</span><input class="input" id="o_title" value="${esc(d.title)}" maxlength="40" data-autofocus></label>
        <label class="field" id="o_priceWrap" ${d.type === 'discount' ? 'hidden' : ''}><span>سعر العرض (${esc(cur())})</span><input class="input" id="o_price" type="number" min="0" step="0.5" value="${esc(d.price)}"></label>
        <label class="field" id="o_pctWrap" ${d.type === 'combo' ? 'hidden' : ''}><span>نسبة الخصم %</span><input class="input" id="o_pct" type="number" min="1" max="90" value="${esc(d.percent)}"></label>
        <label class="field full"><span>وصف للزبون</span><input class="input" id="o_desc" value="${esc(d.description)}" maxlength="160"></label>
        <div class="field full"><span>الأصناف${d.type === 'combo' ? ' (اضغط مرتين لصنفين من نفس النوع)' : ''}</span>
          <div class="chips-select" id="o_items">${S.data.items.map((i) => {
            const n = d.itemIds.filter((x) => x === i.id).length;
            return `<button type="button" class="chip" data-pick="${esc(i.id)}" aria-pressed="${n > 0}">${esc(i.name)}${n > 1 ? ` ×${n}` : ''}</button>`;
          }).join('')}</div></div>
        <p class="muted full" id="offerValue"></p>
        <div class="field full"><label class="switch"><input type="checkbox" id="o_active" ${d.active ? 'checked' : ''}><span class="track"></span>العرض فعّال</label></div>
      </div>`,
    onSave: async () => {
      const body = { type: d.type, title: val('o_title'), description: val('o_desc'), itemIds: d.itemIds, price: val('o_price'), percent: val('o_pct'), active: $('#o_active').checked };
      const saved = isNew ? await call('/offers', { method: 'POST', body }) : await call(`/offers/${o.id}`, { method: 'PUT', body });
      if (isNew) S.data.offers.push(saved); else Object.assign(S.data.offers.find((x) => x.id === o.id), saved);
      toast('انحفظ العرض', 'ok');
      await reloadItems();
      renderOffers();
    },
    onDelete: isNew ? null : async () => {
      await call(`/offers/${o.id}`, { method: 'DELETE' });
      S.data.offers = S.data.offers.filter((x) => x.id !== o.id);
      renderOffers();
    },
  });
  renderPicked();
  const form = $('#editorForm');
  form.oninput = renderPicked;
  form.onchange = null;
  form.onclick = (e) => {
    const p = e.target.closest('[data-pick]');
    if (p) {
      const id = p.dataset.pick;
      const n = d.itemIds.filter((x) => x === id).length;
      if (d.type === 'combo' && n === 1) d.itemIds.push(id);
      else if (n > 0) d.itemIds = d.itemIds.filter((x) => x !== id);
      else d.itemIds.push(id);
      const m = d.itemIds.filter((x) => x === id).length;
      p.setAttribute('aria-pressed', String(m > 0));
      p.textContent = itemById(id).name + (m > 1 ? ` ×${m}` : '');
      renderPicked();
    }
    const seg = e.target.closest('[data-seg="otype"]');
    if (seg) {
      d.type = seg.dataset.v;
      $('#o_priceWrap').hidden = d.type !== 'combo';
      $('#o_pctWrap').hidden = d.type !== 'discount';
      if (d.type === 'discount') d.itemIds = [...new Set(d.itemIds)];
      renderPicked();
    }
  };
}
async function reloadItems() {
  const fresh = await call('/bootstrap');
  Object.assign(S.data, { items: fresh.items, offers: fresh.offers });
}

// ───────── الطاولات والمناطق ─────────
function qrSvg(url) {
  if (typeof window.qrcode !== 'function') return '';
  const q = window.qrcode(0, 'M');
  q.addData(url);
  q.make();
  return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
}
const defaultOrigin = () => (location.protocol === 'file:' ? 'http://192.168.1.10:3000' : location.origin);
function qrBase() { return (val('qrBase') || store.get('qrBase') || defaultOrigin()).replace(/\/+$/, ''); }
// نسخة العرض بدون سيرفر: رابط صفحة الزبون فيه كود هاللوحة، فالطلب من أي جوال بيوصل لهون
function customerLink() {
  const u = new URL($('#openMenu').getAttribute('href') || '/', location.href);
  u.search = '';
  // رابط المحل ثابت لكل الأجهزة (?cafe= بس لما نكون عم نجرّب)
  for (const [k, v] of Object.entries(relay?.customerParams() ?? {})) u.searchParams.set(k, v);
  return u.href;
}
const qrTarget = () => (relay ? customerLink() : qrBase() + '/');
function renderTablesView() {
  const { zones, tables } = S.data;
  $('#zoneList').innerHTML = zones.map((z) => `
    <div class="zone-card" data-zone="${esc(z.id)}">
      <input class="input" data-zname value="${esc(z.name)}" maxlength="40" aria-label="اسم المنطقة">
      <textarea class="textarea" data-zdesc maxlength="240" aria-label="وصف المنطقة">${esc(z.description)}</textarea>
      <div class="row">
        <span class="muted" style="margin-inline-end:auto">${tables.filter((t) => t.zoneId === z.id).length} طاولة</span>
        <button class="btn btn-quiet btn-sm btn-danger" type="button" data-zdel="${esc(z.id)}">${icon('trash')}</button>
        <button class="btn btn-ghost btn-sm" type="button" data-zsave="${esc(z.id)}">${icon('check')}حفظ</button>
      </div>
    </div>`).join('');
  $('#tableCount').value = tables.length;
  if (relay) {
    $('#qrBase').value = customerLink();
    $('#qrBase').readOnly = true;
    $('#qrBaseLabel').textContent = 'رابط الزبائن';
    $('#siteQrHint').textContent = 'هالرابط ثابت ما بيتغيّر: امسحه أو ابعته لأي حدا. الطلب بيوصل للجهاز اللي هو الكاشير، وإذا مش فاتح بينحفظ وبيوصله أول ما يفتح.';
    renderCashierCard();
    $('#copyLink').hidden = false;
    // مشاركة الرابط هي الأهم بهالنسخة، والطباعة ثانوية
    $('#copyLink').className = 'btn btn-brass btn-sm';
    $('#printCards').className = 'btn btn-ghost btn-sm';
  } else if (!$('#qrBase').value) {
    const lan = S.data.lanUrls?.[0];
    $('#qrBase').value = store.get('qrBase') || (location.hostname === 'localhost' && lan ? lan : defaultOrigin());
  }
  // QR واحد لكل الطاولات: الزبون بيمسحه وبعدين بيكتب رقم طاولته
  $('#siteQr').innerHTML = qrSvg(qrTarget());
  $('#tableGrid').innerHTML = tables.map((t) => `
    <div class="tcard">
      <span class="num">${t.number}</span>
      <select class="select" data-tzone="${t.number}" aria-label="منطقة طاولة ${t.number}">${zones.map((z) => `<option value="${esc(z.id)}" ${z.id === t.zoneId ? 'selected' : ''}>${esc(z.name)}</option>`).join('')}</select>
    </div>`).join('');
}
function printTableCards() {
  const s = S.data.settings;
  const card = `
    <div class="tent">
      ${brandMark(s.cafeName)}
      <p>امسح الكود واطلب من طاولتك</p>
      <div class="qr">${qrSvg(qrTarget())}</div>
      <p><b>بعد ما تفتح الصفحة اكتب رقم طاولتك</b></p>
    </div>`;
  $('#printArea').innerHTML = `<div class="cards">${card.repeat(6)}</div>`;
  window.print();
}

// ───────── التقارير ─────────
const dateText = (iso) => new Date(iso).toLocaleDateString('ar', { weekday: 'long', day: 'numeric', month: 'long' });
const timeText = (iso) => new Date(iso).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' });
const pct = (profit, revenue) => (revenue ? Math.round((profit / revenue) * 100) : 0);
function itemsTable(items) {
  if (!items?.length) return '<p class="muted">ما في مبيعات.</p>';
  return `<div class="table-scroll"><table class="ttable"><thead><tr><th>الصنف</th><th>الكمية</th><th>المبيعات</th><th>التكلفة</th><th>الربح</th></tr></thead><tbody>
    ${items.map((i) => `<tr><td>${esc(i.name)}</td><td class="num">${i.qty}</td><td>${money(i.revenue, cur())}</td><td class="muted">${money(i.cost, cur())}</td><td class="profit-cell ${i.profit < 0 ? 'bad' : ''}">${money(i.profit, cur())}</td></tr>`).join('')}
  </tbody></table></div>`;
}
// التقارير شهرية: كل شهر بأرقامه وأيامه وأصنافه، والإغلاق اليومي بيضل لتصفير عدّاد اليوم
const MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];
const monthName = (key) => { const [y, m] = key.split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; };
const dayLabel = (date) => {
  const [y, m, d] = date.split('-').map(Number);
  return `${new Date(y, m - 1, d).toLocaleDateString('ar', { weekday: 'long' })} ${d} ${MONTHS[m - 1]}`;
};
function delta(now, before, partial = false) {
  if (!before) return '';
  const p = Math.round(((now - before) / before) * 100);
  return `<em class="delta ${p >= 0 ? 'up' : 'down'}">${p >= 0 ? '▲' : '▼'} ${Math.abs(p)}% عن ${partial ? 'نفس الفترة من الشهر الماضي' : 'الشهر اللي قبله'}</em>`;
}

async function renderReports() {
  const box = $('#reports');
  box.innerHTML = '<p class="muted">عم نحسب…</p>';
  let day, list, rep;
  try {
    [day, list] = await Promise.all([call('/day'), call('/months')]);
    if (!list.some((m) => m.key === S.month)) S.month = list[0].key;
    rep = await call(`/months/${S.month}`);
  } catch (err) { box.innerHTML = `<p class="muted">${esc(err.message)}</p>`; return; }
  S.report = rep;
  const maxTop = Math.max(1, ...rep.top.map((t) => t.qty));
  const hours = rep.byHour.slice(7, 24);
  const maxH = Math.max(1, ...hours);
  const maxCat = Math.max(1, ...rep.categories.map((c) => c.qty));
  const [yy, mm] = rep.key.split('-').map(Number);
  const daysInMonth = new Date(yy, mm, 0).getDate();
  const byDate = Object.fromEntries(rep.days.map((d) => [Number(d.date.slice(8)), d]));
  const maxDay = Math.max(1, ...rep.days.map((d) => d.revenue));
  box.innerHTML = `
    <section class="day-card">
      <div class="day-head">
        <div><h2>يوم العمل الحالي</h2><p class="muted">مفتوح من ${dateText(day.openedAt)} الساعة ${timeText(day.openedAt)}${day.openTables.length ? ` · <b style="color:var(--coral)">${day.openTables.length} طاولة لسا مفتوحة</b>` : ''}</p></div>
        <button class="btn btn-brass" type="button" data-close-shop>${icon('lock')}إغلاق المحل وتصفير الحسابات</button>
      </div>
      <div class="kpis">
        <div class="kpi"><span>المبيعات</span><strong>${money(day.revenue, cur())}</strong></div>
        <div class="kpi"><span>التكلفة</span><strong>${money(day.cost, cur())}</strong></div>
        <div class="kpi profit"><span>صافي الربح</span><strong>${money(day.profit, cur())}</strong><small>${pct(day.profit, day.revenue)}% من المبيعات</small></div>
        <div class="kpi"><span>الخصومات</span><strong>${money(day.discounts, cur())}</strong></div>
        <div class="kpi"><span>الطلبات</span><strong class="num">${day.orders}</strong></div>
      </div>
    </section>

    <div class="month-head">
      <h2 class="section-title">تقرير ${monthName(rep.key)}${rep.archived ? ' <small class="muted">· من الأرشيف</small>' : ''}</h2>
      <div class="month-tools">
        <div class="segmented month-chips" role="tablist" aria-label="اختار الشهر">${list.map((m) => `<button type="button" data-month="${m.key}" aria-pressed="${m.key === rep.key}">${monthName(m.key)}</button>`).join('')}</div>
        <button class="btn btn-brass btn-sm" type="button" data-pdf>${icon('download')}تحميل PDF</button>
      </div>
    </div>
    <div class="kpis">
      <div class="kpi"><span>المبيعات</span><strong>${money(rep.revenue, cur())}</strong>${delta(rep.revenue, rep.prev.revenue, rep.prev.partial)}</div>
      <div class="kpi"><span>التكلفة</span><strong>${money(rep.cost, cur())}</strong></div>
      <div class="kpi profit"><span>صافي الربح</span><strong>${money(rep.profit, cur())}</strong><small>${pct(rep.profit, rep.revenue)}% هامش</small>${delta(rep.profit, rep.prev.profit, rep.prev.partial)}</div>
      <div class="kpi"><span>الطلبات</span><strong class="num">${rep.orders}</strong><small>${rep.activeDays} يوم شغل</small></div>
      <div class="kpi"><span>متوسط الفاتورة</span><strong>${money(rep.avgTicket, cur())}</strong></div>
    </div>
    <div class="charts">
      <section class="chart-card wide">
        <h3>المبيعات يوم بيوم<small>${rep.bestDay ? `أحسن يوم: ${dayLabel(rep.bestDay.date)} بـ ${moneyText(rep.bestDay.revenue, cur())}` : 'ما في مبيعات لسا'}</small></h3>
        <div class="cols month-cols">${Array.from({ length: daysInMonth }, (_, i) => {
          const d = byDate[i + 1];
          return `<div class="col"><span class="tip">${i + 1} ${MONTHS[mm - 1]}: ${d ? `${moneyText(d.revenue, cur())} · ربح ${moneyText(d.profit, cur())}` : 'ما في مبيعات'}</span><span class="col-fill" style="height:${d ? (d.revenue / maxDay) * 100 : 0}%"></span></div>`;
        }).join('')}</div>
        <div class="col-axis month-axis">${Array.from({ length: daysInMonth }, (_, i) => `<span>${(i + 1) % 5 === 0 || i === 0 ? i + 1 : ''}</span>`).join('')}</div>
      </section>
      <section class="chart-card wide">
        <h3>الأصناف المباعة والأرباح<small>${monthName(rep.key)}</small></h3>
        ${itemsTable(rep.items)}
      </section>
      <section class="chart-card">
        <h3>الأكثر طلباً<small>عدد القطع</small></h3>
        <div class="hbars">${rep.top.length ? rep.top.map((t) => `
          <div class="hbar" title="${esc(t.name)}: ${t.qty}"><span>${esc(t.name)}</span><span class="hbar-track"><span class="hbar-fill" style="width:${(t.qty / maxTop) * 100}%"></span></span><span class="num">${t.qty}</span></div>`).join('') : '<p class="muted">ما في مبيعات بهالشهر.</p>'}</div>
      </section>
      <section class="chart-card">
        <h3>الطلبات حسب الساعة<small>مرّر على العمود لتشوف العدد</small></h3>
        <div class="cols">${hours.map((v, i) => `<div class="col"><span class="tip">الساعة ${i + 7}: ${v} طلب</span><span class="col-fill" style="height:${(v / maxH) * 100}%"></span></div>`).join('')}</div>
        <div class="col-axis">${hours.map((_, i) => `<span>${(i + 7) % 3 === 0 ? i + 7 : ''}</span>`).join('')}</div>
      </section>
      <section class="chart-card">
        <h3>المبيعات حسب القسم<small>عدد القطع</small></h3>
        <div class="hbars">${rep.categories.map((c) => `
          <div class="hbar" title="${esc(c.name)}: ${c.qty}"><span>${esc(c.name)}</span><span class="hbar-track"><span class="hbar-fill" style="width:${(c.qty / maxCat) * 100}%"></span></span><span class="num">${c.qty}</span></div>`).join('')}</div>
      </section>
      <section class="chart-card">
        <h3>أنشط الطاولات</h3>
        ${rep.tables.length ? `<table class="ttable"><thead><tr><th>الطاولة</th><th>الطلبات</th><th>الإيراد</th><th>المفضّل عندهم</th></tr></thead><tbody>
          ${rep.tables.map((t) => `<tr><td><span class="num">${t.table}</span> <small class="muted">${esc(t.zone)}</small></td><td class="num">${t.orders}</td><td>${money(t.revenue, cur())}</td><td>${esc(t.favorite)}</td></tr>`).join('')}
        </tbody></table>` : '<p class="muted">ما في طلبات بهالشهر.</p>'}
      </section>
      <section class="chart-card wide">
        <h3>أيام ${monthName(rep.key)}</h3>
        ${rep.days.length ? `<div class="table-scroll"><table class="ttable"><thead><tr><th>اليوم</th><th>الطلبات</th><th>المبيعات</th><th>التكلفة</th><th>الربح</th></tr></thead><tbody>
          ${[...rep.days].reverse().map((d) => `<tr><td>${dayLabel(d.date)}</td><td class="num">${d.orders}</td><td>${money(d.revenue, cur())}</td><td class="muted">${money(d.cost, cur())}</td><td class="profit-cell">${money(d.profit, cur())}</td></tr>`).join('')}
        </tbody></table></div>` : '<p class="muted">لسا ما في مبيعات بهالشهر.</p>'}
      </section>
      <section class="chart-card wide">
        <h3>سجل الشهور<small>اضغط على شهر لتفتح تقريره</small></h3>
        <div class="table-scroll"><table class="ttable days"><thead><tr><th>الشهر</th><th>الطلبات</th><th>المبيعات</th><th>التكلفة</th><th>الربح</th><th>الهامش</th></tr></thead><tbody>
          ${list.map((m) => `<tr data-month-row="${m.key}" tabindex="0" ${m.key === rep.key ? 'class="is-current"' : ''}><td>${monthName(m.key)}</td><td class="num">${m.orders}</td><td>${money(m.revenue, cur())}</td><td class="muted">${money(m.cost, cur())}</td><td class="profit-cell">${money(m.profit, cur())}</td><td class="num">${pct(m.profit, m.revenue)}%</td></tr>`).join('')}
        </tbody></table></div>
      </section>
    </div>`;
}

// ───────── ملف PDF لتقرير الشهر ─────────
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.onload = resolve;
    el.onerror = () => reject(new Error('ما قدرنا نحمّل أداة الـ PDF، تأكد من الإنترنت.'));
    document.head.append(el);
  });
}
// الصفحات بتنرسم على canvas بنص كامل لكل سطر: المتصفح بيشبك الحروف العربية ويرتّب الأرقام صح
// (أدوات تحويل HTML لـ PDF بتقطّع النص كلمة كلمة فبتلزق الكلمات العربية ببعض)
const PDF = { W: 1240, H: 1754, M: 76, ink: '#2b1a12', ink2: '#7a685d', brown: '#4a2c1d', dark: '#2b1a12', sand: '#f6ead4', cream: '#fbf8f5', line: '#e8e1d9', up: '#3f7a57', down: '#b9603f' };
const pdfFont = (weight, size) => `${weight} ${size}px Alexandria, 'Segoe UI', Tahoma, sans-serif`;

function renderReportPages(r) {
  const { W, H, M } = PDF;
  const c = cur();
  const mt = (x) => moneyText(x, c);
  const dayName = (date) => { const [y, mo, d] = date.split('-').map(Number); return `${new Date(y, mo - 1, d).toLocaleDateString('ar', { weekday: 'long' })} ${d} ${MONTHS[mo - 1]}`; };
  const deltaLine = (now, before) => {
    if (!before) return null;
    const p = Math.round(((now - before) / before) * 100);
    return { text: `${p >= 0 ? '▲' : '▼'} ${Math.abs(p)}% عن ${r.prev.partial ? 'نفس الفترة من ' : ''}${monthName(r.prev.key)}`, up: p >= 0 };
  };
  const pages = [];
  let ctx;
  let y;
  const FOOT = 90;
  const newPage = () => {
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);
    ctx.direction = 'rtl';
    pages.push(cv);
    y = M;
  };
  const text = (str, x, yy, { size = 21, weight = 400, color = PDF.ink, align = 'right', font = null, max = null } = {}) => {
    ctx.font = font ?? pdfFont(weight, size);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    let t = String(str);
    if (max) while (t.length > 1 && ctx.measureText(t).width > max) t = t.slice(0, -2) + '…';
    ctx.fillText(t, x, yy);
  };
  const box = (x, yy, w, h, fill, stroke = null, rad = 18) => {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, yy, w, h, rad); else ctx.rect(x, yy, w, h);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
  };
  const ensure = (h, onBreak) => { if (y + h > H - M - FOOT) { newPage(); onBreak?.(); } };

  newPage();
  // الرأس
  text(r.cafeName, W - M, y + 62, { font: `700 66px 'Aref Ruqaa', 'Amiri', serif`, color: PDF.dark });
  text(`تقرير المبيعات والأرباح · ${monthName(r.key)}`, W - M, y + 116, { size: 28, weight: 600, color: PDF.brown });
  text(`انعمل بتاريخ ${new Date(r.generatedAt).toLocaleDateString('en-GB')}`, M, y + 70, { size: 19, color: PDF.ink2, align: 'left' });
  text(`${r.activeDays} يوم شغل · ${r.orders} طلب`, M, y + 104, { size: 19, color: PDF.ink2, align: 'left' });
  y += 146;
  ctx.fillStyle = PDF.brown;
  ctx.fillRect(M, y, W - 2 * M, 4);
  y += 34;

  // بطاقات الأرقام (من اليمين)
  const kpis = [
    { label: 'المبيعات', value: mt(r.revenue), lines: [deltaLine(r.revenue, r.prev.revenue)] },
    { label: 'التكلفة', value: mt(r.cost), lines: [] },
    { label: 'صافي الربح', value: mt(r.profit), hl: true, lines: [{ text: `هامش ${pct(r.profit, r.revenue)}%` }, deltaLine(r.profit, r.prev.profit)] },
    { label: 'الخصومات', value: mt(r.discounts), lines: [] },
    { label: 'متوسط الفاتورة', value: mt(r.avgTicket), lines: [] },
  ];
  const gap = 16;
  const bw = (W - 2 * M - gap * 4) / 5;
  const bh = 172;
  kpis.forEach((k, i) => {
    const x = W - M - (i + 1) * bw - i * gap;
    box(x, y, bw, bh, k.hl ? PDF.brown : PDF.cream, k.hl ? null : PDF.line);
    const fg = k.hl ? '#fff' : PDF.ink;
    text(k.label, x + bw - 20, y + 40, { size: 19, color: k.hl ? '#eadcc6' : PDF.ink2 });
    text(k.value, x + bw - 20, y + 88, { size: 32, weight: 700, color: fg, max: bw - 36 });
    k.lines.filter(Boolean).forEach((l, j) => {
      const col = k.hl ? '#f1e4cc' : l.up === undefined ? PDF.ink2 : l.up ? PDF.up : PDF.down;
      text(l.text, x + bw - 20, y + 124 + j * 28, { size: 16, color: col, max: bw - 36 });
    });
  });
  y += bh + 40;
  if (r.bestDay) {
    text(`أحسن يوم بالشهر: ${dayName(r.bestDay.date)}، بمبيعات ${mt(r.bestDay.revenue)} وربح ${mt(r.bestDay.profit)}.`, W - M, y, { size: 20, color: PDF.ink2 });
    y += 30;
  }

  // جدول بعنوان، بيكمّل على صفحة جديدة مع رأسه إذا ما وسع
  const table = (title, cols, rows, sum = null) => {
    const rowH = 46;
    const headH = 52;
    const total = W - 2 * M;
    const xs = [];
    let right = W - M;
    for (const col of cols) { xs.push(right); right -= col.w * total; }
    const cell = (val, i, yy, opts = {}) => {
      const col = cols[i];
      const w = col.w * total;
      const x = col.align === 'center' ? xs[i] - w / 2 : xs[i] - 18;
      text(val, x, yy, { size: 19, align: col.align === 'center' ? 'center' : 'right', max: w - 28, ...opts });
    };
    const head = () => {
      box(M, y, total, headH, PDF.sand, null, 10);
      cols.forEach((col, i) => cell(col.label, i, y + 34, { weight: 700, color: PDF.dark }));
      y += headH;
    };
    // الجدول الصغير بيضل كامل على صفحة وحدة، والطويل بيبلّش إذا في محل لسطرين
    ensure(70 + headH + rowH * (rows.length + (sum ? 1 : 0) <= 8 ? rows.length + (sum ? 1 : 0) : 2));
    y += 34;
    text(title, W - M, y, { size: 27, weight: 700, color: PDF.dark });
    y += 20;
    head();
    rows.forEach((cells) => {
      ensure(rowH, head);
      cells.forEach((v, i) => cell(v.text ?? v, i, y + 31, v.opts ?? {}));
      ctx.fillStyle = PDF.line;
      ctx.fillRect(M, y + rowH - 1, total, 1);
      y += rowH;
    });
    if (sum) {
      ensure(rowH + 6, head);
      ctx.fillStyle = PDF.cream;
      ctx.fillRect(M, y, total, rowH + 4);
      ctx.fillStyle = PDF.brown;
      ctx.fillRect(M, y, total, 3);
      sum.forEach((v, i) => cell(v, i, y + 33, { weight: 700 }));
      y += rowH + 4;
    }
  };

  const num = [{ w: 0.13, align: 'center' }, { w: 0.15, align: 'center' }, { w: 0.15, align: 'center' }, { w: 0.15, align: 'center' }];
  table('الأصناف المباعة والأرباح',
    [{ label: 'الصنف', w: 0.42 }, ...['الكمية', 'المبيعات', 'التكلفة', 'الربح'].map((label, i) => ({ ...num[i], label }))],
    r.items.map((i) => [i.name, i.qty, mt(i.revenue), mt(i.cost), { text: mt(i.profit), opts: { weight: 700, color: i.profit < 0 ? PDF.down : PDF.ink } }]),
    ['المجموع', r.itemsSold, mt(r.revenue), mt(r.cost), mt(r.profit)]);
  table('المبيعات يوم بيوم',
    [{ label: 'اليوم', w: 0.42 }, ...['الطلبات', 'المبيعات', 'التكلفة', 'الربح'].map((label, i) => ({ ...num[i], label }))],
    r.days.length ? r.days.map((d) => [dayName(d.date), d.orders, mt(d.revenue), mt(d.cost), { text: mt(d.profit), opts: { weight: 700 } }]) : [['ما في مبيعات بهالشهر', '', '', '', '']]);
  table('حسب القسم',
    [{ label: 'القسم', w: 0.7 }, { label: 'عدد القطع', w: 0.3, align: 'center' }],
    r.categories.map((x) => [x.name, x.qty]));

  // تذييل كل صفحة
  pages.forEach((cv, i) => {
    ctx = cv.getContext('2d');
    ctx.direction = 'rtl';
    ctx.fillStyle = PDF.line;
    ctx.fillRect(M, H - M - 46, W - 2 * M, 2);
    text(`${r.cafeName} · نظام الطلب من الطاولة`, W - M, H - M, { size: 17, color: PDF.ink2 });
    text(`صفحة ${i + 1} من ${pages.length}`, M, H - M, { size: 17, color: PDF.ink2, align: 'left' });
  });
  return pages;
}

async function downloadMonthPdf(btn) {
  const r = S.report;
  if (!r) return;
  btn.classList.add('is-busy');
  try {
    if (!window.jspdf) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    await Promise.all(['400 20px Alexandria', '600 20px Alexandria', '700 20px Alexandria', "700 40px 'Aref Ruqaa'"].map((f) => document.fonts?.load(f))).catch(() => {});
    const pages = renderReportPages(r);
    const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    pages.forEach((cv, i) => {
      if (i) pdf.addPage();
      pdf.addImage(cv.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297);
    });
    pdf.save(`تقرير ${monthName(r.key)} - ${r.cafeName}.pdf`);
    toast('نزل ملف التقرير ✓', 'ok');
  } catch (err) {
    toast(err.message || 'ما قدرنا نعمل الملف، جرب كمان مرة.', 'err');
  } finally {
    btn.classList.remove('is-busy');
  }
}

// ───────── إغلاق المحل ─────────
async function openCloseShop() {
  let day;
  try { day = await call('/day'); } catch (err) { toast(err.message, 'err'); return; }
  openEditor({
    title: 'إغلاق المحل',
    saveLabel: 'أغلق اليوم وصفّر الحسابات',
    body: `
      <p class="muted">رح ينحفظ تقرير اليوم بسجل الأيام، وبعدها العدادات بتبلّش من الصفر ليوم جديد.</p>
      <div class="kpis" style="margin:14px 0">
        <div class="kpi"><span>المبيعات</span><strong>${money(day.revenue, cur())}</strong></div>
        <div class="kpi"><span>التكلفة</span><strong>${money(day.cost, cur())}</strong></div>
        <div class="kpi profit"><span>صافي الربح</span><strong>${money(day.profit, cur())}</strong></div>
        <div class="kpi"><span>الطلبات</span><strong class="num">${day.orders}</strong></div>
      </div>
      ${day.openTables.length ? `
        <div class="close-warn">${icon('info')}<div><strong>في ${day.openTables.length} طاولة لسا مفتوحة: ${day.openTables.join('، ')}</strong>
          <label class="switch" style="margin-top:8px"><input type="checkbox" id="forceClose"><span class="track"></span>سكّرها كلها كمدفوعة وكمّل الإغلاق</label></div></div>` : ''}
      <p class="muted">مفتوح من ${dateText(day.openedAt)} الساعة ${timeText(day.openedAt)}</p>`,
    onSave: async () => {
      const force = $('#forceClose')?.checked === true;
      if (day.openTables.length && !force) throw new Error('سكّر الطاولات المفتوحة أول، أو فعّل الخيار اللي فوق.');
      const record = await call('/day/close', { method: 'POST', body: { force } });
      const fresh = await call('/bootstrap');
      S.orders = fresh.orders;
      S.calls = fresh.calls;
      refreshLive();
      refreshBarStats();
      toast(`تسكّر اليوم: مبيعات ${moneyText(record.revenue, cur())}، ربح ${moneyText(record.profit, cur())}`, 'ok');
      if (S.view === 'reports') renderReports();
      setTimeout(() => openDayDetail(record), 450);
    },
  });
}
async function openDayDetail(dayOrId) {
  let day = dayOrId;
  if (typeof dayOrId === 'string') { try { day = await call(`/days/${dayOrId}`); } catch (err) { toast(err.message, 'err'); return; } }
  openEditor({
    title: `تقرير ${dateText(day.closedAt)}`,
    saveLabel: 'اطبع التقرير',
    body: `
      <p class="muted">من ${timeText(day.openedAt)} لـ ${timeText(day.closedAt)}</p>
      <div class="kpis" style="margin:14px 0">
        <div class="kpi"><span>المبيعات</span><strong>${money(day.revenue, cur())}</strong></div>
        <div class="kpi"><span>التكلفة</span><strong>${money(day.cost, cur())}</strong></div>
        <div class="kpi profit"><span>صافي الربح</span><strong>${money(day.profit, cur())}</strong><small>${pct(day.profit, day.revenue)}%</small></div>
        <div class="kpi"><span>الطلبات</span><strong class="num">${day.orders}</strong></div>
        <div class="kpi"><span>الخصومات</span><strong>${money(day.discounts, cur())}</strong></div>
      </div>
      <h3 style="font-size:15px;margin-bottom:8px">الأصناف اللي انباعت</h3>
      ${itemsTable(day.items)}`,
    onSave: async () => {
      const s = S.data.settings;
      $('#printArea').innerHTML = `
        <div class="ticket">
          <h1>${esc(s.cafeName)}</h1>
          <p style="text-align:center;margin:0">تقرير ${dateText(day.closedAt)}</p>
          <hr>
          <div class="row"><span>الطلبات</span><b>${day.orders}</b></div>
          <div class="row"><span>المبيعات</span><b>${moneyText(day.revenue, cur())}</b></div>
          <div class="row"><span>التكلفة</span><b>${moneyText(day.cost, cur())}</b></div>
          <div class="row"><span>الخصومات</span><b>${moneyText(day.discounts, cur())}</b></div>
          <div class="row"><span>صافي الربح</span><b>${moneyText(day.profit, cur())}</b></div>
          <hr>
          ${day.items.map((i) => `<div class="row"><span>${i.qty} × ${esc(i.name)}</span><b>${moneyText(i.revenue, cur())}</b></div>`).join('')}
        </div>`;
      window.print();
    },
  });
}

// ───────── خصم على صنف بفاتورة وحدة ─────────
function openDiscount(orderId, idx) {
  const o = S.orders.find((x) => x.id === orderId);
  const l = o?.lines[idx];
  if (!l) return;
  const orig = l.origUnitPrice ?? l.unitPrice;
  openEditor({
    title: `خصم على ${l.name}`,
    saveLabel: 'طبّق الخصم',
    body: `
      <p class="muted">الخصم بيغيّر سعر هالصنف بطلب #${o.no} (طاولة ${o.table}) بس، وما بيأثر على سعره بالقائمة.</p>
      <div class="form-grid" style="margin-top:14px">
        <div class="field"><span>السعر الأصلي للقطعة</span><div class="input" style="display:flex;align-items:center">${money(orig, cur())}</div></div>
        <label class="field"><span>السعر الجديد للقطعة</span><input class="input" id="discPrice" type="number" min="0" max="${orig}" step="0.5" value="${l.unitPrice}" inputmode="decimal" data-autofocus></label>
        <div class="field full"><span>خصم سريع</span><div class="quick-disc">
          ${[[0.9, '10%'], [0.8, '20%'], [0.75, '25%'], [0.5, 'نص السعر'], [0, 'مجاني']].map(([f, lbl]) => `<button class="chip" type="button" data-qp="${f}">${lbl}</button>`).join('')}
          <button class="chip" type="button" data-qp="1">رجّع الأصلي</button>
        </div></div>
        <p class="margin-hint full" id="discHint"></p>
      </div>`,
    onSave: async () => {
      const updated = await call(`/orders/${orderId}/lines/${idx}`, { method: 'PATCH', body: { price: val('discPrice') } });
      applyOrder(updated);
      toast(updated.lines[idx].origUnitPrice != null ? `انطبق الخصم على ${l.name}` : `رجع سعر ${l.name} الأصلي`, 'ok');
    },
  });
  const hint = () => {
    const p = Number(val('discPrice'));
    $('#discHint').innerHTML = Number.isFinite(p) ? `المجموع لهالصنف (${l.qty} قطعة): <b>${moneyText(p * l.qty, cur())}</b> بدل ${moneyText(orig * l.qty, cur())}${p < orig ? ` · وفّر ${moneyText((orig - p) * l.qty, cur())}` : ''}` : '';
  };
  hint();
  const form = $('#editorForm');
  form.oninput = hint;
  form.onchange = null;
  form.onclick = (e) => {
    const q = e.target.closest('[data-qp]');
    if (!q) return;
    $('#discPrice').value = Math.round(orig * Number(q.dataset.qp) * 100) / 100;
    hint();
  };
}

// ───────── الإعدادات ─────────
function renderSettings() {
  const s = S.data.settings;
  const ai = S.data.ai ?? {};
  const gem = window.__CAFE_DEMO__?.gemini;
  const aiText = ai.configured
    ? `متصل بـ ${esc(ai.provider ?? 'Claude')} (${esc(ai.model)})${ai.lastError ? ` — آخر خطأ: ${esc(ai.lastError)}` : ''}`
    : ai.standalone
      ? 'الوضع الأساسي: بيفهم الطلبات الشائعة. حط مفتاح Gemini المجاني تحت، وبيصير نديم يحكي ويتناقش مع الزباين بذكاء.'
      : 'الوضع الأساسي: بيفهم الطلبات الشائعة. لتفعيل المحادثة الكاملة حط GEMINI_API_KEY (مجاني) أو ANTHROPIC_API_KEY بملف .env وأعد تشغيل السيرفر.';
  $('#settings').innerHTML = `
    <div class="settings-grid">
      <section class="panel">
        <div class="panel-head"><h2>الهوية</h2></div>
        <div class="field">
          <span>المظهر</span>
          <div class="segmented" style="--n:3" role="radiogroup" aria-label="المظهر">${THEMES.map(([k, label, ic]) => `<button type="button" role="radio" data-theme-set="${k}" aria-pressed="${themePref() === k}" aria-checked="${themePref() === k}" style="display:inline-flex;align-items:center;justify-content:center;gap:6px">${icon(ic)}${label}</button>`).join('')}</div>
        </div>
        <div class="logo-preview" id="logoPreview"></div>
        <div class="form-grid">
          <label class="field"><span>اسم المحل</span><input class="input" id="s_name" value="${esc(s.cafeName)}" maxlength="40"></label>
          <label class="field"><span>الكلمة اللي بتتعبّى بالشعار</span><input class="input" id="s_word" value="${esc(s.brandWord)}" maxlength="12"></label>
          <label class="field full"><span>الجملة تحت الشعار</span><input class="input" id="s_tagline" value="${esc(s.tagline)}" maxlength="80"></label>
          <label class="field"><span>اسم الباريستا الذكي</span><input class="input" id="s_barista" value="${esc(s.baristaName)}" maxlength="20"></label>
          <label class="field"><span>رمز العملة</span><input class="input" id="s_cur" value="${esc(s.currency)}" maxlength="4"></label>
        </div>
      </section>
      <section class="panel">
        <div class="panel-head"><h2>الطقس والموقع</h2></div>
        <p class="muted">الباريستا بيقرأ طقس هالمدينة ليقترح سخن أو بارد.</p>
        <div class="inline-form"><input class="input" id="s_city" value="${esc(s.city)}" placeholder="اسم المدينة"><button class="btn btn-ghost btn-sm" type="button" id="geoBtn">دوّر</button></div>
        <div class="geo-results" id="geoResults"></div>
        <div class="form-grid">
          <label class="field"><span>خط العرض</span><input class="input" id="s_lat" value="${s.lat}" dir="ltr"></label>
          <label class="field"><span>خط الطول</span><input class="input" id="s_lon" value="${s.lon}" dir="ltr"></label>
        </div>
        <div class="panel-head" style="margin-top:8px"><h2>الباريستا الذكي</h2></div>
        <div class="ai-status"><i style="background:${ai.configured && !ai.lastError ? 'var(--seaglass)' : 'var(--amber)'}"></i>
          <span>${aiText}</span></div>
        ${gem ? `<div class="field">
          <span>مفتاح Gemini المجاني</span>
          <div class="inline-form">
            <input class="input" id="s_gemini" type="password" dir="ltr" autocomplete="off" spellcheck="false" placeholder="${gem.configured ? 'محفوظ ✓ اكتب مفتاح جديد لتغييره' : 'الصق المفتاح هون'}" aria-label="مفتاح Gemini">
            <button class="btn btn-ghost btn-sm" type="button" id="saveGemini">حفظ</button>
            ${gem.configured ? `<button class="btn btn-quiet btn-sm btn-danger" type="button" id="clearGemini" aria-label="امسح المفتاح">${icon('trash')}</button>` : ''}
          </div>
          <small class="muted">جيبه من <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" dir="ltr">aistudio.google.com/apikey</a>. بينحفظ بهالمتصفح بس وما بينرفع لأي مكان، ونديم بيستعمله ليرد على الزباين طول ما اللوحة مفتوحة.</small>
        </div>` : ''}
        <div class="panel-head" style="margin-top:8px"><h2>معلومات بيعرفها نديم</h2></div>
        <p class="muted">لما يسأل الزبون عن الواي فاي أو الدوام بيجاوبه نديم من هون. إذا فاضيين بيحكيله يسأل النادل.</p>
        <div class="form-grid">
          <label class="field"><span>الواي فاي (الاسم وكلمة السر)</span><input class="input" id="s_wifi" value="${esc(s.wifi ?? '')}" maxlength="100" placeholder="مثلاً: Cafe-Mohammad / 12345678"></label>
          <label class="field"><span>ساعات الدوام</span><input class="input" id="s_hours" value="${esc(s.hours ?? '')}" maxlength="100" placeholder="مثلاً: كل يوم من 8 الصبح لـ 12 بالليل"></label>
          <label class="field full"><span>ملاحظات عن المحل (اختياري)</span><textarea class="textarea" id="s_notes" maxlength="600" placeholder="مثلاً: في جلسات عائلية فوق، الدفع كاش أو تطبيق، ما عنا أراكيل">${esc(s.cafeNotes ?? '')}</textarea></label>
        </div>
        <div class="panel-head" style="margin-top:8px"><h2>الأمان والبيانات</h2></div>
        <label class="field"><span>رمز دخول جديد (اتركه فاضي إذا ما بدك تغيّره)</span><input class="input" id="s_pin" inputmode="numeric" maxlength="8" placeholder="4 إلى 8 أرقام" autocomplete="new-password"></label>
        ${S.data.demoOrders ? `<button class="btn btn-quiet btn-danger" type="button" id="clearDemo">${icon('trash')}امسح ${S.data.demoOrders} طلب تجريبي من السجل</button>` : ''}
        <div class="backup-box">
          <strong>${icon('lock')}البيانات والنسخة الاحتياطية</strong>
          <p class="muted">${window.__CAFE_DEMO__?.storageKB
            ? `البيانات محفوظة بمتصفح هالجهاز (${window.__CAFE_DEMO__.storageKB()} ك.ب من حوالي 5000). إذا انمسحت بيانات المتصفح أو غيّرت الجهاز بتروح، فنزّل نسخة احتياطية كل فترة.`
            : 'البيانات محفوظة على السيرفر. نزّل نسخة احتياطية كل فترة للاحتياط.'}</p>
          <p class="muted">تقرير كل شهر خلص بيتحفظ بالأرشيف للأبد، وطلبات الشهور الأقدم من الشهر الماضي بتنحذف لحالها بعد ما ينحفظ تقريرها.</p>
          <div class="backup-actions">
            <button class="btn btn-ghost btn-sm" type="button" id="backupBtn">${icon('download')}نزّل نسخة احتياطية</button>
            <label class="btn btn-ghost btn-sm" for="restoreFile">${icon('upload')}استرجع من نسخة</label>
            <input type="file" id="restoreFile" accept=".json,application/json" hidden>
          </div>
        </div>
      </section>
    </div>
    <div style="margin-top:16px;display:flex;justify-content:flex-end"><button class="btn btn-brass" type="button" id="saveSettings">${icon('check')}احفظ الإعدادات</button></div>`;
  const drawLogo = () => {
    const name = val('s_name') || s.cafeName;
    const word = val('s_word') || s.brandWord;
    $('#logoPreview').innerHTML = brandLogo({ word, prefix: name.replace(word, '').trim() || 'كافي', mode: 'static' });
    fitLogo($('#logoPreview svg'));
  };
  drawLogo();
  let t;
  $('#settings').oninput = (e) => { if (['s_name', 's_word'].includes(e.target.id)) { clearTimeout(t); t = setTimeout(drawLogo, 250); } };
}
async function downloadBackup() {
  try {
    const data = await call('/backup');
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `نسخة ${S.data.settings.cafeName} ${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    toast('نزلت النسخة الاحتياطية ✓ خبّيها بمكان آمن (إيميل أو درايف)', 'ok');
  } catch (err) { toast(err.message, 'err'); }
}
async function restoreBackup(input) {
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  let backup;
  try { backup = JSON.parse(await file.text()); } catch { return toast('هاد الملف مش نسخة احتياطية من النظام.', 'err'); }
  const when = backup?.exportedAt ? new Date(backup.exportedAt).toLocaleDateString('en-GB') : 'غير معروف';
  if (!(await askConfirm(`رح تنمسح البيانات الحالية وتنحط مكانها النسخة (تاريخها ${when}). متأكد؟`, 'استرجع النسخة'))) return;
  try {
    const r = await call('/restore', { method: 'POST', body: { data: backup.data } });
    toast(`رجعت البيانات ✓ (${r.orders} طلب)`, 'ok');
    setTimeout(() => location.reload(), 900);
  } catch (err) { toast(err.message, 'err'); }
}
async function saveGeminiKey(clear = false) {
  const key = clear ? '' : val('s_gemini').trim();
  if (!clear && !/^[\w-]{20,}$/.test(key)) return toast('المفتاح مش مزبوط، انسخه كامل من aistudio.google.com/apikey', 'err');
  window.__CAFE_DEMO__.gemini.set(key);
  try { S.data.ai = (await call('/bootstrap')).ai; } catch { /* */ }
  renderSettings();
  toast(clear ? 'انمسح المفتاح، ونديم رجع للوضع الأساسي' : 'انحفظ المفتاح ✓ جرّب اسأل نديم من صفحة الزبون', 'ok');
}
async function copyCustomerLink() {
  const link = customerLink();
  try {
    await navigator.clipboard.writeText(link);
    toast('انسخ رابط الزبائن، ابعته لأي حدا ليطلب من جواله', 'ok');
  } catch {
    $('#qrBase').select();
    toast('الرابط محدد، انسخه من هون', 'ok');
  }
}
async function saveSettings() {
  try {
    const body = {
      cafeName: val('s_name'), brandWord: val('s_word'), tagline: val('s_tagline'), baristaName: val('s_barista'),
      currency: val('s_cur'), city: val('s_city'), lat: val('s_lat'), lon: val('s_lon'), adminPin: val('s_pin'),
      wifi: val('s_wifi'), hours: val('s_hours'), cafeNotes: val('s_notes'),
    };
    S.data.settings = await call('/settings', { method: 'PUT', body });
    renderShell();
    toast('انحفظت الإعدادات', 'ok');
    renderSettings();
  } catch (err) { toast(err.message, 'err'); }
}

// ───────── الأحداث ─────────
function bind() {
  document.addEventListener('click', async (e) => {
    const row = e.target.closest('tr[data-day]');
    if (row) return openDayDetail(row.dataset.day);
    const mrow = e.target.closest('tr[data-month-row]');
    if (mrow) { S.month = mrow.dataset.monthRow; await renderReports(); return $('.month-head')?.scrollIntoView({ behavior: 'smooth' }); }
    if (relay && e.target.closest('#live')) return setView('tables');
    const t = e.target.closest('button, [data-table], a');
    if (!t) return;
    const d = t.dataset;
    if (d.pin) {
      if (d.pin === 'ok') return tryLogin();
      if (d.pin === 'back') pin = pin.slice(0, -1);
      else if (pin.length < 8) pin += d.pin;
      $('#loginErr').textContent = '';
      return renderPin();
    }
    if (d.viewBtn) return setView(d.viewBtn);
    if (d.advance) { e.stopPropagation(); return advance(d.advance, d.to); }
    if (d.print) { e.stopPropagation(); const o = S.orders.find((x) => x.id === d.print); return o && printTicket(o); }
    if (d.cancel) {
      e.stopPropagation();
      if (!(await askConfirm('تلغي هالطلب؟ الزبون رح يشوف إنه انلغى.', 'ألغِ الطلب'))) return;
      return advance(d.cancel, 'cancelled');
    }
    if (d.table && !t.closest('.drawer')) return openTable(Number(d.table));
    if (d.closeDrawer !== undefined) return closeDrawer();
    if (d.resolve) {
      try { await call(`/calls/${d.resolve}`, { method: 'DELETE' }); S.calls = S.calls.filter((c) => c.id !== d.resolve); refreshLive(); } catch (err) { toast(err.message, 'err'); }
      return;
    }
    if (d.closeTable) {
      try {
        const r = await call(`/tables/${d.closeTable}/close`, { method: 'POST' });
        S.orders = S.orders.filter((o) => o.table !== Number(d.closeTable));
        S.calls = S.calls.filter((c) => c.table !== Number(d.closeTable));
        toast(`تسكّرت طاولة ${d.closeTable} (${r.closed} طلب)`, 'ok');
        closeDrawer();
        refreshLive();
        refreshBarStats();
      } catch (err) { toast(err.message, 'err'); }
      return;
    }
    if (d.cat) { S.menuCat = d.cat; return renderMenuView(); }
    if (d.editCat) return openCategoryEditor(S.data.categories.find((c) => c.id === d.editCat));
    if (d.editItem) return openItemEditor(itemById(d.editItem));
    if (d.editOffer) return openOfferEditor(S.data.offers.find((o) => o.id === d.editOffer));
    if (d.seg) { $$(`[data-seg="${d.seg}"]`).forEach((b) => b.setAttribute('aria-pressed', String(b === t))); return; }
    if (d.month) { S.month = d.month; return renderReports(); }
    if (d.pdf !== undefined) return downloadMonthPdf(t);
    if (d.zsave) {
      const card = t.closest('[data-zone]');
      try {
        const z = await call(`/zones/${d.zsave}`, { method: 'PUT', body: { name: card.querySelector('[data-zname]').value, description: card.querySelector('[data-zdesc]').value } });
        Object.assign(zoneById(d.zsave), z);
        toast('انحفظت المنطقة', 'ok');
      } catch (err) { toast(err.message, 'err'); }
      return;
    }
    if (d.zdel) {
      if (!(await askConfirm('تحذف المنطقة؟ طاولاتها بتنتقل لمنطقة ثانية.', 'احذف المنطقة'))) return;
      try {
        const r = await call(`/zones/${d.zdel}`, { method: 'DELETE' });
        S.data.zones = S.data.zones.filter((z) => z.id !== d.zdel);
        S.data.tables.forEach((tb) => { if (tb.zoneId === d.zdel) tb.zoneId = r.movedTo; });
        renderTablesView();
      } catch (err) { toast(err.message, 'err'); }
      return;
    }
    if (t.id === 'logoutBtn') return logout();
    if (t.id === 'closeShopBtn' || d.closeShop !== undefined) return openCloseShop();
    if (d.disc) { e.stopPropagation(); return openDiscount(d.disc, Number(d.idx)); }
    if (t.id === 'soundBtn') { S.sound = !S.sound; store.set('sound', S.sound ? '1' : '0'); unlockAudio(); if (S.sound) chime('ok'); return renderSoundBtn(); }
    if (t.id === 'addItem') return openItemEditor(null);
    if (t.id === 'addCategory') return openCategoryEditor(null);
    if (t.id === 'addOffer') return openOfferEditor(null);
    if (t.id === 'addZone') {
      try { const z = await call('/zones', { method: 'POST', body: { name: 'منطقة جديدة', description: '' } }); S.data.zones.push(z); renderTablesView(); } catch (err) { toast(err.message, 'err'); }
      return;
    }
    if (t.id === 'applyCount') {
      try { S.data.tables = await call('/tables', { method: 'PUT', body: { count: $('#tableCount').value } }); toast(`صار عدد الطاولات ${S.data.tables.length}`, 'ok'); renderTablesView(); } catch (err) { toast(err.message, 'err'); }
      return;
    }
    if (t.id === 'printCards') return printTableCards();
    if (d.newOrder !== undefined) { e.stopPropagation(); return openOrderEditor({ table: d.forTable != null ? Number(d.forTable) : null }); }
    if (d.editOrder) { e.stopPropagation(); const o = S.orders.find((x) => x.id === d.editOrder); return o && openOrderEditor({ order: o }); }
    if (t.id === 'copyLink') return copyCustomerLink();
    if (t.id === 'themeBtn') return cycleTheme();
    if (d.themeSet) { setTheme(d.themeSet); renderThemeBtn(); return renderSettings(); }
    if (t.id === 'takeoverBtn') { relay?.takeover(); return toast('هلق هالجهاز هو الكاشير ✓', 'ok'); }
    if (t.id === 'saveGemini') return saveGeminiKey();
    if (t.id === 'backupBtn') return downloadBackup();
    if (t.id === 'clearGemini') return saveGeminiKey(true);
    if (t.id === 'saveSettings') return saveSettings();
    if (t.id === 'geoBtn') {
      try {
        const res = await call(`/geocode?q=${encodeURIComponent(val('s_city'))}`);
        $('#geoResults').innerHTML = res.length ? res.map((r) => `<button type="button" data-geo='${esc(JSON.stringify(r))}'>${esc(r.name)} — ${esc([r.admin, r.country].filter(Boolean).join('، '))}</button>`).join('') : '<p class="muted">ما لقينا هالمدينة، جرّب اسم ثاني.</p>';
      } catch (err) { toast(err.message, 'err'); }
      return;
    }
    if (d.geo) {
      const r = JSON.parse(d.geo);
      $('#s_city').value = r.name; $('#s_lat').value = r.lat; $('#s_lon').value = r.lon;
      $('#geoResults').innerHTML = '';
      return;
    }
    if (t.id === 'clearDemo') {
      if (!(await askConfirm('تمسح الطلبات التجريبية؟ التقارير والإحصائيات بتبلّش من الصفر.', 'امسحها'))) return;
      try { const r = await call('/demo/clear', { method: 'POST' }); S.data.demoOrders = 0; toast(`انمسح ${r.removed} طلب تجريبي`, 'ok'); renderSettings(); refreshBarStats(); } catch (err) { toast(err.message, 'err'); }
    }
  });

  document.addEventListener('change', async (e) => {
    const el = e.target;
    if (el.dataset.avail) {
      try {
        const it = await call(`/items/${el.dataset.avail}`, { method: 'PUT', body: { available: el.checked } });
        Object.assign(itemById(it.id), it);
        toast(it.available ? `${it.name} رجع متوفر` : `${it.name} صار "نفد" عند الزبائن`, 'ok');
        renderMenuView();
      } catch (err) { toast(err.message, 'err'); el.checked = !el.checked; }
    }
    if (el.dataset.offerActive) {
      try {
        const o = await call(`/offers/${el.dataset.offerActive}`, { method: 'PUT', body: { active: el.checked } });
        Object.assign(S.data.offers.find((x) => x.id === o.id), o);
        await reloadItems();
        renderOffers();
      } catch (err) { toast(err.message, 'err'); }
    }
    if (el.dataset.tzone) {
      try { const tb = await call(`/tables/${el.dataset.tzone}`, { method: 'PUT', body: { zoneId: el.value } }); Object.assign(S.data.tables.find((x) => x.number === tb.number), tb); toast(`طاولة ${tb.number} انتقلت لـ${zoneById(tb.zoneId).name}`, 'ok'); } catch (err) { toast(err.message, 'err'); }
    }
    if (el.id === 'qrBase') { store.set('qrBase', el.value.trim()); renderTablesView(); }
  });
  $('#itemSearch').addEventListener('input', (e) => { S.search = e.target.value; renderMenuView(); });
  document.addEventListener('keydown', (e) => {
    if (!$('#login').hidden) {
      if (/^\d$/.test(e.key) && pin.length < 8) { pin += e.key; renderPin(); }
      else if (e.key === 'Backspace') { pin = pin.slice(0, -1); renderPin(); }
      else if (e.key === 'Enter') tryLogin();
      return;
    }
    if (e.key === 'Escape' && S.selected != null && !document.querySelector('.sheet.is-open')) closeDrawer();
  });
  document.addEventListener('change', (e) => { if (e.target.id === 'restoreFile') restoreBackup(e.target); });
  // نسخة الموقع: إذا امتلت ذاكرة المتصفح بننبّه مرة وحدة
  let warnedFull = false;
  addEventListener('cafe:storage-full', () => {
    if (warnedFull) return;
    warnedFull = true;
    toast('ذاكرة المتصفح امتلت وما عاد في حفظ! روح عالإعدادات ونزّل نسخة احتياطية', 'err');
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    S.unseen = 0;
    document.title = `لوحة الكاشير — ${S.data?.settings.cafeName ?? ''}`;
    resync();
  });
  setInterval(() => {
    $('#clock').textContent = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }, 1000);
  setInterval(() => { if (S.data && (S.view === 'floor' || S.view === 'orders')) refreshLive(); }, 30_000);
}

// ───────── الاتصال المباشر ─────────
function connect() {
  if (typeof io !== 'function') return;
  S.socket?.disconnect();
  const sock = io({ auth: { token: S.token } });
  S.socket = sock;
  const live = $('#live');
  if (relay) relay.onChange(renderRelay);
  else sock.on('connect', () => { live.classList.remove('off'); live.querySelector('span').textContent = 'مباشر'; });
  sock.on('disconnect', () => { live.classList.add('off'); live.querySelector('span').textContent = 'منقطع'; });
  sock.on('order:new', (o) => {
    applyOrder(o);
    S.justIn.add(o.table);
    setTimeout(() => { S.justIn.delete(o.table); }, 2600);
    refreshLive();
    if (o.source === 'cashier') return; // الكاشير هو اللي عمله، ما في داعي للجرس
    if (S.sound) chime('order');
    toast(`طلب جديد من ${placeLabel(o)} · ${moneyText(o.total, cur())}`);
    if (document.hidden) { S.unseen++; document.title = `(${S.unseen}) طلب جديد — ${S.data.settings.cafeName}`; }
    refreshBarStats();
  });
  sock.on('order:update', (o) => applyOrder(o));
  sock.on('day:closed', async () => {
    try { const fresh = await call('/bootstrap'); S.orders = fresh.orders; S.calls = fresh.calls; refreshLive(); refreshBarStats(); if (S.view === 'reports') renderReports(); } catch { /* */ }
  });
  sock.on('call:new', (c) => {
    if (!S.calls.some((x) => x.id === c.id)) S.calls.push(c);
    refreshLive();
    if (S.sound) chime('call');
    toast(c.kind === 'bill' ? `طاولة ${c.table} طالبة الحساب` : `طاولة ${c.table} بتنادي نادل`, 'err');
  });
  sock.on('call:resolved', (r) => {
    S.calls = S.calls.filter((c) => (r.id ? c.id !== r.id : c.table !== r.table));
    refreshLive();
  });
}

// نسخة العرض بدون سيرفر: هاللوحة هي اللي بتستقبل طلبات الجوالات (عبر رابط الزبائن اللي فيه كودها)
const RELAY_TEXT = {
  online: ['مربوط', 'هالجهاز هو الكاشير: الطلبات من أي جوال بتوصل لهون. اضغط لتشوف الرابط والـ QR'],
  connecting: ['عم يتصل…', 'عم نربط اللوحة بالإنترنت لتستقبل طلبات الجوالات'],
  standby: ['مش الكاشير', 'في جهاز ثاني هو الكاشير هلق. من قسم الطاولات بتقدر تخلّي هالجهاز هو الكاشير'],
  tab: ['مربوط', 'في تبويب ثاني للوحة مفتوح بنفس المتصفح، وهو اللي بيستقبل الطلبات'],
};
function renderRelay(state) {
  const live = $('#live');
  const [label, hint] = RELAY_TEXT[state] ?? RELAY_TEXT.connecting;
  live.classList.toggle('off', state === 'connecting' || state === 'standby');
  live.dataset.link = '';
  live.title = hint;
  live.querySelector('span').textContent = label;
  if (S.view === 'tables') renderCashierCard();
}
/** مين الكاشير: هالجهاز ولا جهاز ثاني (وزر لتغييره) */
function renderCashierCard() {
  const box = $('#cashierCard');
  if (!box || !relay) return;
  box.hidden = false;
  const st = relay.state;
  box.className = `cashier-card ${st}`;
  box.innerHTML = st === 'online'
    ? `${icon('check-circle')}<div><strong>هالجهاز هو الكاشير</strong><small>الطلبات من أي جوال بتوصل لهون. خلّي اللوحة مفتوحة وقدّامك؛ إذا سكّرتها بتنحفظ الطلبات وبتوصلك لما ترجع.</small></div>`
    : st === 'standby'
      ? `${icon('info')}<div><strong>في جهاز ثاني هو الكاشير هلق</strong><small>الطلبات رايحة لهداك الجهاز. بدك تستقبلها على هالجهاز؟</small></div><button class="btn btn-brass btn-sm" type="button" id="takeoverBtn">خلّي هالجهاز هو الكاشير</button>`
      : st === 'tab'
        ? `${icon('info')}<div><strong>اللوحة مفتوحة بتبويب ثاني</strong><small>هداك التبويب هو اللي بيستقبل الطلبات بهالمتصفح.</small></div>`
        : `${icon('clock')}<div><strong>عم نتصل…</strong><small>إذا طوّل، تأكد من الإنترنت.</small></div>`;
}

/** لما ترجع اللوحة قدّام الكاشير (الجوال بيوقّفها بالخلفية): نجيب اللي فاتنا من طلبات ونداءات */
async function resync() {
  if (!S.data) return;
  try {
    const fresh = await call('/bootstrap');
    const missed = fresh.orders.filter((o) => o.status === 'new' && !S.orders.some((x) => x.id === o.id));
    const newCalls = fresh.calls.filter((c) => !S.calls.some((x) => x.id === c.id));
    S.orders = fresh.orders;
    S.calls = fresh.calls;
    refreshLive();
    refreshBarStats();
    if (missed.length || newCalls.length) {
      if (S.sound) chime(missed.length ? 'order' : 'call');
      toast(missed.length ? `وصلك ${missed.length === 1 ? 'طلب جديد' : `${missed.length} طلبات جديدة`} وإنت برّا اللوحة` : 'في نداء نادل وصل وإنت برّا اللوحة');
    }
  } catch { /* */ }
}

async function boot() {
  try {
    const data = await call('/bootstrap');
    S.data = data;
    S.orders = data.orders;
    S.calls = data.calls;
  } catch (err) {
    if (err.status !== 401) showLogin(err.message);
    return;
  }
  $('#app').hidden = false;
  renderShell();
  setView(VIEWS.some((v) => v.id === store.get('view')) ? store.get('view') : 'floor');
  refreshBarStats();
  connect();
  relay?.host(); // بعد ما يدخل الكاشير: هالجهاز بيصير الكاشير إذا ما في غيره
}

S.sound = store.get('sound') !== '0';
bind();
S.token = store.get('token');
if (S.token) boot(); else showLogin();
