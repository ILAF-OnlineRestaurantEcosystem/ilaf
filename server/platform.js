// منصة CafeFlow: سجل المحلات (كافيهات ومطاعم) وحسابات أصحاب المنصة ولوحة التحكم المشتركة
// السجل محفوظ بـ data/platform.json (platform-store.js)، وكل محل بياناته لحاله (db.js)
// نفس الملف بيشتغل بنسخة الموقع الثابت داخل المتصفح (التخزين هناك standalone/demo-registry.js)
import { withTenant, db, save, createTenantData, DEFAULT_TENANT } from './db.js';
import { readRegistry, writeRegistry, hashPassword, samePassword, randomHex, newId } from './platform-store.js';
import { buildSeed } from './seed.js';
import { registerToken, randomToken, dropSessions } from './core.js';
import { HttpError, monthKey, OPEN_STATUSES } from './logic.js';
import { summarize } from './reports.js';

export const PLATFORM_NAME = 'CafeFlow';
const TYPES = { cafe: 'كافيه', restaurant: 'مطعم' };
let reg = null;

const now = () => new Date().toISOString();
const str = (v, max = 200) => String(v ?? '').trim().slice(0, max);
const write = () => writeRegistry(reg);
const setupCode = () => randomHex(4).toUpperCase().replace(/(.{4})/, '$1-');

function registry() {
  if (reg) return reg;
  reg = readRegistry();
  if (!reg) {
    // أول تشغيل للمنصة: المحل الموجود (كافي محمد) بيصير أول محل
    const s = withTenant(DEFAULT_TENANT, () => db().settings);
    reg = {
      users: [],
      tenants: [{ id: DEFAULT_TENANT, name: s.cafeName, type: s.businessType ?? 'cafe', ownerName: '', ownerPhone: '', status: 'active', notes: '', createdAt: now(), createdBy: 'system' }],
      nextId: Number(DEFAULT_TENANT) + 1,
    };
  }
  // ما في ولا حساب: رمز إعداد بيطلع بشاشة السيرفر بس (عشان ما حدا غريب ياخد المنصة)
  if (!reg.users.length && !reg.setupKey) reg.setupKey = setupCode();
  write();
  return reg;
}
// السيرفر بيسمع لتغيّر حالة المحل (عشان يسكّر الصفحات المفتوحة لحظة التجميد)
const listeners = new Set();
export const onTenantChange = (fn) => listeners.add(fn);
export const isFrozen = (t) => t?.status === 'suspended';
function setFrozen(t, frozen, by, reason = '') {
  if (isFrozen(t) === frozen) return;
  t.status = frozen ? 'suspended' : 'active';
  if (frozen) {
    t.frozenAt = now(); t.frozenBy = by; t.frozenReason = str(reason, 120);
    dropSessions(t.id);
  } else {
    delete t.frozenAt; delete t.frozenBy; delete t.frozenReason;
  }
  listeners.forEach((fn) => fn(t));
}
export const tenantInfo = (id) => registry().tenants.find((t) => t.id === String(id)) ?? null;
export const setupKey = () => (registry().users.length ? null : registry().setupKey);

// ───────── كلمات السر والجلسات ─────────
const checkPassword = (user, password) => samePassword(user, password);
const sessions = new Map(); // token → { userId, exp }
function startSession(user) {
  const token = randomHex(24);
  sessions.set(token, { userId: user.id, exp: Date.now() + 7 * 24 * 3600 * 1000 });
  return token;
}
function sessionUser(token) {
  const s = token && sessions.get(token);
  if (!s || s.exp < Date.now()) { if (s) sessions.delete(token); return null; }
  return registry().users.find((u) => u.id === s.userId) ?? null;
}
const publicUser = (u) => ({ id: u.id, username: u.username, name: u.name, createdAt: u.createdAt });
function validUser(body) {
  const username = str(body?.username, 24).toLowerCase();
  if (!/^[a-z0-9_.-]{3,24}$/.test(username)) throw new HttpError(400, 'اسم المستخدم (ID) بالإنجليزي من 3 لـ 24 حرف، مثلاً mohammed.');
  const name = str(body?.name, 40) || username;
  const password = String(body?.password ?? '');
  if (password.length < 6) throw new HttpError(400, 'كلمة السر لازم تكون 6 أحرف أو أكثر.');
  if (registry().users.some((u) => u.username === username)) throw new HttpError(409, 'اسم المستخدم هاد موجود.');
  return { username, name, password };
}
function addUser({ username, name, password }, by) {
  const user = { id: newId(), username, name, ...hashPassword(password), createdAt: now(), createdBy: by };
  registry().users.push(user);
  write();
  return user;
}

// ───────── أرقام كل محل ─────────
function tenantStats(id) {
  return withTenant(id, () => {
    const d = db();
    const from = new Date(d.settings.dayOpenedAt ?? new Date(new Date().setHours(0, 0, 0, 0)));
    const valid = d.orders.filter((o) => o.status !== 'cancelled');
    const today = valid.filter((o) => new Date(o.createdAt) >= from);
    const key = monthKey(new Date());
    const month = summarize(valid.filter((o) => monthKey(o.createdAt) === key), d);
    const last = d.orders.reduce((a, o) => (o.createdAt > a ? o.createdAt : a), '');
    return {
      todayOrders: today.length,
      todayRevenue: Math.round(today.reduce((s, o) => s + o.total, 0) * 100) / 100,
      monthOrders: month.orders,
      monthRevenue: month.revenue,
      monthProfit: month.profit,
      openOrders: d.orders.filter((o) => OPEN_STATUSES.includes(o.status)).length,
      items: d.items.length,
      tables: d.tables.length,
      lastOrderAt: last || null,
      cafeName: d.settings.cafeName,
      businessType: d.settings.businessType ?? 'cafe',
    };
  });
}
function withStats(t) {
  const stats = tenantStats(t.id);
  if (stats.businessType !== t.type) { t.type = stats.businessType; write(); } // الكاشير غيّر النوع من الإعدادات
  return { ...t, typeLabel: TYPES[t.type] ?? t.type, stats };
}

function setTenantPin(id, pin) {
  const p = str(pin, 8);
  if (!/^\d{4,8}$/.test(p)) throw new HttpError(400, 'رمز لوحة الكاشير لازم يكون من 4 لـ 8 أرقام.');
  withTenant(id, () => { db().settings.adminPin = p; save(); });
}

// ───────── المسارات ─────────
const routes = [];
const route = (method, pattern, fn, { auth = true } = {}) => {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
  routes.push({ method, re, keys, fn, auth });
};

route('GET', '/info', () => ({ name: PLATFORM_NAME, needsSetup: registry().users.length === 0 }), { auth: false });
route('POST', '/setup', ({ body }) => {
  const r = registry();
  if (r.users.length) throw new HttpError(409, 'المنصة متجهّزة من قبل، سجّل دخول.');
  if (str(body?.key, 20).toUpperCase() !== r.setupKey) throw new HttpError(403, 'رمز الإعداد غلط. بتلاقيه بشاشة السيرفر لما يشتغل.');
  const user = addUser(validUser(body), 'setup');
  delete r.setupKey;
  write();
  return { token: startSession(user), user: publicUser(user) };
}, { auth: false });
route('POST', '/login', ({ body }) => {
  const user = registry().users.find((u) => u.username === str(body?.username, 24).toLowerCase());
  if (!user || !checkPassword(user, body?.password ?? '')) throw new HttpError(401, 'اسم المستخدم أو كلمة السر غلط.');
  return { token: startSession(user), user: publicUser(user) };
}, { auth: false });
route('POST', '/logout', ({ token }) => { sessions.delete(token); return { ok: true }; });
route('GET', '/me', ({ user }) => publicUser(user));

// المحلات
route('GET', '/tenants', () => registry().tenants.map(withStats));
route('POST', '/tenants', ({ body, user }) => {
  const r = registry();
  const name = str(body?.name, 40);
  if (!name) throw new HttpError(400, 'اكتب اسم المحل.');
  const type = body?.type === 'restaurant' ? 'restaurant' : 'cafe';
  const pin = str(body?.pin, 8) || String(Math.floor(1000 + Math.random() * 9000));
  if (!/^\d{4,8}$/.test(pin)) throw new HttpError(400, 'رمز لوحة الكاشير لازم يكون من 4 لـ 8 أرقام.');
  const id = String(r.nextId++);
  createTenantData(id, buildSeed({ type, name, demo: body?.demo === true }));
  setTenantPin(id, pin);
  const tenant = { id, name, type, ownerName: str(body?.ownerName, 40), ownerPhone: str(body?.ownerPhone, 20), status: 'active', notes: str(body?.notes, 300), createdAt: now(), createdBy: user.username };
  r.tenants.push(tenant);
  write();
  return { status: 201, data: { ...withStats(tenant), pin } };
});
route('PATCH', '/tenants/:id', ({ p, body, user }) => {
  const t = tenantInfo(p.id);
  if (!t) throw new HttpError(404, 'المحل مش موجود.');
  if (body?.name != null) t.name = str(body.name, 40) || t.name;
  if (body?.type != null) t.type = body.type === 'restaurant' ? 'restaurant' : 'cafe';
  if (body?.ownerName != null) t.ownerName = str(body.ownerName, 40);
  if (body?.ownerPhone != null) t.ownerPhone = str(body.ownerPhone, 20);
  if (body?.notes != null) t.notes = str(body.notes, 300);
  if (body?.status != null) setFrozen(t, body.status === 'suspended', user.username);
  // الاسم والنوع بيوصلوا لإعدادات المحل نفسه
  withTenant(t.id, () => {
    const s = db().settings;
    s.cafeName = t.name;
    s.brandWord = t.name.trim().split(/\s+/).pop();
    s.businessType = t.type;
    save();
  });
  write();
  return withStats(t);
});
// تجميد الحساب: صفحة الزباين ولوحة الكاشير والـ API كلهم بيتسكّروا، والمفتوح بيتسكّر بنفس اللحظة
route('POST', '/tenants/:id/freeze', ({ p, body, user }) => {
  const t = tenantInfo(p.id);
  if (!t) throw new HttpError(404, 'المحل مش موجود.');
  setFrozen(t, true, user.username, body?.reason);
  write();
  return withStats(t);
});
route('POST', '/tenants/:id/unfreeze', ({ p, user }) => {
  const t = tenantInfo(p.id);
  if (!t) throw new HttpError(404, 'المحل مش موجود.');
  setFrozen(t, false, user.username);
  write();
  return withStats(t);
});
route('POST', '/tenants/:id/pin', ({ p, body }) => {
  if (!tenantInfo(p.id)) throw new HttpError(404, 'المحل مش موجود.');
  setTenantPin(p.id, body?.pin);
  return { ok: true };
});
// "افتح لوحة الكاشير" من المنصة بدون رمز المحل
route('POST', '/tenants/:id/session', ({ p }) => {
  const t = tenantInfo(p.id);
  if (!t) throw new HttpError(404, 'المحل مش موجود.');
  if (isFrozen(t)) throw new HttpError(423, 'الحساب مجمّد. فك التجميد أول عشان تفتح لوحة الكاشير.');
  return { token: withTenant(p.id, () => registerToken(randomToken())) };
});

// فريق المنصة (إنت وصاحبك)
route('GET', '/users', () => registry().users.map(publicUser));
route('POST', '/users', ({ body, user }) => ({ status: 201, data: publicUser(addUser(validUser(body), user.username)) }));
route('DELETE', '/users/:id', ({ p, user }) => {
  const r = registry();
  if (p.id === user.id) throw new HttpError(409, 'ما بتقدر تحذف حسابك وإنت داخل فيه.');
  if (r.users.length <= 1) throw new HttpError(409, 'لازم يضل حساب واحد على الأقل.');
  r.users = r.users.filter((u) => u.id !== p.id);
  write();
  return { ok: true };
});
route('POST', '/me/password', ({ body, user }) => {
  if (!checkPassword(user, body?.current ?? '')) throw new HttpError(401, 'كلمة السر الحالية غلط.');
  if (String(body?.next ?? '').length < 6) throw new HttpError(400, 'كلمة السر الجديدة لازم تكون 6 أحرف أو أكثر.');
  Object.assign(user, hashPassword(body.next));
  write();
  return { ok: true };
});

/** ينفّذ طلب على API المنصة ويرجع { status, data } */
export async function platformHandle(method, fullPath, body, { token = null } = {}) {
  const pathOnly = String(fullPath).split('?')[0];
  for (const r of routes) {
    if (r.method !== method) continue;
    const m = pathOnly.match(r.re);
    if (!m) continue;
    const p = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
    try {
      const user = sessionUser(token);
      if (r.auth && !user) throw new HttpError(401, 'سجّل دخول للمنصة.');
      const out = await r.fn({ p, body, token, user });
      return out && typeof out === 'object' && 'data' in out && 'status' in out ? out : { status: 200, data: out };
    } catch (err) {
      if (err instanceof HttpError) return { status: err.status, data: { error: err.message } };
      console.error(err);
      return { status: 500, data: { error: 'صار خطأ بالسيرفر، جرب كمان مرة.' } };
    }
  }
  return { status: 404, data: { error: 'المسار غير موجود.' } };
}
