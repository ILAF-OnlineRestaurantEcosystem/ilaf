// مخزن البيانات (CoffeeFlow): كل محل إله ملف JSON منفصل بـ data/tenants/<id>.json
// المحل الحالي بيتحدّد لكل طلب عبر withTenant (AsyncLocalStorage)، فباقي الكود بيضل يحكي db() عادي.
// الكتابة ذرّية (ملف مؤقت ثم إعادة تسمية) ومجمّعة كي لا يتلف الملف عند انقطاع مفاجئ.
// خبير قواعد البيانات بيقدر يبدّل هالملف بس (نفس الدوال) ليصير التخزين على PostgreSQL — شوف docs/HANDOVER.md
import fs from 'node:fs';
import path from 'node:path';
import { AsyncLocalStorage } from 'node:async_hooks';
import { fileURLToPath } from 'node:url';
import { buildSeed, migrate } from './seed.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.join(here, '..', 'data');
const TENANTS_DIR = path.join(DATA_DIR, 'tenants');
const LEGACY_FILE = path.join(DATA_DIR, 'db.json'); // قبل المنصة كان في محل واحد بهالملف
export const DEFAULT_TENANT = '1001';

const als = new AsyncLocalStorage();
const states = new Map(); // id → بيانات المحل بالذاكرة
const timers = new Map();

/** نفّذ fn على بيانات محل معيّن (كل الـ db() جوّاها بترجع بيانات هالمحل) */
export function withTenant(id, fn) {
  return als.run(String(id), fn);
}
export function currentTenant() {
  return als.getStore() ?? DEFAULT_TENANT;
}
const fileOf = (id) => path.join(TENANTS_DIR, `${id}.json`);
export function tenantExists(id) {
  return states.has(String(id)) || fs.existsSync(fileOf(String(id)));
}

function readTenant(id) {
  let state = null;
  const file = fileOf(id);
  if (fs.existsSync(file)) {
    try {
      state = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      const broken = file + '.broken-' + Date.now();
      fs.copyFileSync(file, broken);
      console.error(`⚠️  ملف بيانات المحل ${id} تالف، نُسخ إلى ${broken} وأُنشئت بيانات جديدة.`);
    }
  }
  // أول تشغيل بعد المنصة: بيانات المحل القديم بتصير المحل الأول (1001) متل ما هي
  if (!state && id === DEFAULT_TENANT && fs.existsSync(LEGACY_FILE)) {
    state = JSON.parse(fs.readFileSync(LEGACY_FILE, 'utf8'));
    fs.renameSync(LEGACY_FILE, LEGACY_FILE + '.moved-to-1001');
    console.log('☕ بيانات المحل القديم انتقلت لمحل رقم 1001');
  }
  if (!state) {
    state = buildSeed();
    console.log(`☕ أُنشئت بيانات تجريبية للمحل ${id}`);
  }
  migrate(state);
  states.set(id, state);
  writeNow(id);
  return state;
}

export function load() {
  return db();
}

export function db() {
  const id = currentTenant();
  return states.get(id) ?? readTenant(id);
}

export function save() {
  const id = currentTenant();
  clearTimeout(timers.get(id));
  timers.set(id, setTimeout(() => writeNow(id), 150));
}

function writeNow(id) {
  const state = states.get(id);
  if (!state) return;
  fs.mkdirSync(TENANTS_DIR, { recursive: true });
  const tmp = fileOf(id) + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, fileOf(id));
}

export function flush() {
  for (const id of states.keys()) {
    clearTimeout(timers.get(id));
    writeNow(id);
  }
}

export function reset() {
  const id = currentTenant();
  const old = tenantExists(id) ? db().settings : null; // المحل بيضل بنفس نوعه واسمه
  const state = buildSeed({ type: old?.businessType ?? 'cafe', name: old?.cafeName ?? null });
  migrate(state);
  states.set(id, state);
  writeNow(id);
  return state;
}

/** استرجاع نسخة احتياطية: بتحل محل كل بيانات المحل الحالي */
export function replaceAll(next) {
  const id = currentTenant();
  migrate(next);
  states.set(id, next);
  writeNow(id);
  return next;
}

/** محل جديد من المنصة: بياناته الأولية جاهزة (كافيه أو مطعم، مع أو بدون بيانات تجريبية) */
export function createTenantData(id, state) {
  migrate(state);
  states.set(String(id), state);
  writeNow(String(id));
  return state;
}

export function uid(prefix = '') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
