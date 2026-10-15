// أدوات مشتركة بين صفحة الزبون ولوحة الكاشير

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function money(n, cur = '₪') {
  const v = Math.round(Number(n) * 100) / 100;
  const txt = Number.isInteger(v) ? String(v) : v.toFixed(1);
  return `<span class="num">${txt}</span><span class="cur">${esc(cur)}</span>`;
}
export function moneyText(n, cur = '₪') {
  const v = Math.round(Number(n) * 100) / 100;
  return `${Number.isInteger(v) ? v : v.toFixed(1)}${cur}`;
}

// CoffeeFlow: كل محل إله مسار (/1001) و API خاص (/api/t/1001)، وتخزين خاص بالجهاز
export const TENANT = (location.pathname.match(/^\/(\d{3,8})(?:\/|$)/) || [])[1] ?? demoStore();
/** نسخة التجربة على الموقع الثابت: customer.html?store=1002 (المحل 1001 هو الأصلي بدون رقم) */
function demoStore() {
  if (!window.__CAFE_DEMO__) return null;
  const s = String(new URLSearchParams(location.search).get('store') ?? '').replace(/\D/g, '').slice(0, 8);
  return s && s !== '1001' ? s : null;
}
export const tenantPath = TENANT ? `/${TENANT}` : '';
const API_BASE = TENANT ? `/api/t/${TENANT}` : '/api';
/** مفتاح التخزين بالمتصفح: كل محل لحاله (عشان زبون زار محلين ما تتلخبط سلّته) */
export const storeKey = (k) => `cm.${TENANT ? TENANT + '.' : ''}${k}`;

/** المحل انجمّد من المنصة: بنعيد تحميل الصفحة، والسيرفر بيعرض "الحساب مجمّد" */
export function frozenNow() {
  if (window.__CAFE_DEMO__) { window.__CAFE_DEMO__.frozen?.(); return; }
  if (frozenNow.done) return;
  frozenNow.done = true;
  location.reload();
}

export async function api(path, { method = 'GET', body, token } = {}) {
  // نسخة الـ HTML المستقلة: النظام كامل بيشتغل داخل المتصفح
  if (window.__CAFE_DEMO__) return window.__CAFE_DEMO__.api(path, { method, body, token });
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers['x-admin-token'] = token;
  let res;
  try {
    res = await fetch(API_BASE + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw Object.assign(new Error('ما في اتصال بالسيرفر. تأكد من الشبكة وجرب كمان مرة.'), { status: 0 });
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 423 && data.frozen) frozenNow();
  if (!res.ok) throw Object.assign(new Error(data.error || 'صار خطأ، جرب كمان مرة.'), { status: res.status });
  return data;
}

export function toast(message, kind = '') {
  let host = $('.toasts');
  if (!host) { host = document.createElement('div'); host.className = 'toasts'; host.setAttribute('aria-live', 'polite'); document.body.append(host); }
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = `<span class="dot"></span><span>${esc(message)}</span>`;
  host.append(el);
  setTimeout(() => { el.classList.add('is-leaving'); el.addEventListener('animationend', () => el.remove(), { once: true }); }, 3600);
}

// ───────── الألواح المنزلقة ─────────
// الخلفية المعتمة بتنحط بنفس حاوية اللوح (الصفحة أو إطار الجوال)
const openStack = [];
function scrimFor(sheet) {
  const host = sheet.parentElement;
  let scrim = host.querySelector(':scope > .scrim');
  if (!scrim) {
    scrim = document.createElement('div');
    scrim.className = 'scrim';
    scrim.addEventListener('click', () => closeSheet());
    host.append(scrim);
  }
  return scrim;
}
export function openSheet(sheet) {
  if (openStack.includes(sheet)) return;
  const scrim = scrimFor(sheet);
  openStack.push(sheet);
  sheet.style.zIndex = 90 + openStack.length * 2;
  scrim.style.zIndex = 89 + openStack.length * 2;
  scrim.classList.add('is-open');
  sheet.classList.add('is-open');
  sheet.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  setTimeout(() => sheet.querySelector('[data-autofocus]')?.focus({ preventScroll: true }), 350);
}
export function closeSheet(sheet = openStack[openStack.length - 1]) {
  if (!sheet) return;
  const i = openStack.indexOf(sheet);
  if (i >= 0) openStack.splice(i, 1);
  sheet.classList.remove('is-open');
  sheet.setAttribute('aria-hidden', 'true');
  const scrim = scrimFor(sheet);
  const sameHost = openStack.filter((s) => s.parentElement === sheet.parentElement);
  if (sameHost.length) scrim.style.zIndex = 89 + openStack.length * 2;
  else scrim.classList.remove('is-open');
  if (!openStack.length) document.body.style.overflow = '';
  sheet.dispatchEvent(new CustomEvent('sheet:closed'));
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && openStack.length) closeSheet(); });
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-close-sheet]');
  if (btn) closeSheet(btn.closest('.sheet') ?? undefined);
});

// ───────── أصوات صغيرة بالـ Web Audio (بدون ملفات) ─────────
let actx;
export function chime(kind = 'order') {
  try {
    actx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const notes = kind === 'order' ? [880, 1174.7, 1568] : kind === 'call' ? [784, 659.3, 784, 659.3] : [1046.5, 1318.5];
    notes.forEach((f, i) => {
      const t = actx.currentTime + i * (kind === 'call' ? 0.16 : 0.12);
      const o = actx.createOscillator();
      const g = actx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.22, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.connect(g).connect(actx.destination);
      o.start(t);
      o.stop(t + 1);
    });
  } catch { /* الصوت اختياري */ }
}
export function unlockAudio() {
  try { actx ??= new (window.AudioContext || window.webkitAudioContext)(); actx.resume(); } catch { /* */ }
}

export function timeAgo(iso) {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 45) return 'هلأ';
  const m = Math.round(s / 60);
  if (m < 60) return m === 1 ? 'من دقيقة' : m === 2 ? 'من دقيقتين' : `من ${m} دقيقة`;
  const h = Math.round(m / 60);
  return h === 1 ? 'من ساعة' : `من ${h} ساعات`;
}

// ───────── المظهر: فاتح / غامق / تلقائي (حسب إعداد الجهاز) ─────────
const THEME_KEY = 'cm.theme';
const darkQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
export const THEMES = [['light', 'فاتح', 'sun'], ['dark', 'غامق', 'moon'], ['auto', 'تلقائي', 'contrast']];
export function themePref() {
  try { return localStorage.getItem(THEME_KEY) || 'auto'; } catch { return 'auto'; }
}
export function applyTheme(pref = themePref()) {
  const dark = pref === 'dark' || (pref === 'auto' && Boolean(darkQuery?.matches));
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#160d08' : '#f4ece1');
  return dark;
}
export function setTheme(pref) {
  try { localStorage.setItem(THEME_KEY, pref); } catch { /* */ }
  applyTheme(pref);
}
darkQuery?.addEventListener?.('change', () => { if (themePref() === 'auto') applyTheme(); });
applyTheme();

// ───────── كافيه أو مطعم: الكلمات اللي بتتغيّر ─────────
export function bizWords(type) {
  return type === 'restaurant'
    ? { place: 'مطعم', host: 'المضيف', hostSmart: 'المضيف الذكي', ask: 'اسأله عن أي طبق', items: 'طبق', note: 'ملاحظة للمطبخ (اختياري)', sub: 'بيعرف القائمة طبق طبق', placeholder: 'احكي مع المضيف…' }
    : { place: 'كافيه', host: 'الباريستا', hostSmart: 'الباريستا الذكي', ask: 'اسأله عن أي مشروب', items: 'مشروب', note: 'ملاحظة للباريستا (اختياري)', sub: 'بيعرف القائمة حبة حبة', placeholder: 'احكي مع الباريستا…' };
}
/** بيحط نوع المحل على الصفحة (ألوان وهوية المطعم بـ theme.css) */
export function applyBusiness(type) {
  document.documentElement.dataset.biz = type === 'restaurant' ? 'restaurant' : 'cafe';
}

export const STATUS = {
  new: { label: 'طلب جديد', short: 'جديد' },
  preparing: { label: 'قيد التحضير', short: 'تحضير' },
  ready: { label: 'جاهز', short: 'جاهز' },
  served: { label: 'تم التقديم', short: 'مقدَّم' },
  paid: { label: 'مدفوع', short: 'مدفوع' },
  cancelled: { label: 'ملغي', short: 'ملغي' },
};
export const SUGAR = { none: 'بدون سكر', light: 'سكر خفيف', medium: 'سكر وسط', extra: 'سكر زيادة' };

/** حركة دخول متدرجة للعناصر عند ظهورها في الشاشة */
export function revealOnScroll(root = document) {
  const els = $$('[data-reveal]:not(.is-in)', root);
  if (reducedMotion() || !('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('is-in')); return; }
  const io = new IntersectionObserver((entries) => {
    let n = 0;
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      en.target.style.transitionDelay = `${Math.min(n++ * 60, 360)}ms`;
      en.target.classList.add('is-in');
      io.unobserve(en.target);
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
  els.forEach((e) => io.observe(e));
}
