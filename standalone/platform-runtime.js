// تجربة لوحة منصة CafeFlow بالموقع الثابت (بدون سيرفر): نفس server/platform.js بيشتغل داخل المتصفح
// كل زائر إله نسخته: حساب تجربة جاهز، كافيه 1001 ومطعم 1002، وفيه يضيف محلات ويجمّدها.
import { platformHandle } from '../server/platform.js';
import { DEMO_LOGIN } from './demo-registry.js';

const TOKEN_KEY = 'cf.platform.token';
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

window.__CAFE_DEMO__ = {
  platform: {
    login: DEMO_LOGIN,
    /** نفس ردود /api/platform: { status, data } */
    async api(path, { method = 'GET', body, token } = {}) {
      const r = await platformHandle(method, path, clone(body), { token });
      return { status: r.status, data: clone(r.data) };
    },
    /** روابط صفحات المحل بنفس الموقع: 1001 هو المحل الأصلي، والباقي ?store= */
    storeUrl(id, admin = false) {
      const page = admin ? 'admin.html' : 'customer.html';
      return String(id) === '1001' ? page : `${page}?store=${encodeURIComponent(id)}`;
    },
    // جلسات المنصة بالذاكرة، فكل ما تنفتح الصفحة بندخل بحساب التجربة من جديد
    ready: platformHandle('POST', '/login', { ...DEMO_LOGIN })
      .then((r) => { if (r.status === 200) { try { localStorage.setItem(TOKEN_KEY, r.data.token); } catch { /* */ } } })
      .catch(() => {}),
  },
};
