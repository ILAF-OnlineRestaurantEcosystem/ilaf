// السيرفر: Express للملفات والـ API + Socket.io للتحديث المباشر
// كل منطق المسارات موجود في core.js (نفسه بيشتغل بنسخة الـ HTML المستقلة)
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import { load, db, uid, flush } from './db.js';
import { handle, validToken } from './core.js';
import { aiStatus } from './barista/ai.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(here, '..', 'public');
const UPLOADS = path.join(PUBLIC, 'uploads');
const PORT = Number(process.env.PORT) || 3000;

load();
fs.mkdirSync(UPLOADS, { recursive: true });

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.disable('x-powered-by');
app.use(express.json({ limit: '25mb' })); // النسخة الاحتياطية ممكن تكون كبيرة
app.use(express.static(PUBLIC, { extensions: ['html'] }));
app.get('/admin', (_req, res) => res.sendFile(path.join(PUBLIC, 'admin.html')));

// حدود بسيطة لعدد الطلبات من نفس الجهاز
const LIMITS = [
  ['POST', /^\/orders$/, 10],
  ['POST', /^\/tables\/\d+\/call$/, 6],
  ['POST', /^\/barista$/, 20],
  ['POST', /^\/admin\/login$/, 8],
];
const hits = new Map();
function limited(req) {
  const rule = LIMITS.find(([m, re]) => m === req.method && re.test(req.path));
  if (!rule) return false;
  const key = `${req.ip}|${rule[1]}`;
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  if (arr.length >= rule[2]) return true;
  arr.push(now);
  hits.set(key, arr);
  return false;
}

const hooks = {
  lanUrls,
  saveUpload(ext, base64) {
    const name = uid('img') + '.' + (ext === 'jpeg' ? 'jpg' : ext);
    fs.writeFileSync(path.join(UPLOADS, name), Buffer.from(base64, 'base64'));
    return '/uploads/' + name;
  },
};

function emit({ event, payload, room }) {
  if (room) io.to(room).emit(event, payload);
  else io.emit(event, payload);
}

app.use('/api', async (req, res) => {
  if (limited(req)) return res.status(429).json({ error: 'طلبات كثيرة ورا بعض، استنى لحظة وجرب كمان مرة.' });
  const r = await handle(req.method, req.url, req.body, { token: req.get('x-admin-token'), hooks });
  r.events.forEach(emit);
  res.status(r.status).json(r.data);
});

app.use((err, _req, res, _next) => {
  const status = err.status || (err.type === 'entity.parse.failed' ? 400 : 500);
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'صار خطأ بالسيرفر، جرب كمان مرة.' : 'طلب غير مفهوم.' });
});

io.on('connection', (socket) => {
  if (validToken(socket.handshake.auth?.token)) socket.join('admin');
  socket.on('track', (ids) => {
    for (const id of [].concat(ids).slice(0, 10)) {
      if (typeof id === 'string' && db().orders.some((o) => o.id === id)) socket.join('order:' + id);
    }
  });
});

function lanUrls() {
  return Object.values(os.networkInterfaces()).flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => `http://${i.address}:${PORT}`);
}

server.listen(PORT, () => {
  const ai = aiStatus();
  console.log(`
  ☕  ${db().settings.cafeName} — نظام الطلب الإلكتروني
  ─────────────────────────────────────────
  صفحة الزبائن:   http://localhost:${PORT}
  لوحة الكاشير:   http://localhost:${PORT}/admin   (الرمز الافتراضي 1234)
  ${lanUrls().map((u) => `على الشبكة:     ${u}`).join('\n  ')}
  الباريستا:      ${ai.configured ? `${ai.provider} (${ai.model})` : 'الوضع الأساسي — أضف GEMINI_API_KEY (مجاني) أو ANTHROPIC_API_KEY في .env'}
`);
});

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { flush(); process.exit(0); });
