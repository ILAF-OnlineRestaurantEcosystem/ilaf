// الباريستا الذكي عبر Claude: نعطيه القائمة والسياق، ويرجع ردّاً قصيراً + اقتراحات مُهيكلة (JSON)
// الاقتراحات مقيّدة بمخطط JSON بمعرّفات الأصناف الموجودة فعلاً، فلا يمكنه اختراع صنف أو سعر.
import Anthropic from '@anthropic-ai/sdk';
import { stablePrompt, volatileContext, outputSchema, toApiMessages } from './prompt.js';

const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5-5';
let client = null;
let disabledUntil = 0;
let lastError = null;

export function aiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export function aiStatus() {
  return {
    configured: aiConfigured(),
    model: MODEL,
    paused: Date.now() < disabledUntil,
    lastError,
  };
}

function getClient() {
  if (!client) client = new Anthropic({ timeout: 45_000, maxRetries: 1 });
  return client;
}

/** يرجع { reply, suggestions } أو يرمي خطأ ليُستعمل الوضع الأساسي */
export async function askClaude(ctx, history, greeting) {
  if (!aiConfigured()) throw new Error('no-key');
  if (Date.now() < disabledUntil) throw new Error('paused');
  const messages = toApiMessages(history);
  if (!messages.length || messages[messages.length - 1].role !== 'user') throw new Error('empty');

  const params = {
    model: MODEL,
    max_tokens: 4000,
    system: [
      { type: 'text', text: stablePrompt(ctx), cache_control: { type: 'ephemeral' } },
      { type: 'text', text: volatileContext(ctx, greeting) },
    ],
    messages,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: outputSchema(ctx) } },
  };
  // سقوط تلقائي لموديل بديل إذا رفض الموديل الأساسي (غير متوفر على Haiku)
  const useFallback = !/haiku/i.test(MODEL);
  let response;
  try {
    response = useFallback
      ? await getClient().beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
      : await getClient().messages.create(params);
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      disabledUntil = Date.now() + 10 * 60 * 1000;
      lastError = 'مفتاح Claude غير صالح أو بلا صلاحية — تأكد من ANTHROPIC_API_KEY في ملف .env';
    } else if (err instanceof Anthropic.RateLimitError) {
      disabledUntil = Date.now() + 30 * 1000;
      lastError = 'تم تجاوز حد الطلبات مؤقتاً';
    } else if (err instanceof Anthropic.APIError) {
      lastError = `خطأ من Claude (${err.status ?? 'شبكة'}): ${err.message}`;
    } else {
      lastError = err.message;
    }
    throw err;
  }

  if (response.stop_reason === 'refusal') {
    return { reply: 'خليني أساعدك بالقائمة والطلبات بس 🙂 شو حابب تشرب اليوم؟', suggestions: [], offerWaiter: false };
  }
  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock) throw new Error('no-text');
  const parsed = JSON.parse(textBlock.text);
  lastError = null;
  return {
    reply: String(parsed.reply ?? '').trim(),
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
    offerWaiter: parsed.offer_waiter === true,
  };
}
