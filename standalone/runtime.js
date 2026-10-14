// تشغيل النظام كامل داخل المتصفح بدون سيرفر:
// - الـ API بينفّذ نفس core.js محلياً
// - التحديث المباشر بين صفحة الزبون ولوحة الكاشير بنفس المتصفح عبر BroadcastChannel و localStorage
// - ومن أي جهاز ثاني عبر relay.js: اللوحة بتستقبل طلبات الرابط اللي فيه كودها (?c=) وبترد عليها
import { handle, validToken, registerToken } from '../server/core.js';
import { geminiReset } from '../server/barista/gemini.js';
import { reloadFromStorage, DB_KEY } from './db-browser.js';
import { createHost, createClient, randomId, cleanCode, siteCode } from './relay.js';

const EVT_KEY = 'cafe-mohammad-demo-event';
const TOKEN_KEY = 'cm.admin.token';
const HOST_ID_KEY = 'cm.relay.hostId';   // معرّف ثابت لهالجهاز كـ"كاشير"
const HOSTED_KEY = 'cm.relay.hostedAt';  // آخر مرة كان هالمتصفح هو الكاشير
const ME_KEY = 'cm.relay.me';            // معرّف ثابت لهالجهاز كزبون
const QUEUED_KEY = 'cm.relay.queued';    // طلبات زبون محفوظة لسا ما رد عليها الكاشير
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
  channel = new BroadcastChannel('cafe-mohammad-demo');
  channel.onmessage = (m) => { reloadFromStorage(); deliver(m.data); };
} catch { /* متصفح قديم */ }
addEventListener('storage', (e) => {
  if (e.key === DB_KEY) reloadFromStorage();
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
const CODE = cleanCode(new URLSearchParams(location.search).get('cafe')) || siteCode();
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

window.io = (opts = {}) => new DemoSocket(opts.auth);
window.__CAFE_DEMO__ = {
  async api(path, { method = 'GET', body, token } = {}) {
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
    customerParams: () => (new URLSearchParams(location.search).get('cafe') ? { cafe: CODE } : {}),
    get state() { return relayState; },
    onChange(fn) { relayListeners.add(fn); fn(relayState); },
    /** "خلّي هالجهاز هو الكاشير" */
    takeover() { host?.takeover(); },
    host() {
      if (relayState !== 'off') return;
      // بنفس المتصفح تبويب واحد بس بيستقبل، عشان الطلب ما ينحسب مرتين
      if (navigator.locks?.request) {
        setRelayState('tab');
        navigator.locks.request('cafe-mohammad-relay-host', () => { startHosting(); return new Promise(() => {}); })
          .catch(() => { if (!host) startHosting(); });
      } else startHosting();
    },
  },

  /** حجم البيانات المحفوظة بهالمتصفح (ك.ب) — المتصفح بيسمح بحوالي 5 ميغا */
  storageKB() { const v = read(DB_KEY); return v ? Math.round(v.length / 1024) : 0; },

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
