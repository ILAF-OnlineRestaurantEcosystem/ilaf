import { $, $$, esc, api, moneyText, toast, openSheet, closeSheet, reducedMotion, revealOnScroll, chime, SUGAR, STATUS, THEMES, themePref, setTheme, TENANT, storeKey, bizWords, applyBusiness, frozenNow } from './common.js';
import { brandLogo, fitLogo, brandMark, dallahIcon, artTile, itemArt, icon, weatherIcon, leavesArt, setBusiness, isRestaurant, setStoreLogo } from './art.js';
import { recommend, MOODS, SWEETNESS, PEOPLE } from './chooser.js';
import { applyPalette } from './palette.js';

const LS = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(storeKey(k))) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(storeKey(k), JSON.stringify(v)); } catch { /* التخزين اختياري */ } },
};

// معرّف هالجهاز: بيربط طلباته فيه لـ"تابع طلبي" (الموقع ما بيقدر يقرأ IP أو MAC، وكل زباين الواي فاي إلهم نفس الـ IP)
// السيرفر بينساه لما الكاشير يسكّر الطاولة
const DEVICE = (() => {
  let v = LS.get('device', '');
  if (!/^[a-z0-9]{12,40}$/.test(v)) {
    v = Array.from(crypto.getRandomValues(new Uint8Array(14)), (x) => 'abcdefghijkmnpqrstuvwxyz23456789'[x % 32]).join('');
    LS.set('device', v);
  }
  return v;
})();
const tableUrl = (n) => `/tables/${n}?device=${DEVICE}${state.session?.sessionId ? `&session=${encodeURIComponent(state.session.sessionId)}` : ''}`;

const state = {
  pending: LS.get('pending', []), // طلبات محفوظة لسا ما استلمها الكاشير
  menu: null,
  weather: null,
  cart: LS.get('cart', []),
  table: null,
  tableZone: '',
  tableTop: [],
  orders: [],
  chat: [],
  chatBusy: false,
  helper: { step: 0, mood: null, sweet: null, people: 1 },
  result: null,
  lastCall: null,
  session: LS.get('session', null), // { table, sessionId } فاتورة الطاولة المفتوحة
  forceAsk: false,
  paidNotice: null,
};

const S = () => state.menu.settings;
const W = () => bizWords(S().businessType);
const itemById = (id) => state.menu?.items.find((i) => i.id === id);
const offerById = (id) => state.menu?.offers.find((o) => o.id === id);
const catById = (id) => state.menu?.categories.find((c) => c.id === id);
const priceText = (n) => {
  const v = Math.round(Number(n) * 100) / 100;
  return `${Number.isInteger(v) ? v : v.toFixed(1)} ${S().currencyName || S().currency}`;
};
const pad2 = (n) => String(n).padStart(2, '0');
const CAT_HUE = { hot: 28, cold: 34, juice: 38, dessert: 26, bakery: 32 };

// ───────── التنقل بين الشاشات ─────────
const TAB_SCREENS = ['home', 'category', 'cart', 'bill', 'more'];
const FAB_SCREENS = ['category', 'more']; // بالرئيسية نديم جوا البطاقات (ما بيغطي اشي)
const CART_BAR_SCREENS = ['home', 'category'];
const trail = [];
let current = null;

function go(name, param) {
  const hash = '#' + name + (param != null ? '/' + encodeURIComponent(param) : '');
  if (location.hash === hash) render(name, param, 'none');
  else location.hash = hash;
}
function back() {
  if (trail.length > 1) history.back();
  else go(state.table ? 'home' : 'welcome');
}
function parseHash() {
  const [name, param] = location.hash.slice(1).split('/');
  return { name: name || null, param: param != null ? decodeURIComponent(param) : null };
}
function onHash() {
  const { name, param } = parseHash();
  if (name === 'orders') { go('bill'); return; }
  // ما في اشي قبل رقم الطاولة
  if (!state.table && !['welcome', 'track', 'sent'].includes(name)) { go('welcome'); return; }
  if (!name || !document.querySelector(`[data-screen="${name}"]`)) { go(state.table ? 'home' : 'welcome'); return; }
  const h = location.hash;
  let dir = 'fwd';
  if (trail.length > 1 && trail[trail.length - 2] === h) { trail.pop(); dir = 'back'; } else trail.push(h);
  render(name, param, trail.length === 1 ? 'none' : dir);
}
function render(name, param, dir) {
  const el = document.querySelector(`[data-screen="${name}"]`);
  const prev = current && current !== el ? current : null;
  ({
    welcome: renderWelcome, table: renderTable, home: renderHome, category: () => renderCategory(param),
    helper: renderHelper, result: renderResult, cart: renderCart, sent: () => renderSent(param),
    bill: renderBill, more: renderMore, track: renderTrack,
  })[name]?.();
  if (prev) {
    prev.classList.remove('is-active', 'enter-fwd', 'enter-back');
    if (dir !== 'none' && !reducedMotion()) { prev.classList.add('leave'); setTimeout(() => prev.classList.remove('leave'), 450); }
  }
  el.classList.remove('enter-fwd', 'enter-back');
  void el.offsetWidth;
  el.classList.add('is-active');
  if (dir === 'fwd') el.classList.add('enter-fwd');
  if (dir === 'back') el.classList.add('enter-back');
  if (prev || dir !== 'back') el.scrollTop = 0;
  current = el;
  const tabName = name === 'category' ? 'home' : name;
  $('#tabbar').classList.toggle('is-hidden', !TAB_SCREENS.includes(name));
  $$('#tabbar [data-tab]').forEach((b) => {
    if (b.dataset.tab === tabName) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  $('#fab').classList.toggle('is-hidden', !FAB_SCREENS.includes(name));
  updateCartBar(name);
  revealOnScroll(el);
}

// ───────── الطاولة ─────────
function initTable() {
  const saved = LS.get('table', null);
  if (saved && Date.now() - saved.at < 6 * 3600 * 1000) state.table = saved.n;
  else { state.session = null; LS.set('session', null); }
}
async function setTable(n, { silent = true, info: ready = null } = {}) {
  const info = ready ?? await api(tableUrl(n));
  state.table = info.number;
  state.tableZone = info.zone;
  state.tableTop = info.top ?? [];
  LS.set('table', { n: info.number, at: Date.now() });
  $$('[data-appbar]').forEach(renderAppbar);
  if (!silent) toast(`تمام، طاولة ${info.number} · ${info.zone}`, 'ok');
  return info;
}

// ───────── أجزاء مشتركة ─────────
function renderAppbar(el) {
  el.innerHTML = `
    <button class="table-badge" type="button" data-go="table" aria-label="الطاولة">
      <span class="tb-label">${icon('grid')}الطاولة</span>
      <span class="tb-no">${state.table ? pad2(state.table) : '—'}</span>
    </button>
    ${brandMark(S().cafeName)}
    <button class="icon-btn" type="button" data-back aria-label="رجوع">${icon('arrow')}</button>`;
}
function itemRow(it) {
  const n = state.cart.filter((l) => l.kind === 'item' && l.id === it.id).reduce((s, l) => s + l.qty, 0);
  const popular = state.menu.popular.includes(it.id);
  return `
    <article class="item-row ${it.available ? '' : 'is-out'}" data-reveal data-item="${esc(it.id)}">
      <button class="item-hit" type="button" data-open-item="${esc(it.id)}" aria-label="${esc(it.name)}، التفاصيل"></button>
      ${artTile(it)}
      ${n ? `<span class="in-cart">${n}</span>` : ''}
      <div class="ir-info">
        <h3>${esc(it.name)}</h3>
        <p>${esc(it.desc)}</p>
        <span class="price"><b>${priceText(it.price).split(' ')[0]}</b> ${esc(S().currencyName || S().currency)}${it.was ? `<s>${priceText(it.was)}</s>` : ''}</span>
        <span class="badges">
          ${!it.available ? '<span class="badge badge-mute">مش متوفر حالياً</span>' : ''}
          ${it.available && it.left ? `<span class="badge badge-coral">باقي ${it.left} بس</span>` : ''}
          ${it.was ? `<span class="badge badge-sale">${icon('tag')}عرض</span>` : ''}
          ${popular && it.available ? `<span class="badge badge-gold">${icon('star')}مطلوب</span>` : ''}
        </span>
      </div>
      <button class="plus" type="button" data-quick-add="${esc(it.id)}" aria-label="أضف ${esc(it.name)} للطلب">${icon('plus')}</button>
    </article>`;
}
function fillIcons(root = document) {
  $$('[data-icon]', root).forEach((el) => { if (!el.firstElementChild) el.innerHTML = icon(el.dataset.icon); });
}
function greetingWord() {
  const h = new Date().getHours();
  return h >= 5 && h < 12 ? 'صباح الخير' : 'مسا الخير';
}

// ───────── 1. الترحيب ─────────
let welcomePlayed = false;
function renderWelcome() {
  const s = S();
  if (!welcomePlayed) {
    const prefix = s.cafeName.replace(s.brandWord, '').trim() || 'كافي';
    $('#welcomeLogo').innerHTML = brandLogo({ word: s.brandWord, prefix, mode: reducedMotion() ? 'static' : 'pour' });
    fitLogo($('#welcomeLogo svg'));
    welcomePlayed = true;
  }
  $('#welcomeTitle').textContent = `أهلاً فيك في ${s.cafeName}`;
  updateWelcomeTrack();
  // زبون راجع وعنده طاولة محفوظة: منسأله إذا لسا عليها بدل ما يكتب الرقم من جديد
  // QR طاولة معيّنة (?table=12): رقمها بيطلع جاهز، والزبون بيكبس "ابدأ الطلب" بس
  const urlTable = takeUrlTable();
  const returning = state.table && !state.forceAsk && (!urlTable || urlTable === state.table) && (state.session || state.cart.length);
  $('#welcomeAsk').hidden = !!returning;
  $('#welcomeBack').hidden = !returning;
  if (returning) {
    $('#backLine').innerHTML = `لسا قاعد على طاولة <b>${pad2(state.table)}</b>؟${state.session ? ' فاتورتك مفتوحة ومحفوظة.' : ''}`;
    $('#keepTable').innerHTML = `أيوه، كمّل على طاولة ${pad2(state.table)} ${icon('arrow', 'arrow')}`;
    return;
  }
  pickDraft = urlTable ? String(urlTable) : state.forceAsk && state.table ? String(state.table) : '';
  $('#keypad').innerHTML = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button type="button" data-key="${n}">${n}</button>`).join('')
    + `<button type="button" data-key="clear" aria-label="مسح الكل">${icon('close')}</button><button type="button" data-key="0">0</button><button type="button" data-key="back" aria-label="حذف رقم">${icon('arrow')}</button>`;
  $('#pickConfirm').innerHTML = `ابدأ الطلب ${icon('arrow', 'arrow')}`;
  updatePick();
}

// ───────── 2. الطاولة ─────────
let pickDraft = '';
let urlTableUsed = false;
/** رقم الطاولة من رابط QR الطاولة (بينستعمل مرة وحدة بس) */
function takeUrlTable() {
  if (urlTableUsed) return null;
  urlTableUsed = true;
  const n = Number(new URLSearchParams(location.search).get('table'));
  return Number.isInteger(n) && n >= 1 && n <= (state.menu?.tableCount ?? 300) ? n : null;
}
let pickThen = null;
function tableArtSvg(n) {
  return `
  <svg viewBox="0 0 200 170" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true">
    <g class="rays" stroke-width="2.6">
      <path class="ray" d="M54 22l12 10M146 22l-12 10M40 58h14M160 58h-14M100 6v-2"/>
    </g>
    <circle cx="100" cy="52" r="30" style="fill: var(--tide)"/>
    <text x="100" y="62" text-anchor="middle" font-family="Alexandria, sans-serif" font-size="28" font-weight="700" fill="currentColor" stroke="none">${n ? pad2(n) : '؟'}</text>
    <path d="M30 104h140" stroke-width="7"/>
    <path d="M44 104l-10 56M156 104l10 56M70 104l-4 40M130 104l4 40" stroke-width="5"/>
    <path d="M66 124h68" stroke-width="3"/>
  </svg>`;
}
function renderTable() {
  if (!state.table) { go('welcome'); return; }
  $('#tableArt').innerHTML = tableArtSvg(state.table);
  $('#tableLine').innerHTML = `الطاولة رقم <b>${pad2(state.table)}</b>`;
  $('#tableZone').textContent = state.tableZone;
  const top = state.tableTop.slice(0, 2).map((t) => t.name);
  $('#tableInsight').textContent = top.length ? `زباين هالطاولة بيحبوا ${top.join(' و')}` : 'استمتع بتجربتك واكتشف قائمتنا المميزة';
  $('#browseBtn').innerHTML = `تصفّح المنيو ${icon('arrow', 'arrow')}`;
  $('#discoverBtn').innerHTML = `${icon('sparkle')}اكتشف اختيارك`;
}
let zoneTimer;
function updatePick() {
  $('#pickDisplay').textContent = pickDraft || '—';
  const z = $('#pickZone');
  z.classList.remove('err');
  z.textContent = 'الرقم مكتوب على طاولتك';
  clearTimeout(zoneTimer);
  const n = Number(pickDraft);
  if (!n) return;
  if (n > state.menu.tableCount) { z.textContent = `الطاولات من 1 لـ ${state.menu.tableCount}`; z.classList.add('err'); return; }
  zoneTimer = setTimeout(async () => {
    try {
      const info = await api(tableUrl(n));
      if (Number(pickDraft) !== n) return;
      const busy = info.busy && !info.mine && state.table !== n;
      z.textContent = busy ? `${info.zone} · مشغولة هلق` : info.zone;
      z.classList.toggle('busy', busy);
    } catch { /* */ }
  }, 180);
}
async function confirmPick() {
  const n = Number(pickDraft);
  if (!n || n > state.menu.tableCount) { toast('اكتب رقم طاولتك أول', 'err'); return; }
  try {
    const info = await api(tableUrl(n));
    // عليها ناس طالبين ومش إنت منهم: منسأل قبل ما نكمّل
    if (info.busy && !info.mine && state.table !== n) {
      busyPick = { n, info };
      $('#busyTitle').textContent = `طاولة ${pad2(n)} مشغولة هلق 👀`;
      openSheet($('#busySheet'));
      return;
    }
    await finishPick(n, info);
  } catch (err) { toast(err.message, 'err'); }
}
let busyPick = null;
async function finishPick(n, info) {
  try {
    const changed = state.table !== n;
    await setTable(n, { info });
    if (changed) { state.session = null; LS.set('session', null); }
    state.forceAsk = false;
    const then = pickThen; pickThen = null;
    if (then) then(); else go('table');
  } catch (err) { toast(err.message, 'err'); }
}
function needTable(then) {
  if (state.table) return true;
  pickThen = then;
  state.forceAsk = true;
  go('welcome');
  return false;
}

// ───────── 3. القائمة ─────────
function renderHome() {
  renderAppbar($('[data-screen="home"] [data-appbar]'));
  renderHomeTrack();
  const { categories, items, offers, popular } = state.menu;
  const w = state.weather;
  $('#greet').innerHTML = w?.ok
    ? `${weatherIcon(w)}<span>${greetingWord()} · ${esc(w.city)} ${w.temp}° ${esc(w.desc)}</span>`
    : `${icon('sun')}<span>${greetingWord()}، شو حابب اليوم؟</span>`;
  const cats = categories.filter((c) => items.some((i) => i.categoryId === c.id));
  const featAuto = renderStrips();
  const CAT_TINT = [28, 200, 340, 18, 140, 260, 45];
  $('#catGrid').innerHTML = cats.map((c, i) => `
    <button class="cat-tile ${cats.length % 2 === 1 && i === cats.length - 1 ? 'wide' : ''}" type="button" data-go="category" data-param="${esc(c.id)}" style="--ch:${CAT_TINT[i % CAT_TINT.length]}" data-reveal>
      ${artTile({ image: c.image, art: c.icon, hue: CAT_HUE[c.id] ?? 30 })}
      <span class="cat-meta"><span><strong>${esc(c.name)}</strong>${c.en ? `<small>${esc(c.en)}</small>` : ''}</span><span class="chev">${icon('chev')}</span></span>
    </button>`).join('');
  const pops = popular.map(itemById).filter((i) => i?.available);
  $('#popBlock').hidden = !pops.length || featAuto; // الشريط فوق بيعرضهم أصلاً
  $('#popRow').innerHTML = pops.map((it, idx) => `
    <article class="pop-card" data-item="${esc(it.id)}">
      <button class="item-hit" type="button" data-open-item="${esc(it.id)}" aria-label="${esc(it.name)}"></button>
      ${artTile(it)}
      <span class="pop-rank">${idx + 1}</span>
      <div class="pc-info"><h3>${esc(it.name)}</h3>
        <div class="pc-foot"><span class="price">${priceText(it.price)}</span>
          <button class="plus" type="button" data-quick-add="${esc(it.id)}" aria-label="أضف ${esc(it.name)}" style="position:relative;inset:auto;translate:none">${icon('plus')}</button></div></div>
    </article>`).join('');
  $('#offerBlock').hidden = !offers.length;
  $('#offerList').innerHTML = offers.map((o) => `
    <article class="offer" data-reveal>
      <div class="offer-top"><h3 class="offer-title">${esc(o.title)}</h3>
        ${o.type === 'combo' ? `<div class="offer-arts">${o.itemIds.map(itemById).filter(Boolean).map((i) => artTile(i)).join('')}</div>` : `<span class="sale-tag">${icon('tag')}خصم ${o.percent}%</span>`}</div>
      <p class="offer-desc">${esc(o.description)}</p>
      <div class="offer-foot">
        ${o.type === 'combo'
          ? `<div class="offer-price"><span>${priceText(o.price)}</span>${o.value > o.price ? `<s>${priceText(o.value)}</s>` : ''}</div>
             ${o.available ? `<button class="btn btn-promo btn-sm" type="button" data-add-offer="${esc(o.id)}">${icon('plus')}أضف العرض</button>` : '<span class="badge badge-mute">غير متوفر حالياً</span>'}`
          : `<div class="offer-arts">${o.itemIds.map(itemById).filter(Boolean).map((i) => artTile(i)).join('')}</div>
             <button class="btn btn-promo-line btn-sm" type="button" data-open-item="${esc(o.itemIds[0])}">شوف الأصناف</button>`}
      </div>
    </article>`).join('');
  $('#baristaAva').innerHTML = dallahIcon();
  if ($('#helperAva')) $('#helperAva').innerHTML = dallahIcon();
  $('#baristaTitle').textContent = `اسأل ${S().baristaName}، ${W().hostSmart}`;
  doHomeSearch();
}
// ───────── الشرائط المتحركة بالمنيو ─────────
// الكاشير بيختار لحد 3 شرائط (settings.strips): أصناف كل شريط، وكم ثانية على كل صنف، ووين بيطلع بالصفحة، وكم لفة بيلف.
// شريط بدون أصناف = الأكثر طلباً لحاله.
const strips = []; // حالة كل شريط: الصنف الحالي، المؤقت، اللفات
function stripDefs() {
  const s = S();
  if (Array.isArray(s.strips)) return s.strips;
  return [{ title: 'الأكثر طلباً', items: [], seconds: 4, place: 'top', loops: 0, ...(s.featured ?? {}) }]; // قبل ما الكاشير يغيّر إشي
}
function stripItems(def) {
  const chosen = (def.items ?? []).map(itemById).filter((i) => i?.available);
  if (chosen.length) return { list: chosen, auto: false };
  const pops = state.menu.popular.map(itemById).filter((i) => i?.available);
  return { list: (pops.length ? pops : state.menu.items.filter((i) => i.available)).slice(0, 6), auto: true };
}
/** بيرسم كل الشرائط بأماكنها، وبيرجّع true إذا واحد منها بيعرض الأكثر طلباً */
function renderStrips() {
  $$('[data-strip-slot]').forEach((slot) => { slot.innerHTML = ''; });
  const defs = stripDefs();
  let anyAuto = false;
  defs.forEach((def, k) => {
    const st = (strips[k] ??= { i: 0, ids: '' });
    clearInterval(st.timer);
    st.el = null;
    const { list, auto } = stripItems(def);
    if (!list.length) return;
    anyAuto ||= auto;
    const ids = list.map((i) => i.id).join(',');
    if (ids !== st.ids) { st.ids = ids; st.i = 0; }
    Object.assign(st, { n: list.length, ms: Math.min(10, Math.max(1, Number(def.seconds) || 4)) * 1000, loops: Number(def.loops) || 0, rounds: 0, stopped: false, paused: false });
    const title = def.title || 'الأكثر طلباً';
    const el = document.createElement('section');
    el.className = 'feat';
    el.dataset.strip = k;
    el.setAttribute('aria-roledescription', 'carousel');
    el.setAttribute('aria-label', title);
    el.style.setProperty('--feat-dur', `${st.ms}ms`);
    el.style.setProperty('--feat-move', `${Math.min(600, st.ms * 0.4)}ms`); // الشريط السريع حركته أسرع
    el.innerHTML = `
      <div class="feat-view"><div class="feat-track">${list.map((it, j) => `
        <article class="feat-slide" data-item="${esc(it.id)}" aria-roledescription="slide" aria-label="${j + 1} من ${list.length}: ${esc(it.name)}">
          <button class="item-hit" type="button" data-open-item="${esc(it.id)}" aria-label="${esc(it.name)}، التفاصيل"></button>
          ${artTile(it, 'big')}
          <div class="fs-info">
            <span class="fs-tag">${icon(auto ? 'flame' : 'star')}${esc(title)}${auto && list.length > 1 ? ` <b>#${j + 1}</b>` : ''}</span>
            <h3>${esc(it.name)}</h3>
            <p>${esc(it.desc ?? '')}</p>
            <div class="fs-foot"><span class="fs-price">${priceText(it.price)}${it.was ? ` <s>${priceText(it.was)}</s>` : ''}</span>
              <button class="fs-add" type="button" data-quick-add="${esc(it.id)}">${icon('plus')}أضف</button></div>
          </div>
        </article>`).join('')}</div></div>
      ${list.length > 1 ? `<div class="feat-dots">${list.map((it, j) => `<button type="button" data-feat="${j}" aria-label="${esc(it.name)}"></button>`).join('')}</div>` : ''}`;
    ($(`[data-strip-slot="${def.place}"]`) ?? $('[data-strip-slot="top"]')).append(el);
    st.el = el;
    stripShow(st, st.i);
    stripStart(st);
  });
  strips.slice(defs.length).forEach((st) => clearInterval(st.timer));
  strips.length = Math.min(strips.length, defs.length);
  return anyAuto;
}
function stripShow(st, i) {
  const track = st.el?.querySelector('.feat-track');
  if (!track || !st.n) return;
  st.i = ((i % st.n) + st.n) % st.n;
  const rtl = getComputedStyle(st.el).direction === 'rtl'; // بالعربي الصنف الجاي على اليسار
  track.style.transform = `translateX(${(rtl ? 1 : -1) * st.i * 100}%)`;
  st.el.querySelectorAll('.feat-slide').forEach((s, k) => { s.inert = k !== st.i; });
  st.el.querySelectorAll('[data-feat]').forEach((d) => d.removeAttribute('aria-current'));
  const dot = st.el.querySelector(`[data-feat="${st.i}"]`);
  if (dot) { void dot.offsetWidth; dot.setAttribute('aria-current', 'true'); } // شريط التقدّم بيبلّش من جديد
}
function stripStart(st) {
  clearInterval(st.timer);
  if (st.n < 2 || st.stopped) return;
  st.timer = setInterval(() => {
    if (st.paused || document.hidden || current?.dataset.screen !== 'home' || !st.el?.isConnected || !st.el.offsetParent) return;
    // خلّص اللفات اللي اختارها الكاشير: بيوقف على أول صنف
    if (st.i === st.n - 1 && st.loops && ++st.rounds >= st.loops) {
      st.stopped = true;
      clearInterval(st.timer);
      st.el.classList.add('is-done');
      stripShow(st, 0);
      return;
    }
    stripShow(st, st.i + 1);
  }, st.ms);
}
/** السحب باليد (يمين/يسار) والنقاط، والشريط بيوقف وانت ماسكه */
function bindStrips() {
  const home = $('[data-screen="home"]');
  let drag = null, swiped = false;
  const stOf = (el) => strips[Number(el?.closest('.feat')?.dataset.strip)];
  const pause = (st, on) => { st.paused = on; st.el?.classList.toggle('is-paused', on); };
  home.addEventListener('pointerdown', (e) => {
    swiped = false;
    const st = e.target.closest('.feat-view') && stOf(e.target);
    if (!st) return;
    drag = { st, x0: e.clientX, y0: e.clientY };
    pause(st, true);
  });
  const end = (e) => {
    if (!drag) return;
    const { st, x0, y0 } = drag;
    drag = null;
    pause(st, false);
    const dx = e.clientX - x0, dy = e.clientY - y0;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      swiped = true;
      const rtl = getComputedStyle(st.el).direction === 'rtl';
      stripShow(st, st.i + ((dx > 0) === rtl ? 1 : -1));
    } else stripShow(st, st.i);
    stripStart(st);
  };
  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', end);
  home.addEventListener('click', (e) => {
    if (swiped && e.target.closest('.feat')) { swiped = false; e.preventDefault(); e.stopPropagation(); return; } // السحب مش كبسة على الصنف
    const dot = e.target.closest('.feat [data-feat]');
    if (dot) { const st = stOf(dot); stripShow(st, Number(dot.dataset.feat)); stripStart(st); }
  }, true);
}

function doHomeSearch() {
  const q = $('#homeSearch').value.trim();
  $('#homeMain').hidden = !!q;
  $('[data-strip-slot="top"]').classList.toggle('is-off', !!q);
  $('#homeResults').hidden = !q;
  if (!q) return;
  const list = state.menu.items.filter((i) => i.name.includes(q) || i.desc.includes(q) || (i.tags ?? []).some((t) => t.includes(q)));
  $('#homeResults').innerHTML = list.length
    ? `<div class="item-list">${list.map(itemRow).join('')}</div>`
    : `<div class="empty"><p>ما لقينا "${esc(q)}". جرّب كلمة ثانية، أو اسأل ${W().host}.</p><button class="btn btn-ghost btn-sm" type="button" data-open-chat>اسأل ${esc(S().baristaName)}</button></div>`;
  revealOnScroll($('#homeResults'));
}

// ───────── 4. القسم ─────────
let currentCat = null;
function renderCategory(id) {
  const c = catById(id) ?? state.menu.categories[0];
  currentCat = c.id;
  renderAppbar($('[data-screen="category"] [data-appbar]'));
  $('#catTitle').textContent = c.name;
  $('#catSub').textContent = c.desc || '';
  $('#catSearch').value = '';
  $('#catSearch').placeholder = `ابحث في ${c.name}…`;
  renderCatItems();
}
function renderCatItems() {
  const q = $('#catSearch').value.trim();
  const list = state.menu.items
    .filter((i) => i.categoryId === currentCat && (!q || i.name.includes(q) || i.desc.includes(q)))
    .sort((a, b) => b.available - a.available);
  $('#catItems').innerHTML = list.length ? list.map(itemRow).join('') : '<div class="empty"><p>ما في نتائج.</p></div>';
  revealOnScroll($('#catItems'));
}

// ───────── السلة ─────────
const lineKey = (l) => [l.kind, l.id, l.sugar ?? '', l.note ?? ''].join('|');
const linePrice = (l) => (l.kind === 'offer' ? offerById(l.id)?.price : itemById(l.id)?.price) ?? 0;
const lineName = (l) => (l.kind === 'offer' ? `عرض ${offerById(l.id)?.title ?? ''}` : itemById(l.id)?.name ?? '');
function cartTotals() {
  let total = 0, saving = 0, count = 0;
  for (const l of state.cart) {
    total += linePrice(l) * l.qty;
    count += l.qty;
    if (l.kind === 'offer') { const o = offerById(l.id); if (o) saving += (o.value - o.price) * l.qty; }
    else { const it = itemById(l.id); if (it?.was) saving += (it.was - it.price) * l.qty; }
  }
  return { total, saving, count };
}
/** شريط الطلب الثابت تحت: كم صنف والمجموع، وكبسة وحدة للسلة */
function updateCartBar(screen = current?.dataset.screen) {
  const bar = $('#cartBar');
  if (!bar || !state.menu) return;
  const { total, count } = cartTotals();
  const show = count > 0 && CART_BAR_SCREENS.includes(screen);
  bar.hidden = !show;
  document.body.classList.toggle('has-cartbar', show);
  if (show) bar.innerHTML = `<span class="cb-count">${count}</span><span class="cb-text"><b>طلبك</b><small>${count === 1 ? 'صنف واحد' : `${count} أصناف`}</small></span><span class="cb-total">${priceText(total)}</span><span class="cb-go">كمّل ${icon('arrow', 'arrow')}</span>`;
}
function saveCart() {
  state.cart = state.cart.filter((l) => (l.kind === 'offer' ? offerById(l.id) : itemById(l.id)));
  LS.set('cart', state.cart);
  updateCartBar();
  const { count } = cartTotals();
  const badge = $('#cartCount');
  badge.hidden = !count;
  if (badge.textContent !== String(count)) { badge.textContent = count; badge.classList.remove('bump'); void badge.offsetWidth; badge.classList.add('bump'); }
}
function addToCart(line, fromEl) {
  const l = { kind: 'item', qty: 1, sugar: '', note: '', ...line };
  const existing = state.cart.find((x) => lineKey(x) === lineKey(l));
  if (existing) existing.qty = Math.min(20, existing.qty + l.qty);
  else state.cart.push(l);
  saveCart();
  flyToCart(fromEl);
  refreshCounts();
}
function refreshCounts() {
  $$('.item-row[data-item]').forEach((row) => {
    const n = state.cart.filter((l) => l.kind === 'item' && l.id === row.dataset.item).reduce((s, l) => s + l.qty, 0);
    let b = row.querySelector('.in-cart');
    if (!n) { b?.remove(); return; }
    if (!b) { b = document.createElement('span'); b.className = 'in-cart'; row.querySelector('.art').after(b); }
    b.textContent = n;
  });
}
function flyToCart(fromEl) {
  if (!fromEl || reducedMotion()) return;
  const src = fromEl.closest('.item-row, .pop-card, .sugg-card, .offer, .mini-card, .pick-card, .sheet')?.querySelector('.art');
  const target = $('#tabbar [data-tab="cart"]');
  if (!src || !target || $('#tabbar').classList.contains('is-hidden')) return;
  const a = src.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  const fly = src.cloneNode(true);
  fly.classList.add('flyer');
  Object.assign(fly.style, { left: a.left + 'px', top: a.top + 'px', width: a.width + 'px', height: a.height + 'px', margin: 0 });
  document.body.append(fly);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  fly.animate([
    { transform: 'translate(0,0) scale(1)', opacity: 1 },
    { transform: `translate(${dx * 0.4}px, ${dy * 0.3 - 80}px) scale(.6) rotate(-8deg)`, opacity: 1, offset: 0.45 },
    { transform: `translate(${dx}px, ${dy}px) scale(.15) rotate(10deg)`, opacity: 0.3 },
  ], { duration: 780, easing: 'cubic-bezier(.5,0,.3,1)' }).onfinish = () => fly.remove();
}

// ───────── لوح الصنف ─────────
let draft = null;
function openItem(id) {
  const it = itemById(id);
  if (!it) return;
  draft = { id, qty: 1, sugar: it.sugarChoice ? 'medium' : '' };
  const meter = (label, v) => `<div class="meter"><span>${label}</span><span class="meter-dots">${[1, 2, 3].map((n) => `<i class="${v >= n ? 'on' : ''}"></i>`).join('')}</span></div>`;
  $('#itemBody').innerHTML = `
    <div class="sheet-hero">${artTile(it, 'big')}<button class="icon-btn" type="button" data-close-sheet aria-label="إغلاق">${icon('close')}</button></div>
    <h2 class="detail-name" id="itemTitle">${esc(it.name)}</h2>
    <div class="detail-price">${priceText(it.price)}${it.was ? `<s>${priceText(it.was)}</s>` : ''}${it.available ? (it.left ? `<span class="badge badge-coral">باقي ${it.left} بس</span>` : '') : '<span class="badge badge-mute">مش متوفر حالياً</span>'}</div>
    <p class="detail-desc">${esc(it.desc)}</p>
    ${it.recipe ? `<div class="recipe"><h4>${icon('leaf')}من شو بيتكوّن</h4><p>${esc(it.recipe)}</p></div>` : ''}
    <div class="meters">${meter('الحلاوة', it.sugar)}${meter('الكافيين', it.caffeine)}</div>
    ${it.sugarChoice ? `<p class="opt-title">السكر</p>
      <div class="segmented" role="group" aria-label="كمية السكر">${Object.entries(SUGAR).map(([k, v]) => `<button type="button" data-sugar="${k}" aria-pressed="${k === 'medium'}">${v.replace('سكر ', '')}</button>`).join('')}</div>` : ''}
    <p class="opt-title">${W().note}</p>
    <input class="input" id="itemNote" maxlength="120" placeholder="مثلاً: حليب قليل الدسم، بدون كريمة">
    <button class="ask-link" type="button" data-ask-about="${esc(it.id)}">${icon('sparkle')}اسأل ${esc(S().baristaName)} عن ${esc(it.name)}</button>`;
  renderItemFoot();
  openSheet($('#itemSheet'));
}
function renderItemFoot() {
  const it = itemById(draft.id);
  $('#itemFoot').innerHTML = it.available ? `
    <div class="foot-row">
      <div class="stepper"><button type="button" data-step="1" aria-label="زيادة">${icon('plus')}</button><output>${draft.qty}</output><button type="button" data-step="-1" aria-label="إنقاص">${icon('minus')}</button></div>
      <button class="btn btn-brass" id="itemAdd" type="button">إضافة إلى الطلب · ${priceText(it.price * draft.qty)}</button>
    </div>` : '<p class="muted center">هالصنف مش متوفر حالياً، جرّب اشي ثاني أو اسأل نديم عن بديل.</p>';
}

// ───────── 5. ساعدنا نختارك ─────────
function renderHelper() {
  const h = state.helper;
  $('#helperBack').innerHTML = icon('arrow');
  $('#helperDots').innerHTML = [0, 1, 2].map((i) => `<i class="${i === h.step ? 'on' : i < h.step ? 'done' : ''}"></i>`).join('');
  const q = $('#helperQ');
  if (h.step === 0) {
    q.innerHTML = `<h2>شو نفسك اليوم؟</h2><p>اختار اللي بيناسب مزاجك</p>
      <div class="opt-grid">${MOODS.map((m) => `<button class="opt ${m.wide ? 'wide' : ''}" type="button" data-mood="${m.id}" aria-pressed="${h.mood === m.id}">${itemArt(m.art)}${m.label}</button>`).join('')}</div>`;
  } else if (h.step === 1) {
    q.innerHTML = `<h2>كيف بتحب الحلاوة؟</h2><p>منظبطلك السكر على ذوقك</p>
      <div class="opt-grid">${SWEETNESS.map((s, i) => `<button class="opt ${i === 2 ? 'wide' : ''}" type="button" data-sweet="${s.id}" aria-pressed="${h.sweet === s.id}">${icon(s.id === 'none' ? 'leaf' : s.id === 'light' ? 'drop' : 'heart')}${s.label}<small>${s.hint}</small></button>`).join('')}</div>`;
  } else {
    q.innerHTML = `<h2>كم واحد إنتو؟</h2><p>منعدّلك الكمية حسب القعدة</p>
      <div class="opt-grid">${PEOPLE.map((p) => `<button class="opt" type="button" data-people="${p.id}" aria-pressed="${h.people === p.id}">${icon(p.id === 1 ? 'person' : 'users')}${p.label}</button>`).join('')}</div>`;
  }
  q.classList.remove('anim'); void q.offsetWidth; q.classList.add('anim');
  $('#helperNext').innerHTML = h.step < 2 ? `التالي ${icon('arrow', 'arrow')}` : `${icon('sparkle')}شوف اختيارنا`;
}
function helperNext() {
  const h = state.helper;
  if (h.step === 0 && !h.mood) return toast('اختار شو نفسك أول', 'err');
  if (h.step === 1 && !h.sweet) return toast('اختار كيف بتحب الحلاوة', 'err');
  if (h.step < 2) { h.step++; renderHelper(); $('[data-screen="helper"]').scrollTop = 0; return; }
  state.result = recommend(state.menu, h, { weather: state.weather, tableTop: state.tableTop.map((t) => t.id) });
  if (!state.result) return toast('ما لقينا اشي مناسب هلأ، جرّب اختيار ثاني', 'err');
  go('result');
}

// ───────── 6. اختيارنا لك ─────────
function renderResult() {
  const r = state.result;
  if (!r) { go('helper'); return; }
  const m = r.main;
  const mini = (it, label, ic) => it ? `
    <p class="mini-head">${icon(ic)}${label}</p>
    <article class="mini-card" data-item="${esc(it.id)}">
      <button class="item-hit" type="button" data-open-item="${esc(it.id)}" aria-label="${esc(it.name)}"></button>
      ${artTile(it)}
      <div class="mc-info"><strong>${esc(it.name)}</strong><small>${esc(it.desc)}</small><small><b style="color:var(--foam)">${priceText(it.price)}</b></small></div>
      <button class="plus" type="button" data-quick-add="${esc(it.id)}" aria-label="أضف ${esc(it.name)}">${icon('plus')}</button>
    </article>` : '';
  $('#resultBody').innerHTML = `
    <article class="pick-card">
      <button class="item-hit" type="button" data-open-item="${esc(m.id)}" aria-label="${esc(m.name)}"></button>
      ${artTile(m, 'big')}
      <span class="pick-seal">اختيارنا<br>إلك</span>
      <div class="pick-info">
        <h2>${esc(m.name)}</h2>
        <p class="muted">${esc(m.desc)}</p>
        <div class="meta"><span>${r.qty > 1 ? `${r.qty} × ` : ''}${r.sugar ? SUGAR[r.sugar] : ''}</span><b>${priceText(m.price * r.qty)}</b></div>
        ${r.reasons.length ? `<ul class="reasons">${r.reasons.map((t) => `<li>${icon('sparkle')}${esc(t)}</li>`).join('')}</ul>` : ''}
      </div>
    </article>
    ${mini(r.side, 'اقتراح جانبي', 'heart')}
    ${mini(r.discover, 'جرّب اشي جديد', 'sparkle')}
    <div class="result-actions">
      <button class="btn btn-brass btn-block" type="button" id="addPick">${icon('bag')}إضافة إلى الطلب</button>
      <button class="btn btn-ghost btn-block" type="button" data-open-chat data-prefill="${esc(`اقترحتولي ${m.name}، بس بدي اشي ثاني قريب منه`)}">${icon('sparkle')}بدي اشي ثاني؟ احكي مع ${esc(S().baristaName)}</button>
      <button class="link-btn" type="button" id="redoHelper">أعد الاختيار من الأول</button>
    </div>`;
}

// ───────── 7. مراجعة الطلب ─────────
function renderCart() {
  const { total, saving, count } = cartTotals();
  $$('[data-screen="cart"] [data-back]').forEach((b) => { b.innerHTML = icon('arrow'); });
  if (!count) {
    $('#cartBody').innerHTML = `<div class="empty">${artTile({ art: 'cup', hue: 30 })}<p>طلبك لسا فاضي. اختار من المنيو، أو خلّينا نساعدك تختار.</p>
      <button class="btn btn-brass" type="button" data-go="home">تصفّح المنيو</button>${isRestaurant() ? '' : `<button class="btn btn-ghost" type="button" data-go="helper">${icon('sparkle')}ساعدنا نختارك</button>`}</div>`;
    return;
  }
  $('#cartBody').innerHTML = `
    <div class="table-card ${state.table ? '' : 'missing'}">
      <span class="table-chipbox">${state.table ? pad2(state.table) : '؟'}</span>
      <div>${state.table ? `<strong>الطاولة</strong><small>${esc(state.tableZone)}${state.session ? ' · بينضاف على فاتورتك المفتوحة' : ''}</small>` : '<strong>لسا ما اخترت طاولتك</strong><small>لازم نعرف وين نوصّل الطلب</small>'}</div>
      <button class="btn btn-ghost btn-sm" type="button" data-change-table>${state.table ? 'تغيير' : 'اختر'}</button>
    </div>
    <div class="cart-lines">
      ${state.cart.map((l, i) => {
        const it = l.kind === 'item' ? itemById(l.id) : null;
        const o = l.kind === 'offer' ? offerById(l.id) : null;
        const sub = [l.sugar ? SUGAR[l.sugar] : '', o ? o.names.join(' + ') : '', l.note].filter(Boolean).join(' · ');
        return `
          <div class="cart-line">
            ${artTile(it ?? itemById(o?.itemIds[0]) ?? { art: 'cup', hue: 30 })}
            <div class="cl-info"><h4>${esc(lineName(l))}</h4>${sub ? `<small>${esc(sub)}</small>` : ''}<span class="lp">${priceText(linePrice(l) * l.qty)}</span></div>
            <div class="stepper sm">
              <button type="button" data-line="${i}" data-delta="1" aria-label="زيادة">${icon('plus')}</button>
              <output>${l.qty}</output>
              <button type="button" data-line="${i}" data-delta="-1" aria-label="${l.qty === 1 ? 'حذف' : 'إنقاص'}">${icon(l.qty === 1 ? 'trash' : 'minus')}</button>
            </div>
          </div>`;
      }).join('')}
    </div>
    <label class="field"><span>ملاحظة على الطلب (اختياري)</span><textarea class="textarea" id="orderNote" maxlength="200" placeholder="مثلاً: جيبوا الحلو بعد القهوة"></textarea></label>
    <div class="totals">
      <div><span>المجموع الفرعي</span><span>${priceText(total + saving)}</span></div>
      ${saving > 0 ? `<div class="saving"><span>الخصم</span><span>− ${priceText(saving)}</span></div>` : ''}
      <div class="grand"><span>الإجمالي</span><span>${priceText(total)}</span></div>
    </div>
    <button class="btn btn-brass btn-block" id="placeOrder" type="button">تأكيد الطلب ${icon('arrow', 'arrow')}</button>`;
}
async function placeOrder(btn) {
  if (!needTable(() => go('cart'))) return;
  btn.classList.add('is-busy');
  btn.textContent = 'عم نبعت طلبك…';
  try {
    const order = await api('/orders', {
      method: 'POST',
      body: {
        table: state.table,
        note: $('#orderNote')?.value ?? '',
        source: state.cart.some((l) => l.via === 'barista') ? 'barista' : 'menu',
        device: DEVICE,
        lines: state.cart.map((l) => ({ kind: l.kind, id: l.id, qty: l.qty, note: l.note, options: l.sugar ? { sugar: l.sugar } : {} })),
      },
    });
    state.cart = [];
    saveCart();
    trackOrder(order);
    state.freshOrder = order.id;
    go('sent', order.id);
  } catch (err) {
    btn.classList.remove('is-busy');
    btn.innerHTML = `تأكيد الطلب ${icon('arrow', 'arrow')}`;
    if (err.queued) {
      // الكاشير مش فاتح: الطلب محفوظ وبيوصله أول ما يفتح اللوحة
      const { total, count } = cartTotals();
      state.pending.push({ reqId: err.reqId, at: Date.now(), total, count });
      LS.set('pending', state.pending);
      state.cart = [];
      saveCart();
      renderPending();
      toast(err.message, 'ok');
      go('home');
      return;
    }
    toast(err.message, 'err');
    if (err.status === 409) refreshMenu();
  }
}

/** طلبات انحفظت لأن الكاشير مش فاتح، لسا ما استلمها */
function renderPending() {
  const live = window.__CAFE_DEMO__?.queued?.() ?? {};
  state.pending = state.pending.filter((p) => live[p.reqId]);
  LS.set('pending', state.pending);
  const bar = $('#pendingBar');
  bar.hidden = !state.pending.length;
  if (current?.dataset.screen === 'home') renderHomeTrack();
  if (!state.pending.length) return;
  const count = state.pending.reduce((s, p) => s + p.count, 0);
  const total = state.pending.reduce((s, p) => s + p.total, 0);
  bar.innerHTML = `${icon('clock')}<span>${state.pending.length > 1 ? `${state.pending.length} طلبات` : 'طلبك'} (${count} ${count === 1 ? 'صنف' : 'أصناف'} · ${priceText(total)}) محفوظ وبيستنى الكاشير يفتح لوحته</span>`;
}
function onAccepted({ reqId, order }) {
  state.pending = state.pending.filter((p) => p.reqId !== reqId);
  LS.set('pending', state.pending);
  renderPending();
  trackOrder(order);
  state.freshOrder = order.id;
  chime('ok');
  toast(`الكاشير استلم طلبك ✓ رقمه #${order.no}`, 'ok');
  if (!$('#chat').classList.contains('is-open')) go('sent', order.id);
}

// ───────── 8. تم الإرسال / المتابعة ─────────
let socket;
const STEPS = [
  { key: 'new', label: 'تم إرسال الطلب' },
  { key: 'preparing', label: 'الكاشير قبل الطلب، وجاري التحضير' },
  { key: 'ready', label: 'جاهز، وجاي لطاولتك' },
  { key: 'served', label: 'تم التوصيل، صحتين وعافية' },
];
const timeOf = (iso) => new Date(iso).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' });
function renderSent(id) {
  const o = state.orders.find((x) => x.id === id) ?? latestOrder();
  $('#sentBack').innerHTML = icon('arrow');
  if (!o) { $('#sentBody').innerHTML = '<div class="empty"><p>ما في طلب لنعرضه.</p></div>'; return; }
  const fresh = state.freshOrder === o.id;
  const idx = o.status === 'paid' ? 3 : STEPS.findIndex((s) => s.key === o.status);
  const at = (key) => o.history?.find((h) => h.status === key)?.at;
  const waiterOn = state.lastCall && Date.now() - state.lastCall.at < 10 * 60 * 1000;
  $('#sentBody').innerHTML = `
    <div class="sent-hero">
      ${fresh ? `<span class="sent-check">${icon('check')}</span><h1>تم إرسال طلبك بنجاح!</h1><p>رح يستلم طلبك فريق ${esc(S().cafeName)} هلأ</p>`
        : `<h1 class="screen-title">طلب #${o.no}</h1><span class="status-chip ${o.status}">${STATUS[o.status].label}</span>`}
    </div>
    <div class="order-card">
      <div class="order-card-head"><strong>رقم الطلب #${o.no}</strong><span>الطاولة ${pad2(o.table)} · ${timeOf(o.createdAt)}</span></div>
      ${o.lines.map((l) => `<div class="ol"><span>${l.qty} × ${esc(l.name)}${l.options?.sugar ? ` <small class="muted">(${SUGAR[l.options.sugar]})</small>` : ''}</span><b>${priceText(l.lineTotal)}</b></div>`).join('')}
      <div class="ol" style="border-top:1px dashed var(--line-strong);padding-top:8px"><span>الإجمالي</span><b>${priceText(o.total)}</b></div>
    </div>
    ${o.status === 'cancelled' ? '<div class="empty"><p>انلغى هالطلب. إذا في سؤال نادِ النادل.</p></div>' : `
    <div class="order-card timeline">
      ${STEPS.map((s, i) => {
        const cls = i < idx ? 'done' : i === idx ? 'now' : '';
        const t = at(s.key);
        return `<div class="tl ${cls}"><i>${i <= idx ? icon('check') : ''}</i><span>${s.label}</span><time>${t && i <= idx ? timeOf(t) : ''}</time></div>`;
      }).join('')}
    </div>`}
    ${waiterOn ? `<div class="waiter-banner">${icon('bell')}<div><strong>${state.lastCall.kind === 'bill' ? 'النادل جاي مع الفاتورة' : `النادل متّجه لطاولة ${pad2(state.table)}`}</strong><small>ثواني وبيكون عندك</small></div></div>` : ''}
    <div class="stack">
      <button class="btn btn-brass btn-block" type="button" data-go="home">العودة إلى المنيو</button>
      <button class="btn btn-ghost btn-block" type="button" data-go="bill">${icon('clipboard')}شوف فاتورة الطاولة</button>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <button class="btn btn-ghost" type="button" data-call-now="waiter">${icon('bell')}نادِ نادل</button>
        <button class="btn btn-ghost" type="button" data-call-now="bill">${icon('receipt')}الحساب</button>
      </div>
    </div>`;
}
function trackOrder(order) {
  const i = state.orders.findIndex((o) => o.id === order.id);
  if (i >= 0) state.orders[i] = order; else state.orders.push(order);
  saveOrders();
  if (order.sessionId && order.table === state.table && !['paid', 'cancelled'].includes(order.status)) {
    state.session = { table: order.table, sessionId: order.sessionId };
    LS.set('session', state.session);
  }
  socket?.emit('track', [order.id]);
  $('#billDot').hidden = !state.session;
}
/** نسخة صغيرة من طلبات هالجهاز (بتبيّن بـ"تابع طلبي" إذا الكاشير مش متصل) */
function saveOrders() {
  LS.set('orders', state.orders.filter((o) => o.status !== 'paid').map((o) => ({
    id: o.id, at: o.createdAt, no: o.no, table: o.table, status: o.status, total: o.total, sessionId: o.sessionId,
    lines: o.lines.map((l) => ({ qty: l.qty, name: l.name })),
  })));
}
const cachedOrders = () => LS.get('orders', []).filter((o) => o.no && Date.now() - new Date(o.at).getTime() < 24 * 3600 * 1000);
/** طلبات هالجهاز اللي لسا طاولتها مفتوحة */
function openOrders() {
  const live = state.orders.filter((o) => o.status !== 'paid');
  return live.length ? live : cachedOrders().filter((o) => o.status !== 'paid');
}
async function restoreOrders() {
  try {
    // من السيرفر: طلبات هالجهاز على طاولته المفتوحة (لما الكاشير يسكّر الطاولة بيرجع فاضي)
    state.orders = await api(`/devices/${DEVICE}/orders`);
    saveOrders();
  } catch { /* الكاشير مش متصل: بتضل النسخة المحفوظة */ }
  socket?.emit('track', state.orders.map((o) => o.id));
  if (state.table) await loadBill().catch(() => {});
  const scr = current?.dataset.screen;
  if (scr === 'home') renderHomeTrack();
  if (scr === 'welcome') updateWelcomeTrack();
}
function updateWelcomeTrack() {
  const open = openOrders().filter((o) => o.status !== 'cancelled');
  $('#welcomeTrack').hidden = !open.length && !state.pending.length;
  $('#welcomeTrack').innerHTML = `${icon('clock')}تابع طلبي${open.length ? ` <b>(${open.length})</b>` : ''}`;
}
function latestOrder() { return [...state.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]; }
function onOrderUpdate(o) {
  const prev = state.orders.find((x) => x.id === o.id);
  trackOrder(o);
  const scr = current?.dataset.screen;
  if (scr === 'track') drawTrack(openOrders());
  if (scr === 'home') renderHomeTrack();
  if (scr === 'sent' && parseHash().param === o.id) renderSent(o.id);
  if (o.status === 'paid' && state.session?.sessionId === o.sessionId) {
    // الكاشير سكّر الطاولة: الفاتورة انتهت
    if (state.paidNotice !== o.sessionId) { state.paidNotice = o.sessionId; toast('تم الدفع، شكراً لزيارتك 🌿', 'ok'); }
    state.session = null;
    LS.set('session', null);
    saveOrders(); // المدفوع ما بيتحفظ، فـ"تابع طلبي" بيرجع فاضي
    $('#billDot').hidden = true;
  }
  if (scr === 'bill') renderBill();
  if (prev?.status === o.status) { if (scr === 'bill') renderBill(); return; }
  if (o.status === 'ready') { toast(`طلبك #${o.no} جاهز! جاي لطاولتك`, 'ok'); navigator.vibrate?.([120, 60, 120]); }
  else if (o.status === 'preparing') toast('الكاشير قبل طلبك، وبلّشنا التحضير ☕');
  else if (o.status === 'served') toast('صحتين وعافية!', 'ok');
}

// ───────── 9. طلباتي ─────────
async function loadBill() {
  const bill = await api(`/tables/${state.table}/bill`);
  const had = state.session?.sessionId;
  state.bill = bill;
  if (had && bill.sessionId !== had) state.paidNotice = had; // الفاتورة القديمة انتهت (اندفعت)
  state.session = bill.open ? { table: bill.table, sessionId: bill.sessionId } : null;
  LS.set('session', state.session);
  $('#billDot').hidden = !bill.open;
  socket?.emit('track', bill.orders.map((o) => o.id));
  return { bill, closedPrev: had && bill.sessionId !== had };
}
async function renderBill() {
  renderAppbar($('[data-screen="bill"] [data-appbar]'));
  $('#billTitle').textContent = `فاتورة طاولة ${pad2(state.table)}`;
  let res;
  try { res = await loadBill(); } catch (err) { $('#billBody').innerHTML = `<div class="empty"><p>${esc(err.message)}</p></div>`; return; }
  const { bill, closedPrev } = res;
  if (!bill.open) {
    $('#billSub').textContent = 'كل طلباتك على هالطاولة بتنجمع هون لحد ما تدفع';
    $('#billBody').innerHTML = `<div class="empty">${artTile({ art: 'cup', hue: 30 })}
      <p>${closedPrev ? 'فاتورتك السابقة اندفعت وتسكّرت، شكراً لزيارتك 🌿' : 'ما في طلبات على طاولتك لسا.'}</p>
      <button class="btn btn-brass" type="button" data-go="home">تصفّح المنيو</button></div>`;
    return;
  }
  $('#billSub').textContent = 'محفوظة على الطاولة، حتى لو سكّرت الموقع ورجعت';
  $('#billBody').innerHTML = `
    <div class="bill-head"><span class="tno">${pad2(bill.table)}</span>
      <div><strong>فاتورة مفتوحة · ${bill.orders.length} ${bill.orders.length === 1 ? 'طلب' : 'طلبات'}</strong><small>من الساعة ${timeOf(bill.openedAt)}</small></div></div>
    <div class="bill-list">${bill.orders.map((o) => `
      <article class="bill-order">
        <div class="bill-order-head"><strong>طلب #${o.no} · ${timeOf(o.createdAt)}</strong><span class="status-chip ${o.status}">${STATUS[o.status].label}</span></div>
        ${o.lines.map((l) => `<div class="bill-line"><span>${l.qty} × ${esc(l.name)}${l.options?.sugar ? ` <small class="muted">(${SUGAR[l.options.sugar]})</small>` : ''}${l.origUnitPrice != null ? '<span class="disc">خصم من الكاشير</span>' : ''}</span>
          <b>${l.origUnitPrice != null ? `<s>${priceText(l.origUnitPrice * l.qty)}</s>` : ''}${priceText(l.lineTotal)}</b></div>`).join('')}
      </article>`).join('')}</div>
    <div class="totals">
      <div><span>المجموع قبل الخصم</span><span>${priceText(bill.subtotal)}</span></div>
      ${bill.discount > 0 ? `<div class="saving"><span>الخصومات</span><span>− ${priceText(bill.discount)}</span></div>` : ''}
      <div class="grand"><span>المطلوب دفعه</span><span>${priceText(bill.total)}</span></div>
    </div>
    <div class="stack">
      <button class="btn btn-brass btn-block" type="button" data-call-now="bill">${icon('receipt')}اطلب الحساب</button>
      <button class="btn btn-ghost btn-block" type="button" data-call-now="waiter">${icon('bell')}نادِ نادل</button>
    </div>`;
}

// ───────── 10. المزيد ─────────
function renderMore() {
  renderAppbar($('[data-screen="more"] [data-appbar]'));
  const row = (ic, title, sub, attrs, cls = '') => `<button class="row-btn" type="button" ${attrs}><span class="row-ic ${cls}">${icon(ic)}</span><span><strong>${title}</strong><small>${sub}</small></span><span class="chev">${icon('chev')}</span></button>`;
  $('#moreRows').innerHTML = [
    row('clock', 'تابع طلبي', 'حالة طلباتك من هالجهاز لحظة بلحظة', 'data-go="track"', 'gold'),
    row('bell', 'نادِ نادل', 'بتضوي طاولتك عند الكاشير وبيجيك حدا', 'data-open-waiter', 'coral'),
    row('receipt', 'اطلب الحساب', 'النادل بيجيك مع الفاتورة', 'data-call-now="bill"'),
    row('sparkle', `اسأل ${esc(S().baristaName)}`, `${W().hostSmart}: ${W().ask}`, 'data-open-chat', 'gold'),
    isRestaurant() ? '' : row('star', 'ساعدنا نختارك', 'ثلاث أسئلة ومنقترحلك', 'data-go="helper"', 'gold'),
    row('table', 'غيّر الطاولة', state.table ? `إنت هلأ على طاولة ${pad2(state.table)}` : 'لسا ما اخترت طاولة', 'data-change-table'),
    row('clipboard', 'فاتورة الطاولة', 'كل طلباتك والمجموع', 'data-go="bill"'),
  ].join('');
  // المظهر
  $('#moreRows').insertAdjacentHTML('beforeend', themePicker());
  const w = state.weather;
  $('#about').innerHTML = `${brandMark(S().cafeName)}<p>${esc(S().tagline)}</p>${w?.ok ? `<p>${esc(w.city)} · ${w.temp}° ${esc(w.desc)}</p>` : ''}`;
}


function themePicker() {
  const pref = themePref();
  return `<div class="theme-pick"><strong>${icon('contrast')}المظهر</strong>
    <div class="segmented" role="radiogroup" aria-label="المظهر">${THEMES.map(([k, label, ic]) => `<button type="button" role="radio" data-theme-set="${k}" aria-pressed="${pref === k}" aria-checked="${pref === k}">${icon(ic)}${label}</button>`).join('')}</div></div>`;
}

// ───────── تابع طلبي ─────────
const TRACK_STEPS = ['new', 'preparing', 'ready', 'served'];
const TRACK_LINE = {
  new: 'وصل طلبك للكاشير', preparing: 'عم يتحضّر هلق ☕', ready: 'جاهز وجاي لطاولتك',
  served: 'وصلك، صحتين وعافية', cancelled: 'انلغى هالطلب، إذا في سؤال نادِ نادل',
};
function renderHomeTrack() {
  const open = openOrders().filter((o) => o.status !== 'cancelled');
  const el = $('#homeTrack');
  el.hidden = !open.length && !state.pending.length;
  if (el.hidden) return;
  const o = open[0];
  el.innerHTML = `${icon('clock')}<span><strong>تابع طلبي</strong><small>${o ? `طلب #${o.no} · ${TRACK_LINE[o.status] ?? STATUS[o.status]?.label}` : 'طلبك محفوظ وبيستنى الكاشير'}${open.length > 1 ? ` · و${open.length - 1} كمان` : ''}</small></span><span class="chev">${icon('chev')}</span>`;
}
function drawTrack(list, note = '') {
  const box = $('#trackBody');
  if (!list.length && !state.pending.length) {
    box.innerHTML = `<div class="empty">${artTile({ art: 'cup', hue: 30 })}<p>ما في طلب مفتوح من هالجهاز هلق.</p><p class="muted">لما الكاشير يسكّر الطاولة بعد الدفع، بننسى طلباتها.</p>
      ${state.table ? '<button class="btn btn-brass" type="button" data-go="home">تصفّح المنيو</button>' : '<button class="btn btn-brass" type="button" data-go="welcome">اختار طاولتك واطلب</button>'}</div>`;
    return;
  }
  box.innerHTML = `${note ? `<p class="track-note">${esc(note)}</p>` : ''}
    ${state.pending.map((p) => `
      <article class="track-card is-pending">
        <div class="track-head"><strong>طلب محفوظ</strong><span class="status-chip new">بيستنى الكاشير</span></div>
        <small class="muted">${p.count} ${p.count === 1 ? 'صنف' : 'أصناف'} · ${priceText(p.total)} · بيوصل للكاشير أول ما يفتح لوحته</small>
      </article>`).join('')}
    ${list.map((o) => {
      const idx = TRACK_STEPS.indexOf(o.status);
      return `
      <button class="track-card" type="button" data-go="sent" data-param="${esc(o.id)}">
        <div class="track-head"><strong>طلب #${o.no}</strong><span class="status-chip ${o.status}">${STATUS[o.status]?.label ?? ''}</span></div>
        <small class="muted">الطاولة ${pad2(o.table)} · ${timeOf(o.createdAt ?? o.at)} · ${priceText(o.total)}</small>
        ${o.status === 'cancelled' ? '' : `<span class="track-steps" aria-hidden="true">${TRACK_STEPS.map((_, i) => `<i class="${i <= idx ? 'on' : ''}"></i>`).join('')}</span>`}
        <span class="track-now">${TRACK_LINE[o.status] ?? ''}</span>
        <span class="track-items">${o.lines.map((l) => `${l.qty} × ${esc(l.name)}`).join('، ')}</span>
      </button>`;
    }).join('')}`;
}
async function renderTrack() {
  drawTrack(openOrders());
  try {
    state.orders = await api(`/devices/${DEVICE}/orders`);
    saveOrders();
    socket?.emit('track', state.orders.map((o) => o.id));
    if (current?.dataset.screen === 'track') drawTrack(openOrders());
  } catch {
    if (current?.dataset.screen === 'track') drawTrack(openOrders(), 'ما قدرنا نوصل للكاشير هلق، هاي آخر حالة معروفة.');
  }
}

// ───────── نداء النادل ─────────
function openWaiter() {
  if (!needTable(() => { go('home'); setTimeout(openWaiter, 400); })) return;
  $('#waiterLead').innerHTML = `رح يوصل التنبيه للكاشير وبتضوي طاولتك (${pad2(state.table)}) عنده.`;
  openSheet($('#waiterSheet'));
}
async function callWaiter(kind) {
  if (!needTable(() => { go('home'); setTimeout(() => callWaiter(kind), 400); })) return;
  try {
    await api(`/tables/${state.table}/call`, { method: 'POST', body: { kind } });
    state.lastCall = { kind, at: Date.now() };
    toast(kind === 'bill' ? 'وصل طلب الحساب، النادل جاي مع الفاتورة' : `النادل متّجه لطاولة ${pad2(state.table)}`, 'ok');
    const pill = $('#chatWaiter');
    pill.classList.add('is-sent');
    setTimeout(() => pill.classList.remove('is-sent'), 6000);
    if ($('#waiterSheet').classList.contains('is-open')) closeSheet($('#waiterSheet'));
    if (current?.dataset.screen === 'sent') renderSent(parseHash().param);
  } catch (err) {
    if (err.queued) {
      toast(err.message, 'ok');
      if ($('#waiterSheet').classList.contains('is-open')) closeSheet($('#waiterSheet'));
      return;
    }
    toast(err.message, 'err');
  }
}

// ───────── الباريستا ─────────
const QUICK_CAFE = ['شو الأكثر طلباً؟', 'معي 20 شيكل، شو بتقترح؟', 'شوف الطقس وشربني على ذوقك', 'احنا 5 و2 ما بحبوا السكر كثير', 'شو الفرق بين اللاتيه والكابتشينو؟'];
const QUICK_RESTAURANT = ['شو أطيب طبق عندكم؟', 'احنا 4، شو منطلب نتشارك؟', 'بدي اشي خفيف ومش دسم', 'معي 60 شيكل لشخصين، شو بتقترح؟', 'شو الفرق بين المسخن والمقلوبة؟'];
const QUICK = () => (isRestaurant() ? QUICK_RESTAURANT : QUICK_CAFE);
function greetingText() {
  const s = S();
  if (state.table) return `أهلين! أنا ${s.baristaName}، ${W().host} تبعك ${isRestaurant() ? '🍽️' : '☕'} شايفك ع طاولة ${state.table}${state.tableZone ? ` بـ${state.tableZone}` : ''}. احكيلي شو مزاجك اليوم، أو اسألني عن أي مشروب ومن شو بيتكوّن.`;
  return `أهلين! أنا ${s.baristaName}، ${W().host} تبعك ${isRestaurant() ? '🍽️' : '☕'} قبل كل اشي، طاولتك رقم كم؟`;
}
function openChat(prefill) {
  const chat = $('#chat');
  if (!state.chat.length) {
    const g = greetingText();
    state.chat.push({ role: 'assistant', text: g, greeting: true });
    $('#chatLog').innerHTML = '';
    appendBot(g);
  }
  $('#chatQuick').innerHTML = QUICK().map((q) => `<button class="chip" type="button" data-quick="${esc(q)}">${esc(q)}</button>`).join('');
  chat.classList.add('is-open');
  chat.setAttribute('aria-hidden', 'false');
  if (prefill) setTimeout(() => sendChat(prefill), 450);
  else setTimeout(() => $('#chatText').focus({ preventScroll: true }), 500);
}
function closeChat() { $('#chat').classList.remove('is-open'); $('#chat').setAttribute('aria-hidden', 'true'); }
function scrollChat() { const log = $('#chatLog'); log.scrollTo({ top: log.scrollHeight, behavior: reducedMotion() ? 'auto' : 'smooth' }); }
function appendMe(text) {
  const el = document.createElement('div');
  el.className = 'msg me';
  el.textContent = text;
  $('#chatLog').append(el);
  scrollChat();
}
function typeInto(el, text) {
  if (reducedMotion()) { el.textContent = text; return Promise.resolve(); }
  return new Promise((resolve) => {
    const chars = [...text];
    let i = 0;
    const step = () => {
      i = Math.min(chars.length, i + 2);
      el.textContent = chars.slice(0, i).join('');
      if (i % 12 === 0) scrollChat();
      if (i < chars.length) setTimeout(step, 14); else { scrollChat(); resolve(); }
    };
    step();
  });
}
async function appendBot(text, suggestions = [], offerWaiter = false) {
  const el = document.createElement('div');
  el.className = 'msg bot';
  $('#chatLog').append(el);
  await typeInto(el, text);
  if (suggestions.length) {
    const box = document.createElement('div');
    box.className = 'sugg';
    let total = 0;
    box.innerHTML = suggestions.map((s, i) => {
      const o = s.kind === 'offer' ? offerById(s.id) : null;
      const it = o ? null : itemById(s.id);
      if (!it && !o) return '';
      const price = (o ? o.price : it.price) * s.qty;
      total += price;
      const meta = [s.forWhom, s.sugar ? SUGAR[s.sugar] : '', o ? o.names.join(' + ') : ''].filter(Boolean).join(' · ');
      return `<div class="sugg-card">${artTile(it ?? itemById(o.itemIds[0]))}
        <div><h5>${esc(o ? `عرض ${o.title}` : it.name)}${s.qty > 1 ? ` × ${s.qty}` : ''}</h5><small>${meta ? esc(meta) + ' · ' : ''}${priceText(price)}</small></div>
        <button class="plus" type="button" data-sugg="${i}" aria-label="أضف للطلب">${icon('plus')}</button></div>`;
    }).join('') + (suggestions.length > 1 ? `<button class="btn btn-ghost btn-sm sugg-all" type="button" data-sugg-all>${icon('bag')}أضف الكل · ${priceText(total)}</button>` : '');
    box._suggestions = suggestions;
    $('#chatLog').append(box);
  }
  if (offerWaiter) {
    const b = document.createElement('button');
    b.className = 'btn btn-coral btn-sm waiter-inline';
    b.type = 'button';
    b.dataset.callNow = 'waiter';
    b.innerHTML = `${icon('bell')}نادِ نادل لطاولتي`;
    $('#chatLog').append(b);
  }
  scrollChat();
}
async function sendChat(text) {
  text = String(text).trim();
  if (!text || state.chatBusy) return;
  state.chatBusy = true;
  appendMe(text);
  state.chat.push({ role: 'user', text });
  $('#chatText').value = '';
  const typing = document.createElement('div');
  typing.className = 'typing';
  typing.innerHTML = '<i></i><i></i><i></i>';
  $('#chatLog').append(typing);
  scrollChat();
  try {
    const res = await api('/barista', {
      method: 'POST',
      body: {
        history: state.chat.filter((m) => !m.greeting).slice(-16).map(({ role, text: t, suggestionNames }) => ({ role, text: t, suggestionNames })),
        table: state.table,
        cart: state.cart.map((l) => ({ kind: l.kind, id: l.id, qty: l.qty })),
        greeting: state.chat.find((m) => m.greeting)?.text ?? '',
      },
    });
    typing.remove();
    if (res.table && res.table !== state.table) setTable(res.table).catch(() => {});
    const names = res.suggestions.map((s) => (s.kind === 'offer' ? `عرض ${offerById(s.id)?.title}` : itemById(s.id)?.name)).filter(Boolean);
    state.chat.push({ role: 'assistant', text: res.reply, suggestionNames: names });
    await appendBot(res.reply, res.suggestions, res.offerWaiter);
  } catch (err) {
    typing.remove();
    await appendBot(err.status === 429 ? 'شوي شوي علي 😅 استنى لحظة وارجع اسألني.' : 'في مشكلة بالاتصال، جرب كمان مرة.');
  } finally {
    state.chatBusy = false;
  }
}
function addSuggestion(s, btn) {
  addToCart({ kind: s.kind, id: s.id, qty: s.qty, sugar: s.kind === 'item' && itemById(s.id)?.sugarChoice ? (s.sugar || '') : '', via: 'barista' });
  if (btn) { btn.classList.add('is-done'); btn.innerHTML = icon('check'); btn.disabled = true; }
}

// ───────── الأحداث ─────────
function bind() {
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button, a[data-go]');
    if (!t) return;
    const d = t.dataset;
    if (d.back !== undefined) return back();
    if (d.themeSet) { setTheme(d.themeSet); return renderMore(); }
    if (d.busy) {
      closeSheet($('#busySheet'));
      const pick = busyPick;
      busyPick = null;
      if (d.busy === 'join' && pick) return finishPick(pick.n, pick.info);
      pickDraft = '';
      return updatePick();
    }
    if (d.go) return go(d.go, d.param ?? null);
    if (d.tab) return go(d.tab);
    if (d.openItem) return openItem(d.openItem);
    if (d.quickAdd) {
      const it = itemById(d.quickAdd);
      if (it?.sugarChoice) return openItem(it.id); // المشروبات اللي إلها سكر نسأل عن السكر أولاً
      addToCart({ kind: 'item', id: d.quickAdd }, t);
      return toast(`انضاف ${it.name} للطلب`, 'ok');
    }
    if (d.addOffer) { addToCart({ kind: 'offer', id: d.addOffer }, t); return toast('انضاف العرض للطلب', 'ok'); }
    if (d.sugar) { draft.sugar = d.sugar; $$('[data-sugar]').forEach((b) => b.setAttribute('aria-pressed', String(b === t))); return; }
    if (d.step) { draft.qty = Math.min(20, Math.max(1, draft.qty + Number(d.step))); return renderItemFoot(); }
    if (t.id === 'itemAdd') {
      addToCart({ kind: 'item', id: draft.id, qty: draft.qty, sugar: draft.sugar, note: ($('#itemNote')?.value ?? '').trim() }, t);
      toast(`انضاف ${itemById(draft.id).name} للطلب`, 'ok');
      return closeSheet($('#itemSheet'));
    }
    if (d.askAbout) { closeSheet($('#itemSheet')); return openChat(`احكيلي عن ${itemById(d.askAbout)?.name}، من شو بيتكوّن؟`); }
    if (d.line) {
      const l = state.cart[Number(d.line)];
      if (!l) return;
      l.qty += Number(d.delta);
      if (l.qty <= 0) state.cart.splice(Number(d.line), 1);
      saveCart();
      return renderCart();
    }
    if (d.changeTable !== undefined) { state.forceAsk = true; const from = current?.dataset.screen; pickThen = () => go(from === 'cart' ? 'cart' : 'home'); return go('welcome'); }
    if (t.id === 'changeTable') { state.forceAsk = true; return go('welcome'); }
    if (t.id === 'keepTable') return go('home');
    if (t.id === 'otherTable') { state.forceAsk = true; return renderWelcome(); }
    if (d.key) {
      if (d.key === 'clear') pickDraft = '';
      else if (d.key === 'back') pickDraft = pickDraft.slice(0, -1);
      else if (pickDraft.length < 3) pickDraft = (pickDraft + d.key).replace(/^0+/, '');
      return updatePick();
    }
    if (t.id === 'pickConfirm') return confirmPick();
    if (d.mood) { state.helper.mood = d.mood; return $$('[data-mood]').forEach((b) => b.setAttribute('aria-pressed', String(b === t))); }
    if (d.sweet) { state.helper.sweet = d.sweet; return $$('[data-sweet]').forEach((b) => b.setAttribute('aria-pressed', String(b === t))); }
    if (d.people) { state.helper.people = Number(d.people); return $$('[data-people]').forEach((b) => b.setAttribute('aria-pressed', String(b === t))); }
    if (t.id === 'helperNext') return helperNext();
    if (t.id === 'helperBack') { if (state.helper.step > 0) { state.helper.step--; return renderHelper(); } return back(); }
    if (t.id === 'addPick') {
      const r = state.result;
      addToCart({ kind: 'item', id: r.main.id, qty: r.qty, sugar: r.sugar });
      toast(`انضاف ${r.main.name} للطلب`, 'ok');
      return go('cart');
    }
    if (t.id === 'redoHelper') { state.helper = { step: 0, mood: null, sweet: null, people: 1 }; return go('helper'); }
    if (t.id === 'placeOrder') return placeOrder(t);
    if (d.openWaiter !== undefined) return openWaiter();
    if (d.call) return callWaiter(d.call);
    if (d.callNow) return callWaiter(d.callNow);
    if (d.openChat !== undefined) return openChat(d.prefill);
    if (d.quick) return sendChat(d.quick);
    if (d.sugg) return addSuggestion(t.closest('.sugg')._suggestions[Number(d.sugg)], t);
    if (d.suggAll !== undefined) {
      const box = t.closest('.sugg');
      box._suggestions.forEach((s, i) => { const b = box.querySelector(`[data-sugg="${i}"]`); if (!b?.disabled) addSuggestion(s, b); });
      toast('انضافت الاقتراحات لطلبك', 'ok');
      return t.remove();
    }
  });
  $('#chatClose').addEventListener('click', closeChat);
  $('#chatWaiter').addEventListener('click', () => callWaiter('waiter'));
  $('#chatForm').addEventListener('submit', (e) => { e.preventDefault(); sendChat($('#chatText').value); });
  $('#homeSearch').addEventListener('input', doHomeSearch);
  $('#catSearch').addEventListener('input', renderCatItems);
  addEventListener('hashchange', onHash);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('#chat').classList.contains('is-open')) closeChat();
    if (current?.dataset.screen === 'welcome' && !$('#welcomeAsk').hidden) {
      if (/^\d$/.test(e.key) && pickDraft.length < 3) { pickDraft = (pickDraft + e.key).replace(/^0+/, ''); updatePick(); }
      else if (e.key === 'Backspace') { pickDraft = pickDraft.slice(0, -1); updatePick(); }
      else if (e.key === 'Enter') confirmPick();
    }
  });
}

async function refreshMenu() {
  state.menu = await api('/menu');
  enrichMenu();
  applyPalette(S().theme, 'menu', storeKey('palette.menu')); // الكاشير ممكن غيّر الثيم
  saveCart();
  const scr = current?.dataset.screen;
  if (scr === 'home') renderHome();
  if (scr === 'category') renderCatItems();
  if (scr === 'cart') renderCart();
}
function enrichMenu() {
  // نضيف حرارة القسم لكل صنف (بتساعد "ساعدنا نختارك" بالطقس)
  for (const it of state.menu.items) it.temp = catById(it.categoryId)?.temp ?? null;
}
function connectLive() {
  if (typeof io !== 'function') return;
  socket = io({ query: { tenant: TENANT ?? '' } });
  socket.on('connect', () => socket.emit('track', state.orders.map((o) => o.id)));
  socket.on('tenant:frozen', frozenNow);
  socket.on('order:update', onOrderUpdate);
  socket.on('order:accepted', onAccepted);
  socket.on('call:accepted', () => toast('وصل ندائك للكاشير ✓', 'ok'));
  socket.on('queued:failed', ({ reqId, error }) => {
    state.pending = state.pending.filter((p) => p.reqId !== reqId);
    renderPending();
    toast(error, 'err');
  });
  let t;
  socket.on('menu:changed', () => { clearTimeout(t); t = setTimeout(() => refreshMenu().catch(() => {}), 400); });
}

// الطلب من جهاز ثاني (رابط فيه كود اللوحة): الزبون بيعرف إذا الكاشير متصل قبل ما يطلب
const LINK_TEXT = {
  connecting: ['wait', 'عم نتصل بالكاشير…'],
  online: ['ok', 'متصل بالكاشير، طلبك بيوصله فوراً'],
  offline: ['off', 'الكاشير مش فاتح اللوحة هلق، طلبك بينحفظ وبيوصله'],
};
function renderLink(st) {
  const [cls, text] = LINK_TEXT[st] ?? [];
  $('#linkChip').hidden = !cls;
  if (cls) { $('#linkChip').className = `link-chip ${cls}`; $('#linkChip').textContent = text; }
  $('#linkBar').hidden = st !== 'offline';
  $('#linkBar').textContent = 'الكاشير مش فاتح اللوحة هلق. فيك تطلب عادي، وطلبك بينحفظ وبيوصله أول ما يفتحها.';
}

async function boot() {
  initTable();
  try {
    state.menu = await api('/menu');
  } catch (err) {
    document.body.innerHTML = `<div class="empty" style="min-height:100vh;align-content:center"><p>${esc(err.message)}</p><button class="btn btn-brass" type="button" id="retryBoot">جرّب كمان مرة</button></div>`;
    $('#retryBoot').addEventListener('click', () => location.reload());
    return;
  }
  enrichMenu();
  setBusiness(S().businessType); // مطعم = قدرة ومغرفة وألوان الفخار بدل الدلّة
  setStoreLogo({ icon: S().logoIcon, name: S().logoName }); // شعار المحل الخاص إذا رفعه الكاشير
  applyBusiness(S().businessType);
  applyPalette(S().theme, 'menu', storeKey('palette.menu')); // ثيم الألوان اللي اختاره الكاشير
  $('#chatSub').textContent = `${W().host} · ${W().sub}`;
  $('#chatText').placeholder = W().placeholder;
  $('#fab').setAttribute('aria-label', `اسأل ${W().host}`);
  document.title = `${S().cafeName} — اطلب من طاولتك`;
  fillIcons();
  $$('[data-leaves]').forEach((el) => { el.innerHTML = leavesArt(); });
  $$('[data-back]').forEach((b) => { if (!b.firstElementChild) b.innerHTML = icon('arrow'); });
  $('#fab').innerHTML = dallahIcon();
  $('#chatAvatar').innerHTML = dallahIcon();
  $('#chatName').textContent = S().baristaName;
  $('#chatClose').innerHTML = icon('close');
  $('#chatSend').innerHTML = icon('send');
  $('#chatWaiter').innerHTML = `${icon('bell')}نادِ نادل إنسان`;
  saveCart();
  bind();
  bindStrips();
  connectLive();
  window.__CAFE_DEMO__?.link?.onChange(renderLink);
  renderPending();
  if (state.table) { try { await setTable(state.table); await loadBill(); } catch { /* */ } }
  // أول ما يفتح الموقع (من الـ QR الموحّد): شاشة البداية بتسأل عن الطاولة قبل أي اشي
  if (!location.hash || !state.table) history.replaceState(null, '', '#welcome');
  onHash();
  restoreOrders();
  api('/weather').then((w) => { state.weather = w; if (current?.dataset.screen === 'home') renderHome(); }).catch(() => {});
}

boot();
