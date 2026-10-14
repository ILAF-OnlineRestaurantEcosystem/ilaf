// نديم عبر Google Gemini (فيه مستوى مجاني): نفس التعليمات والسياق، ورد JSON مقيّد بأصناف القائمة.
// المفتاح بيضل على السيرفر بس (GEMINI_API_KEY بملف .env)، وما بيوصل للمتصفح أبداً.
import { stablePrompt, volatileContext, toApiMessages } from './prompt.js';

const API = 'https://generativelanguage.googleapis.com/v1beta';
let model = process.env.GEMINI_MODEL || null; // آخر موديل نجح
let candidates = null;                          // موديلات flash المتاحة، الأحدث أولاً
const busyUntil = new Map();                    // موديل مزدحم ← نتجاوزه لوقت
const unavailable = new Set();                  // موديلات مسكّرة على هالمفتاح (404)
// التفكير القليل بيخلّي الرد بثانية بدل 10+ ثواني (GEMINI_THINKING: minimal | low | medium | high)
const THINKING = process.env.GEMINI_THINKING || 'minimal';
const noThinkingCfg = new Set();                // موديلات ما بتقبل إعداد التفكير
let disabledUntil = 0;
let lastError = null;

export function geminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function geminiStatus() {
  return { configured: geminiConfigured(), model: model || 'تلقائي (flash)', paused: Date.now() < disabledUntil, lastError };
}

/** بعد تغيير المفتاح (من لوحة نسخة العرض): ننسى الأخطاء والموديلات القديمة */
export function geminiReset() {
  disabledUntil = 0;
  lastError = null;
  candidates = null;
  model = process.env.GEMINI_MODEL || null;
  busyUntil.clear();
  unavailable.clear();
}

const headers = () => ({ 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY });

/** موديلات flash المتاحة للمفتاح بالترتيب: اللي نجح آخر مرة، وبعدين الأحدث فالأقدم */
async function modelOrder() {
  if (!candidates) {
    candidates = [];
    try {
      const res = await fetch(`${API}/models?pageSize=200`, { headers: headers(), signal: AbortSignal.timeout(10_000) });
      if (res.ok) {
        const { models = [] } = await res.json();
        const version = (n) => parseFloat(n.match(/gemini-([\d.]+)/)?.[1] ?? '0');
        candidates = models
          .filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
          .map((m) => m.name.replace(/^models\//, ''))
          .filter((n) => /^gemini-([\d.]+-)?flash(-lite)?(-latest)?$/.test(n))
          // الأولوية: flash العادي الأحدث، وبعده نسخ lite السريعة كاحتياط
          .sort((a, b) => (a.includes('lite') - b.includes('lite')) || (version(b) - version(a)));
        // الأسرع بقياسنا أولاً (إذا متاح)، والباقي حسب الترتيب
        const fast = ['gemini-3.5-flash', 'gemini-3.6-flash'].filter((m) => candidates.includes(m));
        candidates = [...fast, ...candidates.filter((m) => !fast.includes(m))];
      }
    } catch { /* بنستعمل الافتراضي */ }
    if (!candidates.length) candidates = ['gemini-2.5-flash'];
  }
  const order = [...new Set([process.env.GEMINI_MODEL, model, ...candidates].filter(Boolean))].filter((m) => !unavailable.has(m));
  const free = order.filter((m) => (busyUntil.get(m) ?? 0) < Date.now());
  return (free.length ? free : order).slice(0, 4);
}

/** مخطط الرد بصيغة Gemini (نسخة من OpenAPI) */
function geminiSchema(ctx) {
  const ids = [...ctx.items.map((i) => i.id), ...ctx.offers.filter((o) => o.type === 'combo').map((o) => 'offer:' + o.id)];
  return {
    type: 'OBJECT',
    properties: {
      reply: { type: 'STRING', description: 'رد الباريستا للزبون باللهجة الفلسطينية' },
      suggestions: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            item_id: { type: 'STRING', enum: ids },
            qty: { type: 'INTEGER' },
            sugar: { type: 'STRING', enum: ['none', 'light', 'medium', 'extra', 'default'] },
            for_whom: { type: 'STRING' },
          },
          required: ['item_id', 'qty', 'sugar', 'for_whom'],
        },
      },
      offer_waiter: { type: 'BOOLEAN' },
    },
    required: ['reply', 'suggestions', 'offer_waiter'],
  };
}

/** يرجع { reply, suggestions, offerWaiter } أو يرمي خطأ ليُستعمل الوضع الأساسي */
export async function askGemini(ctx, history, greeting) {
  if (!geminiConfigured()) throw new Error('no-key');
  if (Date.now() < disabledUntil) throw new Error('paused');
  const messages = toApiMessages(history);
  if (!messages.length || messages[messages.length - 1].role !== 'user') throw new Error('empty');

  const body = {
    systemInstruction: { parts: [{ text: stablePrompt(ctx) + '\n\n' + volatileContext(ctx, greeting) }] },
    contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: geminiSchema(ctx),
      temperature: 0.8,
      maxOutputTokens: 8192,
    },
  };
  const lastText = messages[messages.length - 1].content;
  const level = /[\d٠-٩]/.test(lastText) && THINKING === 'minimal' ? 'low' : THINKING; // الحسابات بدها تفكير
  const payload = (m) => JSON.stringify(noThinkingCfg.has(m) ? body
    : { ...body, generationConfig: { ...body.generationConfig, thinkingConfig: { thinkingLevel: level } } });

  // بنجرب لحد 4 موديلات: المزدحم (503/500/429) بنتجاوزه 5 دقايق، والمسكّر على المفتاح (404) بنشيله، وبننتقل للي بعده فوراً
  let res = null;
  let name = null;
  for (const m of await modelOrder()) {
    name = m;
    try {
      res = await fetch(`${API}/models/${encodeURIComponent(m)}:generateContent`, {
        method: 'POST', headers: headers(), body: payload(m), signal: AbortSignal.timeout(20_000),
      });
      if (res.status === 400 && !noThinkingCfg.has(m)) {
        const err = await res.clone().json().catch(() => ({}));
        if (/thinking/i.test(err?.error?.message ?? '')) {
          noThinkingCfg.add(m); // الموديل ما بيدعم مستوى التفكير: بنعيد بدونه
          res = await fetch(`${API}/models/${encodeURIComponent(m)}:generateContent`, {
            method: 'POST', headers: headers(), body: payload(m), signal: AbortSignal.timeout(20_000),
          });
        }
      }
    } catch {
      busyUntil.set(m, Date.now() + 5 * 60_000);
      res = null;
      continue;
    }
    if (res.ok) break;
    if ([429, 500, 503, 504].includes(res.status)) { busyUntil.set(m, Date.now() + 5 * 60_000); continue; }
    if (res.status === 404) { unavailable.add(m); continue; }
    break; // خطأ تاني (مفتاح، طلب) ما بيتحل بتغيير الموديل
  }
  if (!res) {
    lastError = 'ما قدرنا نوصل لـ Gemini (الشبكة أو كل الموديلات مزدحمة)';
    throw new Error(lastError);
  }
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    const msg = detail?.error?.message ?? res.statusText;
    if (res.status === 429) {
      // خلص الحد المجاني مؤقتاً: نرجع للوضع الأساسي دقيقة ونجرب كمان مرة
      disabledUntil = Date.now() + 60_000;
      lastError = 'خلص الحد المجاني لـ Gemini مؤقتاً، نديم رجع للوضع الأساسي لحد ما يتجدد';
    } else if ((res.status === 400 && /api key/i.test(msg)) || res.status === 401 || res.status === 403) {
      disabledUntil = Date.now() + 10 * 60_000;
      lastError = `مفتاح Gemini غير صالح — تأكد منه ${globalThis.window ? 'بالإعدادات' : 'بملف .env (GEMINI_API_KEY)'}`;
    } else if (res.status === 404) {
      candidates = null; // القائمة تغيّرت، بنجيبها من جديد
      lastError = `موديل Gemini "${name}" مش متاح لهالمفتاح`;
    } else {
      lastError = `خطأ من Gemini (${res.status}): ${msg}`;
    }
    throw new Error(lastError);
  }
  model = name;

  const data = await res.json();
  const cand = data.candidates?.[0];
  if (cand?.finishReason === 'MAX_TOKENS') throw new Error('رد Gemini انقطع (MAX_TOKENS)');
  if (!cand || cand.finishReason === 'SAFETY') {
    return { reply: 'خليني أساعدك بالقائمة والطلبات بس 🙂 شو حابب تشرب اليوم؟', suggestions: [], offerWaiter: false };
  }
  const text = (cand.content?.parts ?? []).filter((p) => !p.thought && p.text).map((p) => p.text).join('');
  const parsed = JSON.parse(text);
  lastError = null;
  return {
    reply: String(parsed.reply ?? '').trim(),
    suggestions: (Array.isArray(parsed.suggestions) ? parsed.suggestions : []).map((s) => ({ ...s, sugar: s.sugar === 'default' ? '' : s.sugar })),
    offerWaiter: parsed.offer_waiter === true,
  };
}
