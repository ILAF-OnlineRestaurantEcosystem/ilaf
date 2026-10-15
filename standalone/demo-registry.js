// نسخة الموقع الثابت (تجربة CoffeeFlow بدون سيرفر): سجل المنصة بمتصفح الزائر
// نفس دوال server/platform-store.js، بس التخزين localStorage وكل زائر إله نسخته لحاله.
// أول مرة: حساب تجربة جاهز ومحلّين (كافيه 1001 ومطعم 1002) عشان أي حد يجرّب على طول.

export const DB_KEY = 'cafe-mohammad-demo-db';          // بيانات المحل الأول (نفس نسخة المحل الواحد القديمة)
export const REG_KEY = 'coffeeflow-demo-platform';      // سجل المنصة
export const DEMO = true;
export const DEMO_LOGIN = { username: 'demo', password: 'coffeeflow' };

const getItem = (k) => { try { return localStorage.getItem(k); } catch { return null; } };

const HEX = (n) => (n >>> 0).toString(16).padStart(8, '0');
export function randomHex(bytes) {
  return [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export const newId = () => randomHex(16);

// تشفير بسيط لكلمة السر (للتجربة بس: الحساب أصلاً بمتصفح الزائر). السيرفر الحقيقي بيستعمل scrypt.
export function hashPassword(password, salt = randomHex(16)) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57, h3 = 0x9e3779b9, h4 = 0x85ebca6b;
  const text = `${salt}:${password}`;
  for (let round = 0; round < 2000; round++) {
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i) + round;
      h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677);
      h3 = Math.imul(h3 ^ h1, 2246822507); h4 = Math.imul(h4 ^ h2, 3266489909);
    }
  }
  return { salt, hash: HEX(h1) + HEX(h2) + HEX(h3) + HEX(h4) };
}
export const samePassword = (user, password) => hashPassword(password, user.salt).hash === user.hash;

/** السجل أول مرة: حساب التجربة + كافيه 1001 (بياناته نفس نسخة الموقع القديمة) + مطعم 1002 */
function demoRegistry() {
  const at = new Date().toISOString();
  let cafeName = 'كافي محمد';
  try { cafeName = JSON.parse(getItem(DB_KEY))?.settings?.cafeName || cafeName; } catch { /* */ }
  return {
    users: [{ id: 'demo', username: DEMO_LOGIN.username, name: 'زائر التجربة', ...hashPassword(DEMO_LOGIN.password), createdAt: at, createdBy: 'system' }],
    tenants: [
      { id: '1001', name: cafeName, type: 'cafe', ownerName: 'محمد', ownerPhone: '', status: 'active', notes: 'نفس محل نسخة الموقع', createdAt: at, createdBy: 'system' },
      { id: '1002', name: 'مطعم السرايا', type: 'restaurant', ownerName: 'أبو سامي', ownerPhone: '', status: 'active', notes: 'مطعم تجريبي بقائمة المطعم الجاهزة', createdAt: at, createdBy: 'system' },
    ],
    nextId: 1003,
  };
}

export function readRegistry() {
  try {
    const reg = JSON.parse(getItem(REG_KEY));
    if (reg && Array.isArray(reg.tenants) && Array.isArray(reg.users)) return reg;
  } catch { /* */ }
  const reg = demoRegistry();
  writeRegistry(reg);
  return reg;
}
export function writeRegistry(reg) {
  try { localStorage.setItem(REG_KEY, JSON.stringify(reg)); } catch (err) { console.warn('ما قدرنا نحفظ سجل المنصة:', err); }
}
