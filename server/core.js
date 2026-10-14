// قلب النظام: كل مسارات الـ API كدوال صافية (بدون Express ولا ملفات)
// نفس الكود بيشغّل السيرفر الحقيقي، وبيشغّل نسخة الـ HTML المستقلة داخل المتصفح.
import { db, save, uid, replaceAll } from './db.js';
import {
  publicMenu, createOrder, setOrderStatus, publicOrder, tableInsight, stats,
  setLinePrice, closeTable, tableBill, currentDay, closeDay, months, monthReport, maintain,
  OPEN_STATUSES, HttpError,
} from './logic.js';
import { currentWeather, geocode } from './weather.js';
import { chat } from './barista/index.js';
import { aiStatus } from './barista/ai.js';

export { HttpError };

// ───────── جلسات الكاشير ─────────
const sessions = new Map(); // token → expiresAt
function randomToken() {
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export function registerToken(token, ttlMs = 12 * 3600 * 1000) { sessions.set(token, Date.now() + ttlMs); return token; }
export function validToken(token) {
  const exp = token && sessions.get(token);
  if (!exp) return false;
  if (exp < Date.now()) { sessions.delete(token); return false; }
  return true;
}
function sameText(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ───────── أدوات التحقق ─────────
const str = (v, max = 200) => String(v ?? '').trim().slice(0, max);
const num = (v, { min = 0, max = 100000 } = {}) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw new HttpError(400, 'قيمة رقمية غير صحيحة.');
  return Math.round(n * 100) / 100;
};
const slug = (s) => str(s, 40).toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, '-').replace(/^-|-$/g, '') || uid();

function validateCategory(body) {
  const name = str(body?.name, 40);
  if (!name) throw new HttpError(400, 'اسم القسم مطلوب.');
  const temp = ['hot', 'cold'].includes(body?.temp) ? body.temp : null;
  return { name, temp, icon: str(body?.icon, 20) || 'cup', en: str(body?.en, 40), desc: str(body?.desc, 120) };
}
function validateItem(body) {
  const d = db();
  const name = str(body?.name, 60);
  if (!name) throw new HttpError(400, 'اسم الصنف مطلوب.');
  if (!d.categories.some((c) => c.id === body?.categoryId)) throw new HttpError(400, 'اختر قسماً صحيحاً للصنف.');
  let image = body?.image ? String(body.image) : null;
  if (image && !(/^(\/uploads\/[\w.-]+|https:\/\/[^\s"'<>]{1,490})$/.test(image) || (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(image) && image.length < 700_000))) {
    throw new HttpError(400, 'رابط الصورة غير صالح.');
  }
  return {
    name,
    categoryId: body.categoryId,
    desc: str(body?.desc, 200),
    recipe: str(body?.recipe, 400),
    price: num(body?.price, { min: 0, max: 10000 }),
    cost: num(body?.cost === '' || body?.cost == null ? 0 : body.cost, { min: 0, max: 10000 }),
    sugar: Math.round(num(body?.sugar ?? 1, { min: 0, max: 3 })),
    caffeine: Math.round(num(body?.caffeine ?? 0, { min: 0, max: 3 })),
    tags: (Array.isArray(body?.tags) ? body.tags : String(body?.tags ?? '').split(/[،,]/)).map((t) => str(t, 20)).filter(Boolean).slice(0, 8),
    sugarChoice: Boolean(body?.sugarChoice),
    available: body?.available !== false,
    art: str(body?.art, 20) || 'cup',
    hue: Math.round(num(body?.hue ?? 30, { min: 0, max: 360 })),
    image,
  };
}
function validateOffer(body) {
  const d = db();
  const type = body?.type === 'discount' ? 'discount' : 'combo';
  const title = str(body?.title, 40);
  if (!title) throw new HttpError(400, 'اسم العرض مطلوب.');
  const itemIds = (Array.isArray(body?.itemIds) ? body.itemIds : []).filter((id) => d.items.some((i) => i.id === id)).slice(0, 8);
  if (!itemIds.length) throw new HttpError(400, 'اختر صنفاً واحداً على الأقل للعرض.');
  if (type === 'combo' && itemIds.length < 2) throw new HttpError(400, 'العرض المجمّع يحتاج صنفين على الأقل.');
  return {
    type, title, itemIds,
    description: str(body?.description, 160),
    price: type === 'combo' ? num(body?.price, { min: 0, max: 10000 }) : 0,
    percent: type === 'discount' ? num(body?.percent, { min: 1, max: 90 }) : 0,
    active: body?.active !== false,
  };
}

// ───────── الأحداث المباشرة ─────────
// room: 'admin' للكاشير، 'order:<id>' لزبون الطلب، null للكل
const toAdmin = (event, payload) => ({ event, payload, room: 'admin' });
const toAll = (event, payload = null) => ({ event, payload, room: null });
const orderEvents = (o) => [toAdmin('order:update', o), { event: 'order:update', payload: publicOrder(o), room: 'order:' + o.id }];

// ───────── المسارات ─────────
const routes = [];
const route = (method, pattern, fn, { admin = false } = {}) => {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
  routes.push({ method, re, keys, fn, admin });
};

// الزبون
route('GET', '/menu', () => publicMenu());
route('GET', '/weather', () => currentWeather());
route('GET', '/tables/:n', ({ p }) => {
  const info = tableInsight(p.n);
  if (!info) throw new HttpError(404, `ما في طاولة رقم ${p.n}.`);
  return {
    number: info.number, zone: info.zone?.name ?? '', seats: info.seats,
    top: info.topAtTable.map((x) => ({ id: x.id, name: x.name })),
  };
});
route('GET', '/tables/:n/bill', ({ p }) => tableBill(p.n));
route('POST', '/orders', ({ body }) => {
  const order = createOrder({ table: body?.table, lines: body?.lines, note: body?.note, source: body?.source });
  return { status: 201, data: publicOrder(order), events: [toAdmin('order:new', order)] };
});
route('GET', '/orders/:id', ({ p }) => {
  const order = db().orders.find((o) => o.id === p.id);
  if (!order) throw new HttpError(404, 'الطلب غير موجود.');
  return publicOrder(order);
});
route('POST', '/tables/:n/call', ({ p, body }) => {
  const n = Number(p.n);
  const d = db();
  if (!d.tables.some((t) => t.number === n)) throw new HttpError(404, 'رقم طاولة غير صحيح.');
  const kind = body?.kind === 'bill' ? 'bill' : 'waiter';
  let call = d.calls.find((c) => c.table === n && c.kind === kind);
  if (!call) {
    call = { id: uid('c'), table: n, kind, at: new Date().toISOString() };
    d.calls.push(call);
    save();
  }
  return { status: 201, data: { ok: true }, events: [toAdmin('call:new', call)] };
});
route('POST', '/barista', ({ body }) => chat({
  history: body?.history, table: body?.table, cart: body?.cart, greeting: str(body?.greeting, 400),
}));

// الكاشير
route('POST', '/admin/login', ({ body }) => {
  const pin = str(body?.pin, 12);
  if (!sameText(pin, String(db().settings.adminPin))) throw new HttpError(401, 'الرمز غير صحيح.');
  return { token: registerToken(randomToken()) };
});
route('POST', '/admin/logout', ({ token }) => { sessions.delete(token); return { ok: true }; }, { admin: true });
route('GET', '/admin/bootstrap', ({ hooks }) => {
  maintain(); // مرة باليوم: أرشفة الشهور اللي خلصت وتنظيف الطلبات القديمة
  const d = db();
  return {
    settings: d.settings,
    categories: [...d.categories].sort((a, b) => a.order - b.order),
    items: d.items,
    offers: d.offers,
    zones: d.zones,
    tables: d.tables,
    orders: d.orders.filter((o) => OPEN_STATUSES.includes(o.status)),
    calls: d.calls,
    ai: aiStatus(),
    demoOrders: d.orders.filter((o) => o.demo).length,
    lanUrls: hooks.lanUrls?.() ?? [],
  };
}, { admin: true });
route('GET', '/admin/orders', ({ q }) => {
  const limit = Math.min(300, Number(q.get('limit')) || 100);
  const status = str(q.get('status'), 20);
  let list = db().orders;
  if (status === 'open') list = list.filter((o) => OPEN_STATUSES.includes(o.status));
  else if (status) list = list.filter((o) => o.status === status);
  return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}, { admin: true });
route('PATCH', '/admin/orders/:id', ({ p, body }) => {
  const order = setOrderStatus(p.id, str(body?.status, 20));
  return { data: order, events: orderEvents(order) };
}, { admin: true });
route('POST', '/admin/tables/:n/close', ({ p }) => {
  const n = Number(p.n);
  const { closed, hadCalls } = closeTable(n);
  const events = closed.flatMap(orderEvents);
  if (hadCalls) events.push(toAdmin('call:resolved', { table: n }));
  return { data: { closed: closed.length }, events };
}, { admin: true });

// خصم على صنف داخل فاتورة وحدة
route('PATCH', '/admin/orders/:id/lines/:i', ({ p, body }) => {
  const order = setLinePrice(p.id, p.i, body?.price);
  return { data: order, events: orderEvents(order) };
}, { admin: true });

// يوم العمل وإغلاق المحل
route('GET', '/admin/day', () => currentDay(), { admin: true });
route('POST', '/admin/day/close', ({ body }) => {
  const { record, closedOrders } = closeDay({ force: body?.force === true });
  return { data: record, events: [...closedOrders.flatMap(orderEvents), toAdmin('day:closed', { id: record.id })] };
}, { admin: true });
route('GET', '/admin/days', () => db().days.map(({ items, ...d }) => ({ ...d, topItems: items.slice(0, 3).map((i) => i.name) })), { admin: true });
route('GET', '/admin/days/:id', ({ p }) => {
  const day = db().days.find((d) => d.id === p.id);
  if (!day) throw new HttpError(404, 'اليوم غير موجود.');
  return day;
}, { admin: true });
route('DELETE', '/admin/calls/:id', ({ p }) => {
  const d = db();
  const call = d.calls.find((c) => c.id === p.id);
  d.calls = d.calls.filter((c) => c.id !== p.id);
  save();
  return { data: { ok: true }, events: call ? [toAdmin('call:resolved', { id: call.id, table: call.table })] : [] };
}, { admin: true });

route('POST', '/admin/categories', ({ body }) => {
  const d = db();
  const data = validateCategory(body);
  let id = slug(body?.id || data.name);
  if (d.categories.some((c) => c.id === id)) id += '-' + uid().slice(-4);
  const cat = { id, ...data, order: Math.max(0, ...d.categories.map((c) => c.order)) + 1 };
  d.categories.push(cat);
  save();
  return { status: 201, data: cat, events: [toAll('menu:changed')] };
}, { admin: true });
route('PUT', '/admin/categories/:id', ({ p, body }) => {
  const cat = db().categories.find((c) => c.id === p.id);
  if (!cat) throw new HttpError(404, 'القسم غير موجود.');
  Object.assign(cat, validateCategory({ ...cat, ...body }));
  save();
  return { data: cat, events: [toAll('menu:changed')] };
}, { admin: true });
route('PUT', '/admin/categories-order', ({ body }) => {
  const ids = Array.isArray(body?.ids) ? body.ids : [];
  db().categories.forEach((c) => { const i = ids.indexOf(c.id); if (i >= 0) c.order = i + 1; });
  save();
  return { data: { ok: true }, events: [toAll('menu:changed')] };
}, { admin: true });
route('DELETE', '/admin/categories/:id', ({ p }) => {
  const d = db();
  const count = d.items.filter((i) => i.categoryId === p.id).length;
  if (count) throw new HttpError(409, `القسم فيه ${count} أصناف. انقلها لقسم ثاني أو احذفها أولاً.`);
  d.categories = d.categories.filter((c) => c.id !== p.id);
  save();
  return { data: { ok: true }, events: [toAll('menu:changed')] };
}, { admin: true });

route('POST', '/admin/items', ({ body }) => {
  const d = db();
  const data = validateItem(body);
  let id = slug(body?.id || data.name);
  if (d.items.some((i) => i.id === id)) id += '-' + uid().slice(-4);
  const item = { id, ...data };
  d.items.push(item);
  save();
  return { status: 201, data: item, events: [toAll('menu:changed')] };
}, { admin: true });
route('PUT', '/admin/items/:id', ({ p, body }) => {
  const item = db().items.find((i) => i.id === p.id);
  if (!item) throw new HttpError(404, 'الصنف غير موجود.');
  Object.assign(item, validateItem({ ...item, ...body }));
  save();
  return { data: item, events: [toAll('menu:changed')] };
}, { admin: true });
route('DELETE', '/admin/items/:id', ({ p }) => {
  const d = db();
  const inOffer = d.offers.find((o) => o.itemIds.includes(p.id));
  if (inOffer) throw new HttpError(409, `الصنف داخل عرض "${inOffer.title}". عدّل العرض أولاً.`);
  d.items = d.items.filter((i) => i.id !== p.id);
  save();
  return { data: { ok: true }, events: [toAll('menu:changed')] };
}, { admin: true });

route('POST', '/admin/offers', ({ body }) => {
  const offer = { id: uid('of'), ...validateOffer(body) };
  db().offers.push(offer);
  save();
  return { status: 201, data: offer, events: [toAll('menu:changed')] };
}, { admin: true });
route('PUT', '/admin/offers/:id', ({ p, body }) => {
  const offer = db().offers.find((o) => o.id === p.id);
  if (!offer) throw new HttpError(404, 'العرض غير موجود.');
  Object.assign(offer, validateOffer({ ...offer, ...body }));
  save();
  return { data: offer, events: [toAll('menu:changed')] };
}, { admin: true });
route('DELETE', '/admin/offers/:id', ({ p }) => {
  db().offers = db().offers.filter((o) => o.id !== p.id);
  save();
  return { data: { ok: true }, events: [toAll('menu:changed')] };
}, { admin: true });

route('POST', '/admin/zones', ({ body }) => {
  const name = str(body?.name, 40);
  if (!name) throw new HttpError(400, 'اسم المنطقة مطلوب.');
  const zone = { id: uid('z'), name, description: str(body?.description, 240) };
  db().zones.push(zone);
  save();
  return { status: 201, data: zone };
}, { admin: true });
route('PUT', '/admin/zones/:id', ({ p, body }) => {
  const zone = db().zones.find((z) => z.id === p.id);
  if (!zone) throw new HttpError(404, 'المنطقة غير موجودة.');
  const name = str(body?.name ?? zone.name, 40);
  if (!name) throw new HttpError(400, 'اسم المنطقة مطلوب.');
  Object.assign(zone, { name, description: str(body?.description ?? zone.description, 240) });
  save();
  return zone;
}, { admin: true });
route('DELETE', '/admin/zones/:id', ({ p }) => {
  const d = db();
  if (d.zones.length <= 1) throw new HttpError(409, 'لازم تضل منطقة وحدة على الأقل.');
  const fallbackZone = d.zones.find((z) => z.id !== p.id);
  d.tables.forEach((t) => { if (t.zoneId === p.id) t.zoneId = fallbackZone.id; });
  d.zones = d.zones.filter((z) => z.id !== p.id);
  save();
  return { ok: true, movedTo: fallbackZone.id };
}, { admin: true });
route('PUT', '/admin/tables', ({ body }) => {
  const d = db();
  const count = Math.round(num(body?.count, { min: 1, max: 300 }));
  const zoneId = d.zones.some((z) => z.id === body?.zoneId) ? body.zoneId : d.zones[0].id;
  if (count > d.tables.length) {
    for (let n = d.tables.length + 1; n <= count; n++) d.tables.push({ number: n, zoneId, seats: 4 });
  } else {
    const busy = d.orders.some((o) => o.table > count && OPEN_STATUSES.includes(o.status));
    if (busy) throw new HttpError(409, 'في طاولات عليها طلبات مفتوحة ضمن الأرقام اللي بدك تشيلها. سكّرها أولاً.');
    d.tables = d.tables.slice(0, count);
  }
  save();
  return { data: d.tables, events: [toAll('menu:changed')] };
}, { admin: true });
route('PUT', '/admin/tables/:n', ({ p, body }) => {
  const d = db();
  const t = d.tables.find((x) => x.number === Number(p.n));
  if (!t) throw new HttpError(404, 'الطاولة غير موجودة.');
  if (body?.zoneId && d.zones.some((z) => z.id === body.zoneId)) t.zoneId = body.zoneId;
  if (body?.seats != null) t.seats = Math.round(num(body.seats, { min: 1, max: 30 }));
  save();
  return t;
}, { admin: true });

route('GET', '/admin/stats', ({ q }) => stats(str(q.get('range'), 8) || 'today'), { admin: true });
route('GET', '/admin/months', () => months(), { admin: true });

// نسخة احتياطية: كل البيانات بملف، وبترجع مكانها لما بدك (جهاز جديد أو انمسح المتصفح)
route('GET', '/admin/backup', () => ({ app: 'cafe-mohammad', version: 1, exportedAt: new Date().toISOString(), data: db() }), { admin: true });
route('POST', '/admin/restore', ({ body }) => {
  const data = body?.data;
  const ok = data && typeof data === 'object' && !Array.isArray(data)
    && ['items', 'categories', 'orders', 'tables', 'zones', 'offers'].every((k) => Array.isArray(data[k]))
    && data.settings && typeof data.settings === 'object';
  if (!ok) throw new HttpError(400, 'هاد الملف مش نسخة احتياطية من نظام الطلبات.');
  replaceAll(JSON.parse(JSON.stringify(data)));
  return { data: { ok: true, orders: data.orders.length }, events: [toAll('menu:changed'), toAdmin('day:closed', {})] };
}, { admin: true });
route('GET', '/admin/months/:key', ({ p }) => monthReport(p.key), { admin: true });
route('GET', '/admin/table-insight/:n', ({ p }) => tableInsight(p.n), { admin: true });
route('PUT', '/admin/settings', ({ body: b = {} }) => {
  const s = db().settings;
  if (b.cafeName != null) s.cafeName = str(b.cafeName, 40) || s.cafeName;
  if (b.brandWord != null) s.brandWord = str(b.brandWord, 12) || s.brandWord;
  if (b.tagline != null) s.tagline = str(b.tagline, 80);
  if (b.currency != null) s.currency = str(b.currency, 4) || s.currency;
  if (b.currencyName != null) s.currencyName = str(b.currencyName, 16);
  if (b.baristaName != null) s.baristaName = str(b.baristaName, 20) || s.baristaName;
  if (b.wifi != null) s.wifi = str(b.wifi, 100);
  if (b.hours != null) s.hours = str(b.hours, 100);
  if (b.cafeNotes != null) s.cafeNotes = str(b.cafeNotes, 600);
  if (b.city != null) s.city = str(b.city, 40);
  if (b.lat != null && b.lat !== '') s.lat = num(b.lat, { min: -90, max: 90 });
  if (b.lon != null && b.lon !== '') s.lon = num(b.lon, { min: -180, max: 180 });
  if (b.adminPin != null && b.adminPin !== '') {
    const pin = str(b.adminPin, 12);
    if (!/^\d{4,8}$/.test(pin)) throw new HttpError(400, 'الرمز لازم يكون من 4 إلى 8 أرقام.');
    s.adminPin = pin;
  }
  save();
  return { data: s, events: [toAll('menu:changed')] };
}, { admin: true });
route('GET', '/admin/geocode', async ({ q }) => {
  const query = str(q.get('q'), 60);
  return query ? geocode(query) : [];
}, { admin: true });
route('POST', '/admin/demo/clear', () => {
  const d = db();
  const before = d.orders.length;
  d.orders = d.orders.filter((o) => !o.demo);
  save();
  return { removed: before - d.orders.length };
}, { admin: true });
route('POST', '/admin/upload', async ({ body, hooks }) => {
  const m = String(body?.dataUrl ?? '').match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!m) throw new HttpError(400, 'الصيغة المدعومة: PNG أو JPG أو WEBP.');
  if (m[2].length * 0.75 > 2.5 * 1024 * 1024) throw new HttpError(413, 'الصورة كبيرة، الحد 2.5 ميغا.');
  const url = await hooks.saveUpload(m[1], m[2], body.dataUrl);
  return { status: 201, data: { url } };
}, { admin: true });

/**
 * ينفّذ طلب API ويرجع { status, data, events }
 * path بدون /api في أوله، وممكن يحتوي query string
 */
export async function handle(method, fullPath, body, { token = null, hooks = {} } = {}) {
  const [path, query = ''] = String(fullPath).split('?');
  const q = new URLSearchParams(query);
  for (const r of routes) {
    if (r.method !== method) continue;
    const m = path.match(r.re);
    if (!m) continue;
    const p = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
    try {
      if (r.admin && !validToken(token)) throw new HttpError(401, 'انتهت الجلسة، سجّل الدخول من جديد.');
      const out = await r.fn({ p, q, body, token, hooks });
      const wrapped = out && typeof out === 'object' && 'data' in out && ('events' in out || 'status' in out);
      return wrapped
        ? { status: out.status ?? 200, data: out.data, events: out.events ?? [] }
        : { status: 200, data: out, events: [] };
    } catch (err) {
      if (err instanceof HttpError) return { status: err.status, data: { error: err.message }, events: [] };
      console.error(err);
      return { status: 500, data: { error: 'صار خطأ بالسيرفر، جرب كمان مرة.' }, events: [] };
    }
  }
  return { status: 404, data: { error: 'المسار غير موجود.' }, events: [] };
}
