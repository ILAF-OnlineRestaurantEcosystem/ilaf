// يبني ملفّي HTML مستقلين بيفتحوا بدبل كليك بدون سيرفر:
//   dist/طلب-الزبون.html  و  dist/لوحة-التحكم.html
// كل الـ CSS والـ JS ومنطق السيرفر بينحطوا جوّا الملف (حزمة وحدات بسيطة بدون أدوات خارجية).
// التشغيل: npm run build:html
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'dist');
const CUSTOMER_FILE = 'طلب-الزبون.html';
const ADMIN_FILE = 'لوحة-التحكم.html';

// وحدات السيرفر اللي إلها نسخة متصفح
const ALIASES = {
  'server/db.js': 'standalone/db-browser.js',
  'server/barista/claude.js': 'standalone/claude-stub.js',
  'server/platform-store.js': 'standalone/demo-registry.js',
};

const rel = (abs) => path.relative(ROOT, abs).split(path.sep).join('/');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

function resolveId(fromId, spec) {
  if (!spec.startsWith('.')) throw new Error(`استيراد خارجي غير مدعوم بالنسخة المستقلة: "${spec}" في ${fromId}`);
  const id = rel(path.resolve(ROOT, path.dirname(fromId), spec));
  return ALIASES[id] ?? id;
}

/** يحوّل وحدة ES إلى دالة داخل الحزمة */
function transform(id, src) {
  const deps = [];
  const exportNames = [];
  let code = src.replace(/^import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"];?[ \t]*$/gm, (_, what, spec) => {
    const dep = resolveId(id, spec);
    deps.push(dep);
    what = what.trim();
    const req = `__req(${JSON.stringify(dep)})`;
    if (what.startsWith('{')) {
      const inner = what.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean)
        .map((s) => s.replace(/^(\w+)\s+as\s+(\w+)$/, '$1: $2')).join(', ');
      return `const { ${inner} } = ${req};`;
    }
    if (what.startsWith('* as ')) return `const ${what.slice(5).trim()} = ${req};`;
    return `const ${what} = ${req}.default;`;
  });
  code = code.replace(/^export\s+\{([^}]*)\};?[ \t]*$/gm, (_, names) => {
    names.split(',').map((s) => s.trim()).filter(Boolean).forEach((n) => exportNames.push(n));
    return '';
  });
  code = code.replace(/^export\s+((?:async\s+)?function\*?|const|let|var|class)\s+([\w$]+)/gm, (_, kind, name) => {
    exportNames.push(name);
    return `${kind} ${name}`;
  });
  if (/\bimport\.meta\b|^\s*export\s+default/m.test(code)) throw new Error(`${id}: صيغة غير مدعومة بالنسخة المستقلة`);
  const assign = exportNames.length ? `\nObject.assign(__e, { ${exportNames.join(', ')} });` : '';
  return { deps, code: `__def(${JSON.stringify(id)}, function (__e) {\n'use strict';\n${code}${assign}\n});\n` };
}

function bundle(entries) {
  const seen = new Map();
  const visit = (id) => {
    if (seen.has(id)) return;
    seen.set(id, null);
    const t = transform(id, read(id));
    t.deps.forEach(visit);
    seen.set(id, t.code);
  };
  entries.forEach(visit);
  const prelude = `
// وحدات السيرفر بتقرأ process.env (مفتاح Gemini بنسخة العرض بيتعبّى من متصفح الكاشير)
var process = { env: {} };
const __mods = Object.create(null);
function __def(id, factory) { __mods[id] = { factory, exports: null }; }
function __req(id) {
  const m = __mods[id];
  if (!m) throw new Error('وحدة غير موجودة: ' + id);
  if (!m.exports) { m.exports = {}; m.factory(m.exports); }
  return m.exports;
}`;
  const body = [...seen.values()].join('\n');
  const run = entries.map((e) => `__req(${JSON.stringify(e)});`).join('\n');
  // نمنع إغلاق وسم السكربت بالغلط من داخل النصوص
  return `(function () {\n${prelude}\n${body}\n${run}\n})();`.replace(/<\/script/gi, '<\\/script');
}

// شعار إيلاف للصفحات المستقلة (مضمّن، بدون ملفات جنبها)
const dataUri = (file, type) => `data:${type};base64,${fs.readFileSync(path.join(ROOT, file)).toString('base64')}`;
const ILAF_ICON = dataUri('public/brand/ilaf-icon-64.png', 'image/png');
const ILAF_LOGO = dataUri('public/brand/ilaf-logo-light.png', 'image/png');

function inlineHtml(htmlFile, entry, { replace = [], runtime = 'standalone/runtime.js' } = {}) {
  let html = read(htmlFile);
  html = html.replace(/<link rel="stylesheet" href="\/css\/([\w.-]+)">/g, (_, f) => `<style>\n${read('public/css/' + f)}\n</style>`);
  const favicon = 'data:image/svg+xml;base64,' + Buffer.from(read('public/favicon.svg')).toString('base64');
  html = html.replace('href="/favicon.svg"', `href="${favicon}"`);
  html = html.replace('href="/brand/ilaf-icon-64.png"', `href="${ILAF_ICON}"`);
  html = html.replace(/\s*<script src="\/socket\.io\/socket\.io\.js"><\/script>/, '');
  const js = bundle([runtime, entry]);
  html = html.replace(/<script type="module" src="\/js\/[\w.-]+"><\/script>/, () => `<script>\n${js}\n</script>`);
  for (const [a, b] of replace) html = html.split(a).join(b);
  if (/(?:src|href)="\/(?!\/)/.test(html)) {
    const left = html.match(/(?:src|href)="\/(?!\/)[^"]*"/g);
    throw new Error(`بقيت روابط بتحتاج سيرفر في ${htmlFile}: ${left.join(', ')}`);
  }
  return html;
}

fs.mkdirSync(OUT, { recursive: true });
const customer = inlineHtml('public/index.html', 'public/js/customer.js');
const admin = inlineHtml('public/admin.html', 'public/js/admin.js', {
  replace: [['href="/" target="_blank"', `href="${CUSTOMER_FILE}" target="_blank"`]],
});
fs.writeFileSync(path.join(OUT, CUSTOMER_FILE), customer);
fs.writeFileSync(path.join(OUT, ADMIN_FILE), admin);
for (const [f, c] of [[CUSTOMER_FILE, customer], [ADMIN_FILE, admin]]) {
  console.log(`✔ dist/${f}  (${Math.round(Buffer.byteLength(c) / 1024)} KB)`);
}

// مجلد جاهز للرفع على أي استضافة مواقع ثابتة (Netlify / GitHub Pages / Vercel):
//   index.html صفحة البداية · customer.html للزبون · admin.html للوحة التحكم
const HOST = path.join(ROOT, 'hosting');
fs.mkdirSync(HOST, { recursive: true });
// ?v= بيجبر الجوال يجيب آخر نسخة بدل اللي بذاكرته (GitHub Pages بيخلّي الصفحة 10 دقايق بالكاش)
const stamp = Date.now().toString(36);
fs.writeFileSync(path.join(HOST, 'index.html'), read('standalone/landing.html').replace('__ILAF_ICON__', ILAF_ICON).replace('__ILAF_LOGO__', ILAF_LOGO).replace(/href="(admin|customer|platform)\.html(?:\?([^"]*))?"/g, (_, p, q) => `href="${p}.html?${q ? q + '&' : ''}v=${stamp}"`));
fs.writeFileSync(path.join(HOST, 'customer.html'), customer);
fs.writeFileSync(path.join(HOST, 'admin.html'), admin.split(`href="${CUSTOMER_FILE}"`).join('href="customer.html"'));
// تجربة منصة إيلاف كاملة بالمتصفح (محلات، مطعم، تجميد) — بتفتح customer.html و admin.html?store=…
const platform = inlineHtml('public/platform.html', 'public/js/platform.js', { runtime: 'standalone/platform-runtime.js' });
fs.writeFileSync(path.join(HOST, 'platform.html'), platform);
console.log(`✔ hosting/  (index.html + customer.html + admin.html + platform.html ${Math.round(Buffer.byteLength(platform) / 1024)} KB) جاهز للرفع`);
