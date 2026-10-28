// رمز دخول الكاشير: بينحفظ مشفّر (PBKDF2-SHA256 مع salt عشوائي) مش نص عادي.
// Web Crypto موجودة بـ Node 20+ وبالمتصفح، فنفس الكود بيشتغل بالسيرفر وبنسخة الموقع.
const enc = new TextEncoder();
const ITERATIONS = 120_000;
const DEFAULT_PIN = '1234';
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (h) => new Uint8Array(String(h).match(/../g)?.map((x) => parseInt(x, 16)) ?? []);

/** مقارنة بوقت ثابت (ما بتكشف من وين بيختلف النصين) */
export function safeEqual(a, b) {
  a = String(a); b = String(b);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export async function hashPin(pin, saltHex = null) {
  const salt = saltHex ? fromHex(saltHex) : globalThis.crypto.getRandomValues(new Uint8Array(16));
  const key = await globalThis.crypto.subtle.importKey('raw', enc.encode(String(pin)), 'PBKDF2', false, ['deriveBits']);
  const bits = await globalThis.crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, key, 256);
  return { pinSalt: hex(salt), pinHash: hex(bits) };
}

/** هل الرمز صح؟ (بيقبل كمان الرمز القديم المحفوظ نص عادي، عشان يتحوّل لمشفّر أول دخول) */
export async function verifyPin(settings, pin) {
  if (settings.pinHash && settings.pinSalt) {
    const { pinHash } = await hashPin(pin, settings.pinSalt);
    return safeEqual(pinHash, settings.pinHash);
  }
  if (settings.adminPin != null) return safeEqual(String(pin), String(settings.adminPin));
  return false;
}

/** بيحفظ رمز جديد مشفّر وبيشيل أي نسخة نص عادي */
export async function setPin(settings, pin) {
  Object.assign(settings, await hashPin(pin));
  delete settings.adminPin;
  settings.pinWeak = String(pin) === DEFAULT_PIN; // اللوحة بتنبّه إذا لسا الرمز الافتراضي
}

/** رمز عشوائي آمن (للمحلات الجديدة) */
export function randomPin(digits = 6) {
  const n = globalThis.crypto.getRandomValues(new Uint32Array(1))[0] % 10 ** digits;
  return String(n).padStart(digits, '0');
}

// الحقول السرية اللي ما لازم تطلع من السيرفر أبداً (لا للزبون ولا للوحة)
export const SECRET_SETTINGS = ['adminPin', 'pinHash', 'pinSalt'];
export const withoutSecrets = (settings) => Object.fromEntries(Object.entries(settings).filter(([k]) => !SECRET_SETTINGS.includes(k)));
