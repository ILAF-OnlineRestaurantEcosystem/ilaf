// تشغيل النظام كامل داخل المتصفح بدون سيرفر:
// - الـ API بينفّذ نفس core.js محلياً
// - التحديث المباشر بين صفحة الزبون ولوحة الكاشير بنفس المتصفح عبر BroadcastChannel و localStorage
// - ومن أي جهاز ثاني عبر relay.js: اللوحة بتستقبل طلبات الرابط اللي فيه كودها (?c=) وبترد عليها
import { handle, validToken, registerToken } from '../server/core.js';
import { geminiReset } from '../server/barista/gemini.js';
import { reloadFromStorage, dbKey, setTenant, DEFAULT_TENANT } from './db-browser.js';
import { readRegistry, REG_KEY } from './demo-registry.js';
import { createHost, createClient, randomId, cleanCode, siteCode } from './relay.js';

// تجربة CafeFlow: ?store=1002 بيفتح محل ثاني من نفس الموقع (1001 = المحل الأصلي بدون باراميتر)
const STORE = (() => {
  const s = String(new URLSearchParams(location.search).get('store') ?? '').replace(/\D/g, '').slice(0, 8);
  return s && s !== DEFAULT_TENANT ? s : null;
})();
setTenant(STORE ?? DEFAULT_TENANT);
const sk = (k) => (STORE ? `${k}.${STORE}` : k); // كل محل مفاتيحه لحاله (والمحل الأصلي نفس المفاتيح القديمة)
const EVT_KEY = sk('cafe-mohammad-demo-event');
const TOKEN_KEY = `cm.${STORE ? STORE + '.' : ''}admin.token`; // نفس storeKey('admin.token') بـ common.js
const HOST_ID_KEY = sk('cm.relay.hostId');   // معرّف ثابت لهالجهاز كـ"كاشير"
const HOSTED_KEY = sk('cm.relay.hostedAt');  // آخر مرة كان هالمتصفح هو الكاشير
const ME_KEY = sk('cm.relay.me');            // معرّف ثابت لهالجهاز كزبون
const QUEUED_KEY = sk('cm.relay.queued');    // طلبات زبون محفوظة لسا ما رد عليها الكاشير
const GEMINI_KEY = 'cm.gemini.key';
const seen = new Set();
const sockets = new Set();
const lateBuffer = [];

const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch { /* */ } };

// مفتاح Gemini بيضل بمتصفح الكاشير بس، وبيستعمله نديم لما يرد على الزباين
process.env.GEMINI_API_KEY = read(GEMINI_KEY) || '';

class DemoSocket {
  constructor(auth) {
    this.auth = auth ?? {};
    this.handlers = {};
    this.tracked = new Set();
    sockets.add(this);
    setTimeout(() => this._fire('connect'), 30);
  }
  on(event, fn) {
    (this.handlers[event] ??= []).push(fn);
    // رد وصل قبل ما الصفحة تجهز (مثلاً بعد ما رجعت فتحتها): بنسلّمه هلق
    for (const ev of lateBuffer.filter((x) => x.event === event)) {
      lateBuffer.splice(lateBuffer.indexOf(ev), 1);
      setTimeout(() => fn(ev.payload), 0);
    }
    return this;
  }
  emit(event, data) {
    if (event === 'track') {
      const ids = [].concat(data).filter((id) => typeof id === 'string');
      ids.forEach((id) => this.tracked.add(id));
      client?.track(ids);
    }
    return this;
  }
  disconnect() { sockets.delete(this); this._fire('disconnect'); }
  _fire(event, payload) {
    for (const fn of this.handlers[event] ?? []) { try { fn(payload); } catch (err) { console.error(err); } }
  }
}

function deliver(ev) {
  if (!ev?.id || seen.has(ev.id)) return;
  seen.add(ev.id);
  for (const s of sockets) {
    if (ev.room === 'admin' && !validToken(s.auth.token)) continue;
    if (ev.room?.startsWith('order:') && !s.tracked.has(ev.room.slice(6))) continue;
    s._fire(ev.event, ev.payload);
  }
  if (host && ev.room !== 'admin') {
    host.event(ev);
    if (ev.event === 'menu:changed') { clearTimeout(menuTimer); menuTimer = setTimeout(() => host.refreshMenu(), 500); }
  }
}

let channel = null;
try {
  channel = new BroadcastChannel(sk('cafe-mohammad-demo'));
  channel.onmessage = (m) => { reloadFromStorage(); deliver(m.data); };
} catch { /* متصفح قديم */ }
addEventListener('storage', (e) => {
  if (e.key === dbKey()) reloadFromStorage();
  if (e.key === REG_KEY) checkBlocked(); // لوحة المنصة جمّدت المحل أو فكّته
  if (e.key === EVT_KEY && e.newValue) {
    reloadFromStorage();
    try { deliver(JSON.parse(e.newValue)); } catch { /* */ }
  }
});

function publish(ev) {
  const full = { ...ev, id: Date.now().toString(36) + Math.random().toString(36).slice(2) };
  deliver(full);
  try { channel?.postMessage(full); } catch { /* */ }
  try { localStorage.setItem(EVT_KEY, JSON.stringify(full)); } catch { /* */ }
}

const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const hooks = { saveUpload: (_ext, _b64, dataUrl) => dataUrl, lanUrls: () => [] };

async function local(method, path, body, token) {
  const r = await handle(method, path, clone(body), { token, hooks });
  r.events.forEach(publish);
  return r;
}
const fail = (r) => Object.assign(new Error(r.data?.error || 'صار خطأ، جرب كمان مرة.'), { status: r.status });

// ───────── الربط بين الأجهزة ─────────
// المسارات اللي بيقدر الزبون يطلبها من بعيد، وكل شي غيرها بيضل محلي عند الكاشير
const CUSTOMER_ROUTES = [
  ['GET', /^\/menu$/], ['GET', /^\/weather$/], ['GET', /^\/tables\/\d{1,3}$/], ['GET', /^\/tables\/\d{1,3}\/bill$/],
  ['GET', /^\/orders\/[\w-]{1,40}$/], ['POST', /^\/orders$/], ['POST', /^\/tables\/\d{1,3}\/call$/], ['POST', /^\/barista$/],
  ['GET', /^\/devices\/[a-z0-9]{8,40}\/orders$/],
];
const isCustomerRoute = (method, path) => CUSTOMER_ROUTES.some(([m, re]) => m === method && re.test(String(path).split('?')[0]));
const LIMITS = [['POST', /^\/orders$/, 10], ['POST', /\/call$/, 6], ['POST', /^\/barista$/, 20]];
const OFFLINE_MSG = 'ما قدرنا نوصل للكاشير هلق 😕 تأكد من الإنترنت وجرب كمان مرة.';

// كود المحل ثابت من رابط الموقع (?cafe= بيغيّره للتجربة بس). رابط ?c= القديم بيشتغل عادي.
const CODE = cleanCode(new URLSearchParams(location.search).get('cafe')) || siteCode() + (STORE ? 't' + STORE : '');
const readJson = (k, d) => { try { return JSON.parse(read(k)) ?? d; } catch { return d; } };
const writeJson = (k, v) => write(k, JSON.stringify(v));
const persistentId = (k) => { let v = cleanCode(read(k)); if (v.length < 8) { v = randomId(12); write(k, v); } return v; };

let host = null;
let menuTimer = null;
let relayState = 'off';
const relayListeners = new Set();
const setRelayState = (st) => { if (st === relayState) return; relayState = st; relayListeners.forEach((fn) => { try { fn(st); } catch { /* */ } }); };

// صفحة الزبون: إذا هالمتصفح كان هو الكاشير آخر يوم (الكاشير بيجرّب على جواله)، بنكتب مباشرة ببياناته،
// لأن الجوال بيوقّف تبويب اللوحة بالخلفية فما بيقدر يرد عبر الإنترنت. غير هيك بنحكي مع الكاشير عبر الوسيط.
let client = null;
let linkState = 'local';
const linkListeners = new Set();
function getClient() {
  if (client) return client;
  if (relayState !== 'off' || Date.now() - Number(read(HOSTED_KEY) || 0) < 24 * 3600_000) return null;
  linkState = 'connecting';
  client = createClient({
    code: CODE,
    me: persistentId(ME_KEY),
    onEvent: deliver,
    onStatus: (st) => { linkState = st; linkListeners.forEach((fn) => { try { fn(st); } catch { /* */ } }); },
    onLate: lateReply,
  });
  return client;
}

/** رد الكاشير على طلب كان محفوظ (وصل وهالصفحة مفتوحة، أو بعد ما رجعنا فتحناها) */
function lateReply(reqId, res) {
  const queued = readJson(QUEUED_KEY, {});
  const req = queued[reqId];
  if (!req) return;
  delete queued[reqId];
  writeJson(QUEUED_KEY, queued);
  const fire = (event, payload) => {
    const listening = [...sockets].filter((sk) => sk.handlers[event]?.length);
    if (listening.length) listening.forEach((sk) => sk._fire(event, payload));
    else lateBuffer.push({ event, payload });
  };
  if (res.status >= 400) fire('queued:failed', { reqId, path: req.path, error: res.data?.error ?? 'ما انقبل الطلب.' });
  else if (req.path === '/orders') fire('order:accepted', { reqId, order: res.data });
  else fire('call:accepted', { reqId });
}

/** طلب زبون: بيروح لجهاز الكاشير. الطلب والنداء بينحفظوا إذا الكاشير مش فاتح، والباقي منرجع فيه للي بنقدر عليه محلياً */
async function viaRelay(method, path, body) {
  const c = getClient();
  if (method === 'GET' && path === '/menu') {
    await c.whenReady();
    if (c.menu) return clone(c.menu);
  }
  const queue = method === 'POST' && (path === '/orders' || /\/call$/.test(path));
  try {
    const r = await c.request(method, path, clone(body), { queue, timeout: path === '/barista' ? 30_000 : 12_000 });
    if (r.status >= 400) throw fail(r);
    return r.data;
  } catch (err) {
    if (err.queued) {
      const queued = readJson(QUEUED_KEY, {});
      queued[err.reqId] = { path, at: Date.now() };
      writeJson(QUEUED_KEY, queued);
      throw Object.assign(new Error(path === '/orders'
        ? 'الكاشير مش فاتح اللوحة هلق، فطلبك انحفظ ✓ بيوصله أول ما يفتحها.'
        : 'النداء انحفظ ✓ بيوصل للكاشير أول ما يفتح اللوحة.'), { queued: true, reqId: err.reqId, status: 202 });
    }
    if (!err.offline) throw err;
    // القائمة والطقس ورقم الطاولة ونديم بالوضع الأساسي بيشتغلوا محلياً، أما الفاتورة فلازم الكاشير
    if ((method === 'GET' && /^\/(menu|weather|tables\/\d+)$/.test(path.split('?')[0])) || path === '/barista') {
      const r = await local(method, path, body);
      if (r.status >= 400) throw fail(r);
      return clone(r.data);
    }
    throw Object.assign(new Error(err.message === 'admin' || err.message === 'timeout'
      ? 'الكاشير مش فاتح اللوحة هلق، فالفاتورة بتظهر لما يفتحها.' : OFFLINE_MSG), { status: 503 });
  }
}

const servedIds = new Set();
const hits = new Map();
function limited(from, method, path) {
  const rule = LIMITS.find(([m, re]) => m === method && re.test(path));
  if (!rule) return false;
  const key = `${from}|${rule[1]}`;
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  if (arr.length >= rule[2]) return true;
  arr.push(now);
  hits.set(key, arr);
  return false;
}

/** جهة الكاشير: ينفّذ طلب زبون وصل من جهاز ثاني */
async function serve(msg) {
  if (!msg || typeof msg.id !== 'string' || msg.id.length > 40 || !/^[a-z0-9]{6,32}$/.test(msg.from ?? '')) return null;
  if (servedIds.has(msg.id)) return null;
  if (blockedKind()) return { id: msg.id, status: 423, data: { error: 'المحل مش متاح هلأ.' } };
  servedIds.add(msg.id);
  if (servedIds.size > 500) servedIds.delete(servedIds.values().next().value);
  const method = String(msg.method);
  const path = String(msg.path ?? '');
  if (!isCustomerRoute(method, path)) return { id: msg.id, status: 404, data: { error: 'المسار غير متاح.' } };
  if (limited(msg.from, method, path)) return { id: msg.id, status: 429, data: { error: 'طلبات كثيرة ورا بعض، استنى لحظة وجرب كمان مرة.' } };
  reloadFromStorage();
  const r = await local(method, path, msg.body ?? null);
  return { id: msg.id, status: r.status, data: r.data };
}

// شاشة جوال الكاشير بتضل شغّالة طول ما اللوحة قدّامه (إذا طفت الشاشة بيوقف الاستقبال)
let wakeLock = null;
async function keepAwake() {
  if (!host || document.hidden || wakeLock) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch { /* المتصفح ما بيدعمها أو رفض */ }
}

function startHosting() {
  setRelayState('connecting');
  // بنطلب من المتصفح ما يمسح بيانات المحل لحاله لما تقل مساحة الجهاز
  navigator.storage?.persist?.().catch(() => {});
  host = createHost({
    code: CODE,
    hostId: persistentId(HOST_ID_KEY),
    serve,
    snapshot: async () => (await handle('GET', '/menu', null, { hooks })).data,
    onState: ({ connected, active }) => {
      if (active) write(HOSTED_KEY, String(Date.now()));
      setRelayState(!connected ? 'connecting' : active ? 'online' : 'standby');
    },
  });
  setInterval(() => { if (host.active) write(HOSTED_KEY, String(Date.now())); }, 30_000);
  keepAwake();
}

// لما ترجع الصفحة قدّام المستخدم: نقرأ آخر بيانات ونعيد الاتصال فوراً
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  reloadFromStorage();
  host?.wake();
  client?.wake();
  keepAwake();
});

// ───────── تجميد المحل من لوحة المنصة (تجربة الموقع: نفس المتصفح) ─────────
const storeInfo = () => readRegistry().tenants.find((t) => t.id === (STORE ?? DEFAULT_TENANT)) ?? null;
function blockedKind() {
  const t = storeInfo();
  return !t ? 'missing' : t.status === 'suspended' ? 'frozen' : null;
}
let blockedShown = false;
function showBlocked(kind) {
  if (blockedShown) return;
  blockedShown = true;
  const admin = Boolean(document.querySelector('#loginLogo, #sideNav'));
  const [title, msg] = kind === 'missing'
    ? ['ما في محل بهالرقم', 'تأكد من الرابط أو الـ QR، أو ارجع للوحة المنصة.']
    : admin
      ? ['الحساب مجمّد', 'حساب المحل مجمّد مؤقتاً من إدارة CafeFlow، وكل بياناتك محفوظة. تواصل معنا عشان نرجّعه.']
      : ['المحل مش متاح هلأ', 'الطلب من الطاولة متوقف مؤقتاً. اطلب من الكاشير مباشرة، وشكراً لصبرك 🙏'];
  const hide = document.createElement('style');
  hide.textContent = 'body{display:none!important}';
  document.head.append(hide);
  const box = document.createElement('div');
  box.setAttribute('role', 'alert');
  box.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:24px 16px;background:#eef3f7;font-family:Alexandria,system-ui,sans-serif;direction:rtl;overflow:auto';
  box.innerHTML = `<div style="width:min(420px,100%);display:grid;gap:14px;justify-items:center;text-align:center;padding:34px 26px;border-radius:28px;background:#fff;box-shadow:0 24px 50px -30px rgba(20,40,60,.55);color:#1d2b36">
    <span style="width:76px;height:76px;display:grid;place-items:center;border-radius:50%;background:#dfeaf3;color:#2c5a7a"><svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><path d="M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5"/></svg></span>
    <h1 style="margin:4px 0 0;font-size:24px;font-weight:800">${title}</h1>
    <p style="margin:0;color:#566874;line-height:1.7;max-width:32ch">${msg}</p>
    <span style="margin-top:6px;font-size:12.5px;color:#566874;direction:ltr">Cafe<b style="color:#1d2b36">Flow</b></span></div>`;
  document.documentElement.append(box);
}
function checkBlocked() {
  const kind = blockedKind();
  if (kind) showBlocked(kind);
  else if (blockedShown) location.reload(); // انفك التجميد
}
if (document.readyState === 'loading') addEventListener('DOMContentLoaded', checkBlocked); else checkBlocked();

window.io = (opts = {}) => new DemoSocket(opts.auth);
window.__CAFE_DEMO__ = {
  async api(path, { method = 'GET', body, token } = {}) {
    const blocked = blockedKind();
    if (blocked) {
      showBlocked(blocked);
      throw Object.assign(new Error(blocked === 'frozen' ? 'الحساب مجمّد مؤقتاً.' : 'ما في محل بهالرقم.'), { status: blocked === 'frozen' ? 423 : 404 });
    }
    if (isCustomerRoute(method, path) && getClient()) return viaRelay(method, path, body);
    // جلسة الكاشير تضل شغّالة بعد تحديث الصفحة
    try { if (token && !validToken(token) && read(TOKEN_KEY) === token) registerToken(token); } catch { /* */ }
    const r = await local(method, path, body, token);
    if (r.status >= 400) throw fail(r);
    return clone(r.data); // نسخة مستقلة مثل ما بترجع من الشبكة
  },

  /** حالة اتصال صفحة الزبون بالكاشير: local (نفس الجهاز) | connecting | online | offline */
  link: {
    get state() { return linkState; },
    onChange(fn) { linkListeners.add(fn); fn(linkState); },
  },
  /** طلبات محفوظة لسا ما رد عليها الكاشير (عشان صفحة الزبون تفرجيها) */
  queued() { return readJson(QUEUED_KEY, {}); },

  /** لوحة الكاشير بتصير "السيرفر" للأجهزة الثانية */
  relay: {
    code: () => CODE,
    /** رابط ?cafe= للتجربة بيضل بالرابط اللي بنشاركه */
    customerParams: () => ({
      ...(new URLSearchParams(location.search).get('cafe') ? { cafe: CODE } : {}),
      ...(STORE ? { store: STORE } : {}),
    }),
    get state() { return relayState; },
    onChange(fn) { relayListeners.add(fn); fn(relayState); },
    /** "خلّي هالجهاز هو الكاشير" */
    takeover() { host?.takeover(); },
    host() {
      if (relayState !== 'off') return;
      // بنفس المتصفح تبويب واحد بس بيستقبل، عشان الطلب ما ينحسب مرتين
      if (navigator.locks?.request) {
        setRelayState('tab');
        navigator.locks.request(sk('cafe-mohammad-relay-host'), () => { startHosting(); return new Promise(() => {}); })
          .catch(() => { if (!host) startHosting(); });
      } else startHosting();
    },
  },

  /** حجم البيانات المحفوظة بهالمتصفح (ك.ب) — المتصفح بيسمح بحوالي 5 ميغا */
  storageKB() { const v = read(dbKey()); return v ? Math.round(v.length / 1024) : 0; },
  /** المحل انجمّد (common.js → frozenNow) */
  frozen() { checkBlocked(); },

  gemini: {
    get configured() { return Boolean(process.env.GEMINI_API_KEY); },
    set(key) {
      const k = String(key ?? '').trim();
      process.env.GEMINI_API_KEY = k;
      write(GEMINI_KEY, k);
      geminiReset();
    },
  },
};
