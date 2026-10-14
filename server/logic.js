// منطق المحل: التسعير مع العروض، إنشاء الطلبات، والإحصائيات اللي يعتمد عليها الكاشير والباريستا
import { db, save, uid } from './db.js';
import { summarize } from './reports.js';

export const STATUSES = ['new', 'preparing', 'ready', 'served', 'paid', 'cancelled'];
export const OPEN_STATUSES = ['new', 'preparing', 'ready', 'served'];
export const STATUS_LABELS = {
  new: 'طلب جديد', preparing: 'قيد التحضير', ready: 'جاهز', served: 'تم التقديم', paid: 'مدفوع', cancelled: 'ملغي',
};
export const SUGAR_LABELS = { none: 'بدون سكر', light: 'سكر خفيف', medium: 'سكر وسط', extra: 'سكر زيادة' };

const round = (n) => Math.round(n * 100) / 100;

/** السعر الفعلي للصنف بعد عروض الخصم الفعّالة */
export function effectivePrice(item) {
  const offer = db().offers.find((o) => o.active && o.type === 'discount' && o.itemIds.includes(item.id));
  if (!offer) return { price: item.price, was: null, offerId: null };
  return { price: round(item.price * (1 - offer.percent / 100)), was: item.price, offerId: offer.id };
}

export function comboValue(offer) {
  const items = db().items;
  return round(offer.itemIds.reduce((s, id) => s + (items.find((i) => i.id === id)?.price ?? 0), 0));
}

export function publicSettings() {
  const { adminPin, ...rest } = db().settings;
  return rest;
}

export function zoneOf(tableNumber) {
  const t = db().tables.find((x) => x.number === Number(tableNumber));
  if (!t) return null;
  return db().zones.find((z) => z.id === t.zoneId) ?? null;
}

export function publicMenu() {
  const d = db();
  const items = d.items.map((it) => {
    const p = effectivePrice(it);
    return { ...it, price: p.price, was: p.was, offerId: p.offerId };
  });
  const offers = d.offers.filter((o) => o.active).map((o) => ({
    ...o,
    value: o.type === 'combo' ? comboValue(o) : null,
    names: o.itemIds.map((id) => d.items.find((i) => i.id === id)?.name).filter(Boolean),
    available: o.itemIds.every((id) => d.items.find((i) => i.id === id)?.available),
  }));
  return {
    settings: publicSettings(),
    categories: [...d.categories].sort((a, b) => a.order - b.order),
    items,
    offers,
    popular: topItems({ days: 14, limit: 6 }).map((x) => x.id),
    tableCount: d.tables.length,
  };
}

/** يحوّل سطور السلة القادمة من الزبون إلى سطور طلب مسعّرة من السيرفر (لا نثق بأسعار المتصفح) */
export function priceLines(rawLines) {
  const d = db();
  if (!Array.isArray(rawLines) || rawLines.length === 0) throw new HttpError(400, 'السلة فاضية.');
  if (rawLines.length > 40) throw new HttpError(400, 'عدد الأصناف كبير جداً.');
  const lines = [];
  let subtotal = 0;
  let discount = 0;
  for (const raw of rawLines) {
    const qty = Math.min(20, Math.max(1, Math.floor(Number(raw?.qty) || 1)));
    const note = String(raw?.note ?? '').slice(0, 120).trim();
    if (raw?.kind === 'offer') {
      const offer = d.offers.find((o) => o.id === raw.id && o.active && o.type === 'combo');
      if (!offer) throw new HttpError(400, 'هذا العرض لم يعد متوفراً.');
      const parts = offer.itemIds.map((id) => d.items.find((i) => i.id === id));
      if (parts.some((p) => !p || !p.available)) throw new HttpError(409, `أحد أصناف عرض "${offer.title}" نفد حالياً.`);
      const value = comboValue(offer);
      lines.push({
        kind: 'offer', refId: offer.id, name: `عرض ${offer.title}`, unitPrice: offer.price, qty,
        lineTotal: round(offer.price * qty), options: {}, note, parts: parts.map((p) => p.name),
        unitCost: round(parts.reduce((sum, p) => sum + (Number(p.cost) || 0), 0)),
      });
      subtotal += value * qty;
      discount += (value - offer.price) * qty;
    } else {
      const item = d.items.find((i) => i.id === raw?.id);
      if (!item) throw new HttpError(400, 'صنف غير معروف في السلة.');
      if (!item.available) throw new HttpError(409, `"${item.name}" نفد حالياً، احذفه من السلة وكمّل.`);
      const p = effectivePrice(item);
      const sugar = item.sugarChoice && SUGAR_LABELS[raw?.options?.sugar] ? raw.options.sugar : undefined;
      lines.push({
        kind: 'item', refId: item.id, name: item.name, unitPrice: p.price, qty,
        lineTotal: round(p.price * qty), options: sugar ? { sugar } : {}, note,
        unitCost: round(Number(item.cost) || 0),
      });
      subtotal += item.price * qty;
      discount += (item.price - p.price) * qty;
    }
  }
  const total = round(lines.reduce((s, l) => s + l.lineTotal, 0));
  const cost = round(lines.reduce((s, l) => s + l.unitCost * l.qty, 0));
  return { lines, subtotal: round(subtotal), discount: round(discount), total, cost };
}

/** بداية يوم العمل الحالي (من آخر "إغلاق المحل") */
export function dayStart() {
  return new Date(db().settings.dayOpenedAt ?? new Date(new Date().setHours(0, 0, 0, 0)));
}

export function createOrder({ table, lines, note, source }) {
  const d = db();
  const tableNo = Number(table);
  const t = d.tables.find((x) => x.number === tableNo);
  if (!t) throw new HttpError(400, `ما في طاولة رقم ${table} عنا. تأكد من الرقم المكتوب على الطاولة.`);
  const priced = priceLines(lines);
  const now = new Date();
  const iso = now.toISOString();
  const from = dayStart();
  const todays = d.orders.filter((o) => new Date(o.createdAt) >= from);
  // أول طلب على طاولة فاضية بيفتح "جلسة" = فاتورة الطاولة، وكل الطلبات بعده بتنضاف عليها لحد الدفع
  if (!t.sessionId) { t.sessionId = uid('s'); t.sessionAt = iso; }
  const order = {
    id: uid('o'),
    no: todays.reduce((m, o) => Math.max(m, o.no), 0) + 1,
    table: tableNo,
    sessionId: t.sessionId,
    zoneName: zoneOf(tableNo)?.name ?? '',
    ...priced,
    note: String(note ?? '').slice(0, 200).trim(),
    status: 'new',
    source: source === 'barista' ? 'barista' : 'menu',
    createdAt: iso,
    updatedAt: iso,
    history: [{ status: 'new', at: iso }],
  };
  d.orders.push(order);
  save();
  return order;
}

export function setOrderStatus(id, status) {
  if (!STATUSES.includes(status)) throw new HttpError(400, 'حالة غير معروفة.');
  const order = db().orders.find((o) => o.id === id);
  if (!order) throw new HttpError(404, 'الطلب غير موجود.');
  if (order.status === status) return order;
  order.status = status;
  order.updatedAt = new Date().toISOString();
  (order.history ??= []).push({ status, at: order.updatedAt });
  save();
  return order;
}

export function publicOrder(o) {
  return {
    id: o.id, no: o.no, table: o.table, sessionId: o.sessionId ?? null,
    lines: o.lines.map(({ unitCost, ...l }) => l), // التكلفة سر المحل، ما بتطلع للزبون
    total: o.total, discount: o.discount, manualDiscount: o.manualDiscount ?? 0,
    status: o.status, statusLabel: STATUS_LABELS[o.status], createdAt: o.createdAt, history: o.history,
  };
}

/** خصم على صنف داخل فاتورة وحدة بس: الكاشير بيحط السعر الجديد للقطعة */
export function setLinePrice(orderId, index, price) {
  const order = db().orders.find((o) => o.id === orderId);
  if (!order) throw new HttpError(404, 'الطلب غير موجود.');
  if (!OPEN_STATUSES.includes(order.status)) throw new HttpError(409, 'ما بنقدر نعدّل فاتورة مدفوعة أو ملغية.');
  const line = order.lines[Number(index)];
  if (!line) throw new HttpError(404, 'الصنف غير موجود بالفاتورة.');
  const orig = line.origUnitPrice ?? line.unitPrice;
  const p = round(Number(price));
  if (String(price).trim() === '' || !Number.isFinite(p) || p < 0) throw new HttpError(400, 'اكتب سعر صحيح.');
  if (p > orig) throw new HttpError(400, `الخصم بس بينزّل السعر، السعر الأصلي ${orig}.`);
  if (p === orig) delete line.origUnitPrice; else line.origUnitPrice = orig;
  line.unitPrice = p;
  line.lineTotal = round(p * line.qty);
  order.total = round(order.lines.reduce((s, l) => s + l.lineTotal, 0));
  order.manualDiscount = round(order.lines.reduce((s, l) => s + ((l.origUnitPrice ?? l.unitPrice) - l.unitPrice) * l.qty, 0));
  order.updatedAt = new Date().toISOString();
  save();
  return order;
}

/** تسكير الطاولة بعد الدفع: كل طلباتها المفتوحة بتصير مدفوعة والجلسة بتنتهي */
export function closeTable(n) {
  const d = db();
  const t = d.tables.find((x) => x.number === Number(n));
  const open = d.orders.filter((o) => o.table === Number(n) && OPEN_STATUSES.includes(o.status));
  for (const o of open) setOrderStatus(o.id, 'paid');
  if (t) { t.sessionId = null; t.sessionAt = null; }
  const hadCalls = d.calls.some((c) => c.table === Number(n));
  d.calls = d.calls.filter((c) => c.table !== Number(n));
  save();
  return { closed: open, hadCalls };
}

/** فاتورة الطاولة الحالية للزبون (كل طلبات الجلسة المفتوحة) */
export function tableBill(n) {
  const d = db();
  const t = d.tables.find((x) => x.number === Number(n));
  if (!t) throw new HttpError(404, `ما في طاولة رقم ${n}.`);
  if (!t.sessionId) return { table: t.number, open: false, sessionId: null, orders: [], subtotal: 0, discount: 0, total: 0 };
  const orders = d.orders.filter((o) => o.sessionId === t.sessionId && o.status !== 'cancelled')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const total = round(orders.reduce((s, o) => s + o.total, 0));
  const discount = round(orders.reduce((s, o) => s + (o.discount ?? 0) + (o.manualDiscount ?? 0), 0));
  return {
    table: t.number, open: true, sessionId: t.sessionId, openedAt: t.sessionAt,
    orders: orders.map(publicOrder), subtotal: round(total + discount), discount, total,
  };
}

/** ملخص يوم العمل الحالي (من آخر إغلاق لهلأ) */
export function currentDay() {
  const d = db();
  const from = dayStart();
  const orders = d.orders.filter((o) => new Date(o.createdAt) >= from);
  const openTables = [...new Set(d.orders.filter((o) => OPEN_STATUSES.includes(o.status)).map((o) => o.table))].sort((a, b) => a - b);
  return { openedAt: from.toISOString(), openTables, ...summarize(orders, d) };
}

/** إغلاق المحل: بنحفظ تقرير اليوم وبنصفّر العدادات. force بيسكّر الطاولات المفتوحة كمدفوعة */
export function closeDay({ force = false } = {}) {
  const d = db();
  const day = currentDay();
  const closedOrders = [];
  if (day.openTables.length) {
    if (!force) throw new HttpError(409, `في طاولات لسا مفتوحة: ${day.openTables.join('، ')}. سكّرها أو اختار "سكّرها كلها واغلق".`);
    for (const n of day.openTables) closedOrders.push(...closeTable(n).closed);
  }
  const now = new Date().toISOString();
  const { openTables, ...final } = currentDay();
  const record = { id: uid('day'), closedAt: now, ...final };
  d.days.unshift(record);
  d.days = d.days.slice(0, 62); // تفاصيل الأيام الأقدم محفوظة جوّا أرشيف الشهر
  d.settings.dayOpenedAt = now;
  save();
  maintain({ force: true });
  return { record, closedOrders };
}

function ordersSince(days) {
  const from = Date.now() - days * 86400000;
  return db().orders.filter((o) => o.status !== 'cancelled' && new Date(o.createdAt).getTime() >= from);
}

/** أكثر الأصناف طلباً — العروض تُفكّ لأصنافها كي تُحسب بعدلها */
export function topItems({ days = 30, limit = 10, table = null, zoneId = null } = {}) {
  const d = db();
  const offers = Object.fromEntries(d.offers.map((o) => [o.id, o]));
  const counts = {};
  for (const o of ordersSince(days)) {
    if (table != null && o.table !== Number(table)) continue;
    if (zoneId && d.tables.find((t) => t.number === o.table)?.zoneId !== zoneId) continue;
    for (const l of o.lines) {
      const ids = l.kind === 'offer' ? (offers[l.refId]?.itemIds ?? []) : [l.refId];
      for (const id of ids) counts[id] = (counts[id] ?? 0) + l.qty;
    }
  }
  return Object.entries(counts)
    .map(([id, qty]) => ({ id, qty, name: d.items.find((i) => i.id === id)?.name }))
    .filter((x) => x.name && d.items.find((i) => i.id === x.id)?.available !== false)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, limit);
}

/** نبذة عن طاولة: منطقتها، وأكثر ما يُطلب عليها وفي منطقتها */
export function tableInsight(tableNumber) {
  const d = db();
  const t = d.tables.find((x) => x.number === Number(tableNumber));
  if (!t) return null;
  const zone = d.zones.find((z) => z.id === t.zoneId);
  const atTable = topItems({ days: 30, limit: 4, table: t.number });
  const inZone = topItems({ days: 30, limit: 4, zoneId: t.zoneId });
  const orderCount = ordersSince(30).filter((o) => o.table === t.number).length;
  return {
    number: t.number,
    seats: t.seats,
    zone: zone ? { id: zone.id, name: zone.name, description: zone.description } : null,
    orderCount,
    topAtTable: atTable,
    topInZone: inZone,
  };
}

/** تحليل مجموعة طلبات: الأرقام، الأصناف بأرباحها، الساعات، الأقسام، والطاولات */
function analyze(orders) {
  const d = db();
  const money = summarize(orders, d);
  const byHour = Array.from({ length: 24 }, () => 0);
  const byCategory = {};
  const byTable = {};
  const offers = Object.fromEntries(d.offers.map((o) => [o.id, o]));
  const itemQty = {};
  for (const o of orders) {
    byHour[new Date(o.createdAt).getHours()] += 1;
    byTable[o.table] ??= { table: o.table, orders: 0, revenue: 0, items: {} };
    byTable[o.table].orders++;
    byTable[o.table].revenue += o.total;
    for (const l of o.lines) {
      const ids = l.kind === 'offer' ? (offers[l.refId]?.itemIds ?? []) : [l.refId];
      for (const id of ids) {
        itemQty[id] = (itemQty[id] ?? 0) + l.qty;
        byTable[o.table].items[id] = (byTable[o.table].items[id] ?? 0) + l.qty;
        const cat = d.items.find((i) => i.id === id)?.categoryId;
        if (cat) byCategory[cat] = (byCategory[cat] ?? 0) + l.qty;
      }
    }
  }
  const name = (id) => d.items.find((i) => i.id === id)?.name ?? id;
  const top = Object.entries(itemQty).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id, qty]) => ({ id, name: name(id), qty }));
  const tables = Object.values(byTable)
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 8)
    .map((t) => {
      const fav = Object.entries(t.items).sort((a, b) => b[1] - a[1])[0];
      return { table: t.table, orders: t.orders, revenue: round(t.revenue), favorite: fav ? name(fav[0]) : '—', zone: zoneOf(t.table)?.name ?? '' };
    });
  const categories = d.categories.map((c) => ({ id: c.id, name: c.name, qty: byCategory[c.id] ?? 0 }));
  const baristaShare = orders.length ? Math.round((orders.filter((o) => o.source === 'barista').length / orders.length) * 100) : 0;
  return {
    orders: money.orders, revenue: money.revenue, itemsSold: money.itemsSold, avgTicket: money.avgTicket,
    cost: money.cost, profit: money.profit, discounts: money.discounts, items: money.items,
    baristaShare, byHour, top, tables, categories,
  };
}

export function stats(range = 'today') {
  const now = new Date();
  let from;
  if (range === '7d') from = new Date(now.getTime() - 7 * 86400000);
  else if (range === '30d') from = new Date(now.getTime() - 30 * 86400000);
  else from = dayStart();
  const orders = db().orders.filter((o) => o.status !== 'cancelled' && new Date(o.createdAt) >= from);
  return { range, from: from.toISOString(), ...analyze(orders) };
}

// ───────── التقارير الشهرية ─────────
const pad = (n) => String(n).padStart(2, '0');
/** مفتاح الشهر بالتوقيت المحلي: 2026-10 */
export const monthKey = (date) => { const x = new Date(date); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}`; };
const dateKey = (date) => { const x = new Date(date); return `${monthKey(x)}-${pad(x.getDate())}`; };
const monthOrders = (key) => db().orders.filter((o) => o.status !== 'cancelled' && monthKey(o.createdAt) === key);
const prevMonthKey = (key) => { const [y, m] = key.split('-').map(Number); return monthKey(new Date(y, m - 2, 1)); };

// الأرشيف الشهري: لما يخلص الشهر بنحفظ تقريره كامل بملخص صغير بيضل للأبد،
// وطلبات الشهور الأقدم من الشهر الماضي بتنحذف (عشان ذاكرة المتصفح بنسخة الموقع ما تمتلي).
// prunedBefore: الشهور قبله ما ضل إلها طلبات كاملة، فتقريرها من الأرشيف بس.
const isArchived = (key) => { const d = db(); return Boolean(d.monthly?.[key]) && Boolean(d.prunedBefore) && key < d.prunedBefore; };

function liveMonth(key) {
  const d = db();
  const orders = monthOrders(key);
  const groups = {};
  for (const o of orders) (groups[dateKey(o.createdAt)] ??= []).push(o);
  const days = Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0])).map(([date, list]) => {
    const m = summarize(list, d);
    return { date, orders: m.orders, revenue: m.revenue, cost: m.cost, profit: m.profit };
  });
  const [y, m] = key.split('-').map(Number);
  return {
    key,
    from: new Date(y, m - 1, 1).toISOString(),
    to: new Date(y, m, 0, 23, 59, 59).toISOString(),
    ...analyze(orders),
    days,
    bestDay: days.reduce((a, b) => (!a || b.revenue > a.revenue ? b : a), null),
    activeDays: days.length,
  };
}

/** ملخص شهر (من الطلبات أو من الأرشيف). upToDay: بس أول كم يوم منه (للمقارنة بشهر لسا ما خلص) */
function monthSummary(key, upToDay = null) {
  const d = db();
  if (isArchived(key)) {
    const days = d.monthly[key].days.filter((x) => !upToDay || Number(x.date.slice(8)) <= upToDay);
    const sum = (f) => round(days.reduce((s, x) => s + x[f], 0));
    return { orders: sum('orders'), revenue: sum('revenue'), cost: sum('cost'), profit: sum('profit') };
  }
  const orders = monthOrders(key).filter((o) => !upToDay || new Date(o.createdAt).getDate() <= upToDay);
  return summarize(orders, d);
}

/** صيانة مرة باليوم (وبعد إغلاق المحل): أرشفة الشهور اللي خلصت، حذف طلباتها القديمة، وتخفيف الطلبات المسكّرة */
export function maintain({ force = false } = {}) {
  const d = db();
  const today = new Date().toDateString();
  if (!force && d.maintainedAt === today) return;
  d.monthly ??= {};
  const nowKey = monthKey(new Date());
  const keepFrom = prevMonthKey(nowKey); // الشهر الحالي واللي قبله بنضل محتفظين بطلباتهم كاملة
  for (const key of new Set(d.orders.map((o) => monthKey(o.createdAt)))) {
    if (key < nowKey && !isArchived(key)) {
      const { prev, cafeName, generatedAt, ...rep } = liveMonth(key);
      d.monthly[key] = { ...rep, archivedAt: new Date().toISOString() };
    }
  }
  const before = d.orders.length;
  d.orders = d.orders.filter((o) => monthKey(o.createdAt) >= keepFrom || OPEN_STATUSES.includes(o.status));
  if (d.orders.length < before || Object.keys(d.monthly).some((k) => k < keepFrom)) {
    if (!d.prunedBefore || d.prunedBefore < keepFrom) d.prunedBefore = keepFrom;
  }
  // الطلبات المسكّرة من أكثر من 3 أيام ما بنحتاج تسلسل حالاتها (بيوفّر حوالي ثلث المساحة)
  const cutoff = Date.now() - 3 * 86400000;
  for (const o of d.orders) {
    if (o.history && !OPEN_STATUSES.includes(o.status) && new Date(o.createdAt).getTime() < cutoff) delete o.history;
  }
  d.days = d.days.slice(0, 62);
  d.maintainedAt = today;
  save();
}

/** كل الشهور اللي فيها مبيعات (من الطلبات أو الأرشيف)، الأحدث أولاً، مع ملخص كل شهر */
export function months() {
  maintain();
  const d = db();
  const keys = new Set([monthKey(new Date()), ...Object.keys(d.monthly ?? {})]);
  for (const o of d.orders) if (o.status !== 'cancelled') keys.add(monthKey(o.createdAt));
  return [...keys].sort().reverse().map((key) => {
    const m = isArchived(key) ? d.monthly[key] : summarize(monthOrders(key), d);
    return { key, orders: m.orders, revenue: m.revenue, cost: m.cost, profit: m.profit, discounts: m.discounts ?? 0, itemsSold: m.itemsSold ?? 0, archived: isArchived(key) };
  });
}

/** تقرير شهر كامل: الأرقام، المقارنة بالشهر اللي قبله، كل يوم لحاله، والأصناف بأرباحها */
export function monthReport(key) {
  if (!/^\d{4}-\d{2}$/.test(String(key))) throw new HttpError(400, 'الشهر لازم يكون بصيغة 2026-10.');
  const d = db();
  const now = new Date();
  // الشهر الحالي لسا ما خلص: بنقارنه بنفس الأيام من الشهر اللي قبله، مش بالشهر كامل
  const partial = key === monthKey(now);
  const base = isArchived(key) ? d.monthly[key] : liveMonth(key);
  const prev = monthSummary(prevMonthKey(key), partial ? now.getDate() : null);
  return {
    ...base,
    archived: isArchived(key),
    prev: { key: prevMonthKey(key), orders: prev.orders, revenue: prev.revenue, profit: prev.profit, partial },
    cafeName: d.settings.cafeName,
    generatedAt: now.toISOString(),
  };
}

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
