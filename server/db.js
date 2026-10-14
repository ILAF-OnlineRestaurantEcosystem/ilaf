// مخزن بيانات بسيط بملف JSON — يكفي لكافيه واحد ويعمل بدون أي إعداد.
// الكتابة ذرّية (ملف مؤقت ثم إعادة تسمية) ومجمّعة كي لا يتلف الملف عند انقطاع مفاجئ.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSeed, migrate } from './seed.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.join(here, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

let state = null;
let writeTimer = null;

export function load() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(DB_FILE)) {
    try {
      state = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (err) {
      const broken = DB_FILE + '.broken-' + Date.now();
      fs.copyFileSync(DB_FILE, broken);
      console.error(`⚠️  ملف البيانات تالف، نُسخ إلى ${broken} وأُنشئت بيانات جديدة.`);
      state = buildSeed();
    }
  } else {
    state = buildSeed();
    console.log('☕ أُنشئت بيانات تجريبية جديدة في data/db.json');
  }
  migrate(state);
  flush();
  return state;
}

export function db() {
  if (!state) load();
  return state;
}

export function save() {
  clearTimeout(writeTimer);
  writeTimer = setTimeout(flush, 150);
}

export function flush() {
  clearTimeout(writeTimer);
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

export function reset() {
  state = buildSeed();
  flush();
  return state;
}

/** استرجاع نسخة احتياطية: بتحل محل كل البيانات */
export function replaceAll(next) {
  state = next;
  migrate(state);
  flush();
  return state;
}

export function uid(prefix = '') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
