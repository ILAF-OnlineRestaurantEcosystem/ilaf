// نسخة المتصفح من مخزن البيانات: نفس واجهة server/db.js لكن على localStorage
import { buildSeed, migrate } from '../server/seed.js';

export const DB_KEY = 'cafe-mohammad-demo-db';
// نسخة الموقع فيها محل واحد بس (نفس واجهة server/db.js للمنصة)
export const DEFAULT_TENANT = 'local';
export const withTenant = (_id, fn) => fn();
export const currentTenant = () => DEFAULT_TENANT;
let state = null;

export function load() {
  try { state = JSON.parse(localStorage.getItem(DB_KEY)); } catch { state = null; }
  if (!state || !Array.isArray(state.items)) state = buildSeed();
  migrate(state);
  flush();
  return state;
}
export function db() {
  if (!state) load();
  return state;
}
export function save() { flush(); }
export function flush() {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('ما قدرنا نحفظ البيانات بالمتصفح:', err);
    // اللوحة بتنبّه الكاشير ينزّل نسخة احتياطية
    try { dispatchEvent(new CustomEvent('cafe:storage-full')); } catch { /* */ }
  }
}
export function reset() {
  state = buildSeed();
  flush();
  return state;
}
/** لما صفحة ثانية تعدّل البيانات، نقرأ النسخة الجديدة */
export function reloadFromStorage() {
  try { const s = JSON.parse(localStorage.getItem(DB_KEY)); if (s?.items) state = s; } catch { /* */ }
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
