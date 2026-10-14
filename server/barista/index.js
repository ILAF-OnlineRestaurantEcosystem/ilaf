// نقطة دخول الباريستا: يجرب Claude أولاً، وإذا ما في مفتاح أو صار خطأ ينتقل للوضع الأساسي
import { buildContext, detectTable } from './context.js';
import { askAI, aiConfigured } from './ai.js';
import { basicBarista, detectBudget } from './fallback.js';

export async function chat({ history = [], table = null, cart = [], greeting = '' }) {
  const clean = (Array.isArray(history) ? history : []).slice(-20).map((m) => ({
    role: m?.role === 'assistant' ? 'assistant' : 'user',
    text: String(m?.text ?? '').slice(0, 1200),
    suggestionNames: Array.isArray(m?.suggestionNames) ? m.suggestionNames.map(String) : undefined,
  }));
  const lastUser = [...clean].reverse().find((m) => m.role === 'user');
  if (!lastUser?.text.trim()) return { reply: 'اكتبلي شو حابب 🙂', suggestions: [], mode: 'basic', table };

  const lastBot = [...clean].reverse().find((m) => m.role === 'assistant')?.text ?? greeting;
  const mentioned = detectTable(lastUser.text, lastBot);
  const activeTable = mentioned ?? (table ? Number(table) : null);
  const ctx = await buildContext({ table: activeTable, cart });
  const freshTable = mentioned != null && ctx.table != null;

  let result;
  let mode = 'basic';
  if (aiConfigured()) {
    try {
      result = await askAI(ctx, clean, greeting);
      mode = 'ai';
    } catch (err) {
      if (!['no-key', 'paused'].includes(err.message)) console.warn('⚠️  الباريستا الذكي تعثر، تحويل للوضع الأساسي:', err.message);
    }
  }
  if (!result) result = basicBarista(ctx, clean, freshTable);

  // تحقق نهائي: أصناف موجودة ومتوفرة فقط وكميات معقولة
  const itemIds = new Set(ctx.items.map((i) => i.id));
  const offerIds = new Set(ctx.offers.filter((o) => o.type === 'combo').map((o) => o.id));
  const suggestions = (result.suggestions ?? []).map((s) => {
    const id = String(s.item_id ?? '');
    const qty = Math.min(12, Math.max(1, Math.floor(Number(s.qty) || 1)));
    if (id.startsWith('offer:') && offerIds.has(id.slice(6))) return { kind: 'offer', id: id.slice(6), qty, sugar: '', forWhom: s.for_whom ?? '' };
    if (itemIds.has(id)) return { kind: 'item', id, qty, sugar: s.sugar ?? '', forWhom: s.for_whom ?? '' };
    return null;
  }).filter(Boolean).slice(0, 10);

  // حارس الميزانية: الموديل ممكن يغلط بالجمع، فبنحسب نحنا وبنشيل الزيادة إذا طلع فوق المبلغ
  let reply = result.reply || 'تمام! شو كمان بتحب؟';
  const budget = mode === 'ai' ? detectBudget(lastUser.text) : null;
  if (budget && suggestions.length) {
    const unit = (s) => (s.kind === 'offer' ? ctx.offers.find((o) => o.id === s.id)?.price : ctx.items.find((i) => i.id === s.id)?.price) ?? 0;
    const isDrink = (s) => s.kind === 'item' && ['hot', 'cold', 'juice'].includes(ctx.items.find((i) => i.id === s.id)?.categoryId);
    const total = () => suggestions.reduce((sum, s) => sum + unit(s) * s.qty, 0);
    if (total() > budget) {
      // أول اشي بنشيل الإضافات (حلو ومعجنات)، وبعدها الأغلى
      while (total() > budget && suggestions.length) {
        const extras = suggestions.filter((s) => !isDrink(s));
        const pool = extras.length ? extras : suggestions;
        const drop = pool.reduce((a, b) => (unit(b) * b.qty > unit(a) * a.qty ? b : a));
        if (drop.qty > 1 && isDrink(drop)) drop.qty--; else suggestions.splice(suggestions.indexOf(drop), 1);
      }
      const t = Math.round(total() * 100) / 100;
      reply += `
(ظبطتلك الحساب: المجموع الصحيح ${t}${ctx.settings.currency}، وبيضل معك ${Math.round((budget - t) * 100) / 100}${ctx.settings.currency})`;
    }
  }

  return {
    reply,
    suggestions,
    mode,
    offerWaiter: Boolean(result.offerWaiter),
    table: ctx.table ? ctx.table.number : null,
    tableZone: ctx.table?.zone?.name ?? null,
  };
}
