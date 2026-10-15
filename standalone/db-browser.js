// نسخة المتصفح من مخزن البيانات: نفس واجهة server/db.js لكن على localStorage
// تجربة CoffeeFlow بالموقع: كل محل إله مفتاح لحاله (1001 = نفس بيانات نسخة المحل الواحد القديمة)
import { buildSeed, migrate } from '../server/seed.js';
import { DB_KEY, readRegistry } from './demo-registry.js';

export { DB_KEY };
export const DEFAULT_TENANT = '1001';
const norm = (id) => (id == null || id === '' || id === 'local' ? DEFAULT_TENANT : String(id));
export const keyOf = (id) => (norm(id) === DEFAULT_TENANT ? DB_KEY : `coffeeflow-demo-db-${norm(id)}`);

let current = DEFAULT_TENANT; // صفحة المحل بتثبّته من الرابط (?store=)
const states = new Map();

/** صفحة الزبون/الكاشير: هالصفحة لأي محل */
export function setTenant(id) { current = norm(id); }
export const currentTenant = () => current;
export const dbKey = () => keyOf(current);

/** نفّذ fn على بيانات محل معيّن (لوحة المنصة بتمر على كل المحلات) */
export function withTenant(id, fn) {
  const prev = current;
  current = norm(id);
  let out;
  try { out = fn(); } catch (err) { current = prev; throw err; }
  if (out && typeof out.then === 'function') return out.finally(() => { current = prev; });
  current = prev;
  return out;
}

const readJson = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
export function tenantExists(id) {
  return states.has(norm(id)) || Boolean(readJson(keyOf(id))) || readRegistry().tenants.some((t) => t.id === norm(id));
}

function readState(id) {
  let state = readJson(keyOf(id));
  if (!state || !Array.isArray(state.items)) {
    // محل بالسجل لسا ما انفتح: بيانات تجريبية حسب نوعه (كافيه أو مطعم)
    const t = readRegistry().tenants.find((x) => x.id === id);
    state = buildSeed(t && id !== DEFAULT_TENANT ? { type: t.type, name: t.name } : {});
  }
  migrate(state);
  states.set(id, state);
  writeNow(id);
  return state;
}

function writeNow(id) {
  try {
    localStorage.setItem(keyOf(id), JSON.stringify(states.get(id)));
  } catch (err) {
    console.warn('ما قدرنا نحفظ البيانات بالمتصفح:', err);
    // اللوحة بتنبّه الكاشير ينزّل نسخة احتياطية
    try { dispatchEvent(new CustomEvent('cafe:storage-full')); } catch { /* */ }
  }
}

export function load() { return db(); }
export function db() { return states.get(current) ?? readState(current); }
export function save() { writeNow(current); }
export function flush() { for (const id of states.keys()) writeNow(id); }
export function reset() {
  const old = db().settings;
  const state = buildSeed({ type: old.businessType, name: current === DEFAULT_TENANT ? null : old.cafeName });
  migrate(state);
  states.set(current, state);
  writeNow(current);
  return state;
}
/** لما صفحة ثانية تعدّل البيانات، نقرأ النسخة الجديدة */
export function reloadFromStorage() {
  const s = readJson(keyOf(current));
  if (s?.items) states.set(current, s);
}
/** استرجاع نسخة احتياطية: بتحل محل كل بيانات المحل الحالي */
export function replaceAll(next) {
  migrate(next);
  states.set(current, next);
  writeNow(current);
  return next;
}
/** محل جديد من لوحة المنصة */
export function createTenantData(id, state) {
  migrate(state);
  states.set(norm(id), state);
  writeNow(norm(id));
  return state;
}
export function uid(prefix = '') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
