// حماية السيرفر: ترويسات الأمان (CSP وغيرها)، حجم الطلبات، ومين بيقدر يفتح اتصال Socket.io
// شوف docs/SECURITY.md للشرح الكامل
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';

/**
 * سياسة المحتوى (CSP): السكربتات بس من موقعنا ومن cdnjs، والسكربتات المضمّنة بالصفحات مسموحة بالـ hash تبعها بس
 * (ما في 'unsafe-inline' للسكربتات، فأي كود بينحقن بالصفحة ما بيشتغل).
 */
export function buildCsp(publicDir) {
  const hashes = new Set();
  for (const f of fs.readdirSync(publicDir).filter((x) => x.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(publicDir, f), 'utf8');
    for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
      // المتصفح بيوحّد نهايات الأسطر (CRLF ← LF) قبل ما يحسب الـ hash، وملفات ويندوز فيها CRLF
      const code = m[1].replace(/\r\n?/g, '\n');
      hashes.add(`'sha256-${crypto.createHash('sha256').update(code, 'utf8').digest('base64')}'`);
    }
  }
  return [
    "default-src 'self'",
    `script-src 'self' https://cdnjs.cloudflare.com ${[...hashes].join(' ')}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

export function securityHeaders(csp) {
  const hsts = process.env.HSTS === '1';
  return (req, res, next) => {
    res.setHeader('Content-Security-Policy', csp);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    // HSTS بس لما يكون السيرفر ورا HTTPS (متغير البيئة HSTS=1)
    if (hsts || req.secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    // الردود الخاصة (API) ما تنخزن بالكاش
    if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
    next();
  };
}

/** حجم الطلب حسب المسار: الزبون طلبات صغيرة، الكاشير صور (4MB)، والنسخة الاحتياطية بس 25MB */
const parsers = {
  small: express.json({ limit: '64kb' }),
  admin: express.json({ limit: '4mb' }),
  restore: express.json({ limit: '25mb' }),
};
export function bodyLimits(req, res, next) {
  if (/\/admin\/restore$/.test(req.path)) return parsers.restore(req, res, next);
  if (/\/admin\//.test(req.path)) return parsers.admin(req, res, next);
  return parsers.small(req, res, next);
}

/** Socket.io: بس صفحات نفس الموقع (أو المواقع بـ ALLOWED_ORIGINS) بتقدر تفتح اتصال */
export function socketOriginCheck(req, callback) {
  const origin = req.headers.origin;
  if (!origin) return callback(null, true); // مش متصفح (أدوات أو تطبيق)
  const allowed = String(process.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  let host = '';
  try { host = new URL(origin).host; } catch { /* */ }
  callback(null, host === req.headers.host || allowed.includes(origin));
}
