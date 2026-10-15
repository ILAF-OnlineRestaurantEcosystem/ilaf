// يجمع كل ما يحتاجه الباريستا ليقترح بذكاء: القائمة بأسعارها الفعلية، الطقس، الطاولة، الأكثر طلباً، والسلة
import { db } from '../db.js';
import { effectivePrice, comboValue, topItems, tableInsight, inStock, tracked, LOW_STOCK } from '../logic.js';
import { currentWeather } from '../weather.js';

const toWestern = (s) => String(s).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
export const normalizeDigits = toWestern;

export function dayPart(h) {
  if (h < 5) return 'آخر الليل';
  if (h < 12) return 'الصبح';
  if (h < 15) return 'الظهر';
  if (h < 18) return 'العصر';
  return 'المسا';
}

/** يلتقط رقم الطاولة من رسالة الزبون: "طاولة 33" أو رقم لحاله ردّاً على سؤال "طاولتك رقم كم؟" */
export function detectTable(text, lastBotText = '') {
  const t = toWestern(text).trim();
  const m = t.match(/(?:طاول[ةه]|طاولتي|طاولتنا|table|ترابيز[ةه])\s*(?:رقم|نمرة|#)?\s*(\d{1,3})/i);
  if (m) return Number(m[1]);
  const askedForTable = /طاولت?ك|رقم الطاولة|طاولة رقم/.test(lastBotText);
  const bare = t.match(/^(?:رقم|نمرة)?\s*(\d{1,3})\s*$/);
  if (bare && askedForTable) return Number(bare[1]);
  return null;
}

export async function buildContext({ table, cart = [] }) {
  const d = db();
  const now = new Date();
  // نديم بيراجع المخزن: المتوفر بس بيقترحه، واللي نفد بيعرف إنه موجود بالقائمة بس مش متوفر هلأ
  const items = d.items.filter((i) => inStock(i)).map((i) => {
    const p = effectivePrice(i);
    const cat = d.categories.find((c) => c.id === i.categoryId);
    return {
      id: i.id, name: i.name, desc: i.desc, recipe: i.recipe ?? '', category: cat?.name ?? '', temp: cat?.temp ?? null,
      price: p.price, was: p.was, sugar: i.sugar ?? 1, caffeine: i.caffeine ?? 0,
      tags: i.tags ?? [], sugarChoice: !!i.sugarChoice, categoryId: i.categoryId,
      left: tracked(i) && Number(i.stock) <= LOW_STOCK ? Number(i.stock) : null,
    };
  });
  const outOfStock = d.items.filter((i) => !inStock(i)).map((i) => ({
    id: i.id, name: i.name, categoryId: i.categoryId, category: d.categories.find((c) => c.id === i.categoryId)?.name ?? '',
    tags: i.tags ?? [], caffeine: i.caffeine ?? 0,
  }));
  const offers = d.offers.filter((o) => o.active && o.itemIds.every((id) => inStock(d.items.find((i) => i.id === id)))).map((o) => ({
    id: o.id, type: o.type, title: o.title, description: o.description, price: o.price, percent: o.percent,
    value: o.type === 'combo' ? comboValue(o) : null,
    names: o.itemIds.map((id) => d.items.find((i) => i.id === id)?.name),
  }));
  const validTable = d.tables.some((t) => t.number === Number(table)) ? Number(table) : null;
  const cartLines = (Array.isArray(cart) ? cart : []).slice(0, 30).map((l) => {
    if (l?.kind === 'offer') {
      const o = d.offers.find((x) => x.id === l.id);
      return o ? { name: `عرض ${o.title}`, qty: Number(l.qty) || 1 } : null;
    }
    const it = d.items.find((x) => x.id === l?.id);
    return it ? { name: it.name, qty: Number(l.qty) || 1 } : null;
  }).filter(Boolean);

  return {
    settings: d.settings,
    outOfStock,
    tableCount: d.tables.length,
    time: { hour: now.getHours(), dayPart: dayPart(now.getHours()), weekday: now.toLocaleDateString('ar', { weekday: 'long' }) },
    weather: await currentWeather(),
    table: validTable ? tableInsight(validTable) : null,
    requestedTable: table != null && !validTable ? table : null,
    popular: topItems({ days: 14, limit: 6 }),
    items,
    offers,
    cart: cartLines,
  };
}
