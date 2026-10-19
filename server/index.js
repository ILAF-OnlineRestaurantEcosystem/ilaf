// سيرفر إيلاف: Express للملفات والـ API + Socket.io للتحديث المباشر
// كل محل إله مسار: /1001 للزباين، /1001/admin للكاشير، و/api/t/1001 للـ API
// المنصة (إنت وشريكك): /platform و/api/platform
// منطق المحل كله بـ core.js (نفسه بيشتغل بنسخة الـ HTML المستقلة)
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import { db, uid, flush, withTenant, DEFAULT_TENANT } from './db.js';
import { handle, validToken } from './core.js';
import { aiStatus } from './barista/ai.js';
import { platformHandle, tenantInfo, setupKey, PLATFORM_NAME, isFrozen, onTenantChange } from './platform.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(here, '..', 'public');
const UPLOADS = path.join(PUBLIC, 'uploads');
const PORT = Number(process.env.PORT) || 3000;
const TENANT_RE = /^\d{3,8}$/;

fs.mkdirSync(UPLOADS, { recursive: true });
withTenant(DEFAULT_TENANT, () => db()); // بيحمّل أول محل (وبينقل البيانات القديمة إذا في)

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.disable('x-powered-by');
app.use(express.json({ limit: '25mb' })); // النسخة الاحتياطية ممكن تكون كبيرة
// ───────── الصفحات ─────────
const page = (file) => (_req, res) => res.sendFile(path.join(PUBLIC, file));
app.get('/', (_req, res) => res.redirect('/platform')); // الزبون بيوصل من الـ QR والكاشير من رابطه، فالرئيسية = لوحة المنصة
app.get('/platform', page('platform.html'));
app.get(['/admin', '/admin.html'], (_req, res) => res.redirect(`/${DEFAULT_TENANT}/admin`)); // الروابط القديمة
app.get(['/index', '/index.html'], (_req, res) => res.redirect(`/${DEFAULT_TENANT}`));
app.use(express.static(PUBLIC, { extensions: ['html'], index: false }));
function tenantPage(file) {
  return (req, res, next) => {
    const t = TENANT_RE.test(req.params.tid) && tenantInfo(req.params.tid);
    if (!t) return next();
    if (isFrozen(t)) return res.status(423).sendFile(path.join(PUBLIC, 'frozen.html')); // الحساب مجمّد
    res.sendFile(path.join(PUBLIC, file));
  };
}
app.get('/:tid', tenantPage('index.html'));
app.get('/:tid/admin', tenantPage('admin.html'));

// ───────── حدود الطلبات من نفس الجهاز ─────────
const LIMITS = [
  ['POST', /\/orders$/, 10],
  ['POST', /\/tables\/\d+\/call$/, 6],
  ['POST', /\/barista$/, 20],
  ['POST', /\/admin\/login$/, 8],
  ['POST', /^\/(login|setup)$/, 8],
];
const hits = new Map();
function limited(req, scope) {
  const rule = LIMITS.find(([m, re]) => m === req.method && re.test(req.path));
  if (!rule) return false;
  const key = `${req.ip}|${scope}|${rule[1]}`;
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  if (arr.length >= rule[2]) return true;
  arr.push(now);
  hits.set(key, arr);
  return false;
}
const tooMany = (res) => res.status(429).json({ error: 'طلبات كثيرة ورا بعض، استنى لحظة وجرب كمان مرة.' });

const hooks = {
  lanUrls,
  saveUpload(ext, base64) {
    const name = uid('img') + '.' + (ext === 'jpeg' ? 'jpg' : ext);
    fs.writeFileSync(path.join(UPLOADS, name), Buffer.from(base64, 'base64'));
    return '/uploads/' + name;
  },
};

// الأحداث المباشرة لكل محل بغرفه: <id>:admin، <id>:order:<orderId>، <id>:all
function emit(tid, { event, payload, room }) {
  io.to(`${tid}:${room ?? 'all'}`).emit(event, payload);
}

// ───────── API المنصة ─────────
app.use('/api/platform', async (req, res) => {
  if (limited(req, 'platform')) return tooMany(res);
  const r = await platformHandle(req.method, req.url, req.body, { token: req.get('x-platform-token') });
  res.status(r.status).json(r.data);
});

// ───────── API المحل ─────────
async function tenantApi(tid, req, res, url) {
  const t = tenantInfo(tid);
  if (!t) return res.status(404).json({ error: 'ما في محل بهالرقم.' });
  if (isFrozen(t)) return res.status(423).json({ error: 'الحساب مجمّد مؤقتاً. تواصل مع إدارة إيلاف.', frozen: true });
  if (limited(req, tid)) return tooMany(res);
  const r = await withTenant(tid, () => handle(req.method, url, req.body, { token: req.get('x-admin-token'), hooks }));
  r.events.forEach((e) => emit(tid, e));
  res.status(r.status).json(r.data);
}
app.use('/api/t/:tid', (req, res) => {
  if (!TENANT_RE.test(req.params.tid)) return res.status(404).json({ error: 'ما في محل بهالرقم.' });
  return tenantApi(req.params.tid, req, res, req.url);
});
// /api القديم (قبل المنصة) = أول محل
app.use('/api', (req, res) => tenantApi(DEFAULT_TENANT, req, res, req.url));

app.use((err, _req, res, _next) => {
  const status = err.status || (err.type === 'entity.parse.failed' ? 400 : 500);
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'صار خطأ بالسيرفر، جرب كمان مرة.' : 'طلب غير مفهوم.' });
});

io.on('connection', (socket) => {
  const q = String(socket.handshake.query?.tenant ?? '');
  const tid = TENANT_RE.test(q) && tenantInfo(q) ? q : DEFAULT_TENANT;
  if (isFrozen(tenantInfo(tid))) { socket.emit('tenant:frozen'); socket.disconnect(true); return; }
  socket.join(`${tid}:all`);
  if (withTenant(tid, () => validToken(socket.handshake.auth?.token))) socket.join(`${tid}:admin`);
  socket.on('track', (ids) => {
    for (const id of [].concat(ids).slice(0, 10)) {
      if (typeof id === 'string' && withTenant(tid, () => db().orders.some((o) => o.id === id))) socket.join(`${tid}:order:${id}`);
    }
  });
});

// لحظة التجميد: كل صفحة مفتوحة للمحل (زباين وكاشير) بتسكّر وبتتحوّل لصفحة "الحساب مجمّد"
onTenantChange((t) => {
  if (!isFrozen(t)) return;
  io.to(`${t.id}:all`).emit('tenant:frozen');
  setTimeout(() => io.in(`${t.id}:all`).disconnectSockets(true), 300);
});

function lanUrls() {
  return Object.values(os.networkInterfaces()).flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => `http://${i.address}:${PORT}`);
}

server.listen(PORT, () => {
  const ai = aiStatus();
  const key = setupKey();
  console.log(`
  ☕  ${PLATFORM_NAME} — منصة الطلب الذكي للكافيهات والمطاعم
  ─────────────────────────────────────────
  لوحة المنصة:    http://localhost:${PORT}/platform
  أول محل:        http://localhost:${PORT}/${DEFAULT_TENANT}   (الكاشير: /${DEFAULT_TENANT}/admin، الرمز الافتراضي 1234)
  ${lanUrls().map((u) => `على الشبكة:     ${u}`).join('\n  ')}
  نديم:           ${ai.configured ? `${ai.provider} (${ai.model})` : 'الوضع الأساسي — أضف GEMINI_API_KEY (مجاني) أو ANTHROPIC_API_KEY في .env'}
${key ? `
  🔑 رمز إعداد المنصة (لأول حساب): ${key}
     افتح /platform واكتبه مع اسم المستخدم وكلمة السر تبعك.
` : ''}`);
});

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { flush(); process.exit(0); });
