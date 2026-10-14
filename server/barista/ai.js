// اختيار مزوّد الذكاء لنديم: Claude إذا في مفتاحه، وإلا Gemini (مجاني بحدود)، وإلا الوضع الأساسي
import { askClaude, aiConfigured as claudeConfigured, aiStatus as claudeStatus } from './claude.js';
import { askGemini, geminiConfigured, geminiStatus } from './gemini.js';

export function aiConfigured() {
  return claudeConfigured() || geminiConfigured();
}

export function aiStatus() {
  const c = claudeStatus();
  if (c.configured) return { ...c, provider: 'Claude' };
  const g = geminiStatus();
  // بنسخة الـ HTML مفتاح Gemini بيضل بمتصفح الكاشير (standalone بتخلّي اللوحة تعرض خانة المفتاح)
  if (g.configured) return { ...g, provider: 'Gemini', standalone: c.standalone };
  if (c.standalone) return c;
  return { configured: false, provider: null, model: '', paused: false, lastError: null };
}

/** بيجرب المزوّد المتاح؛ إذا فشل الأول وفي ثاني بيجربه، وإذا فشلوا بيرمي الخطأ (فبيشتغل الوضع الأساسي) */
export async function askAI(ctx, history, greeting) {
  const providers = [];
  if (claudeConfigured()) providers.push(askClaude);
  if (geminiConfigured()) providers.push(askGemini);
  if (!providers.length) throw new Error('no-key');
  let lastErr;
  for (const ask of providers) {
    try { return await ask(ctx, history, greeting); } catch (err) { lastErr = err; }
  }
  throw lastErr;
}
