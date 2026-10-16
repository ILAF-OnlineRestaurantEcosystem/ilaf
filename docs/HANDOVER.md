# CafeFlow: تسليم لخبير قواعد البيانات والسيرفر

هاد الملف بيشرح المشروع لمين رح يعمل **الدومين والسيرفر وقاعدة البيانات**.
الكود كله شغّال هلأ على ملفات JSON، والمطلوب ننقله لـ **PostgreSQL** على سيرفر حقيقي بدومين و HTTPS.

**ابدأ بـ [REQUIREMENTS.md](REQUIREMENTS.md)**: شو لازم يعمل النظام خطوة خطوة، وقائمة الفحص بعد ما تربط قاعدة البيانات.

**جرّب قبل ما تبلّش** (نسخة تجربة بالمتصفح على GitHub Pages، نفس الواجهات):
لوحة المنصة https://mohammed131207.github.io/cafe-mohammad/platform.html ·
كل الروابط https://mohammed131207.github.io/cafe-mohammad/

---

## 1. شو هو المشروع

**CafeFlow** منصة طلب من الطاولة للكافيهات والمطاعم (multi-tenant):

| مين | الرابط | شو بيعمل |
|---|---|---|
| أصحاب المنصة (2 شركاء) | `/platform` | لوحة تحكم مشتركة: كل المحلات، إحصائياتها، إضافة محل، تجميد حساب، الفريق |
| الكاشير (صاحب المحل) | `/1001/admin` | الطلبات لحظياً، الطاولات، القائمة، المخزن، العروض، التقارير، الإعدادات |
| الزبون | `/1001` | المنيو، السلة، تتبّع الطلب، نداء النادل، المساعد الذكي "نديم" |
| الدومين نفسه | `/` | بيحوّل للوحة المنصة (الزبون دايماً بيوصل من QR المحل، والكاشير من رابط لوحته) |

- **كل محل إله رقم (ID)** من 4 أرقام: `1001`، `1002`… (أول محل `1001` هو "كافي محمد").
- **نوع المحل**: `cafe` أو `restaurant`، وبيغيّر الهوية والألوان وكلام نديم والقائمة الجاهزة.
- **تجميد الحساب**: المحل المجمّد ما حدا بيقدر يوصله (صفحات وAPI وSocket)، والبيانات بتضل محفوظة.

## 2. التقنيات

- **Node.js 22+**، ESM، بدون TypeScript وبدون build للسيرفر.
- **Express 5** للصفحات والـ API، و **Socket.io 4** للتحديث المباشر.
- الواجهة: HTML + CSS + JavaScript عادي (ES modules) بمجلد `public/`، بدون framework.
- الذكاء الاصطناعي: Gemini (مجاني) أو Claude، عبر `fetch` / SDK.
- نسخة HTML مستقلة (بدون سيرفر) بتنبني بـ `npm run build:html` وبتنرفع على GitHub Pages. هاي محل واحد بس وما إلها علاقة بالسيرفر.

## 3. هيكل الكود

```
server/
  index.js          ← Express + Socket.io، توجيه المسارات لكل محل، حدود الطلبات، التجميد اللحظي
  db.js             ← ★ تخزين بيانات المحلات (بتبدّله)
  platform-store.js ← ★ تخزين سجل المنصة + تشفير كلمات السر (بتبدّله)
  platform.js       ← المنصة: الحسابات، سجل المحلات، الإحصائيات، التجميد (منطق بس، ما بيلمس الملفات)
  core.js           ← كل مسارات API المحل كدوال صافية handle(method, url, body) → { status, data, events }
  logic.js          ← منطق الطلبات والفواتير والمخزن والتقارير
  reports.js        ← تلخيص المبيعات والأرباح
  seed.js           ← بيانات أولية للكافيه + الترقيات (migrate)
  seed-restaurant.js← قائمة المطعم الجاهزة
  barista/          ← "نديم": prompt.js، context.js، gemini.js، claude.js، fallback.js (بدون ذكاء)
public/             ← الواجهات (index.html زبون، admin.html كاشير، platform.html منصة، frozen.html المحل المجمّد)
standalone/         ← نسخة التجربة على GitHub Pages: نفس كود server/ بيشتغل بالمتصفح
                      (db-browser.js و demo-registry.js بدائل التخزين بـ localStorage — للتجربة بس، مش للإنتاج)
data/               ← (مش بالـ git) البيانات الحالية
  platform.json     ← الحسابات وسجل المحلات
  tenants/1001.json ← كل بيانات محل 1001
```

## 4. كيف التخزين شغّال هلأ (مهم)

### `server/db.js`
- كل محل **ملف JSON واحد** فيه كل بياناته (`state`).
- البيانات بتنحمّل **للذاكرة** أول مرة وبتضل فيها (`Map: id → state`).
- المحل الحالي بيتحدّد لكل طلب بـ `AsyncLocalStorage`:
  ```js
  withTenant('1002', () => handle(...))  // جوّا: db() بترجع بيانات 1002
  ```
- الكود كله بيعدّل على `db()` مباشرة (objects بالذاكرة) وبعدين بينادي `save()`. الحفظ مجمّع (debounce 150ms) وذرّي (ملف مؤقت ثم rename).

الدوال اللي باقي الكود بيستعملها (**لازم تضل بنفس الأسماء والسلوك**):

| الدالة | شو بتعمل |
|---|---|
| `withTenant(id, fn)` | بتشغّل fn على محل معيّن |
| `currentTenant()` | رقم المحل الحالي |
| `tenantExists(id)` | في محل بهالرقم؟ |
| `db()` | **متزامنة**: بترجع state المحل الحالي (object) |
| `save()` | بتعلّم إن المحل الحالي تغيّر وبدها تنحفظ |
| `flush()` | حفظ فوري لكل شي (عند إطفاء السيرفر) |
| `reset()` | بيانات تجريبية جديدة للمحل الحالي |
| `replaceAll(state)` | استرجاع نسخة احتياطية |
| `createTenantData(id, state)` | محل جديد من المنصة |
| `uid(prefix)` | معرّف عشوائي |

### `server/platform.js` و `server/platform-store.js`
- `data/platform.json`: `{ users, tenants, nextId, setupKey }`.
- كل القراءة والكتابة والتشفير بـ `platform-store.js` بس: `readRegistry()`، `writeRegistry(reg)`، `hashPassword()`، `samePassword()`، `randomHex()`، `newId()`.
- كلمات السر **scrypt** مع salt (`crypto.scryptSync`).
- جلسات المنصة (7 أيام) وجلسات الكاشير (12 ساعة) **بالذاكرة**، وبتروح إذا السيرفر رجع اشتغل.

### شكل state المحل
```
{
  version, menuVersion, imagesSeeded,
  settings:   { cafeName, brandWord, tagline, businessType, currency, currencyName, city, lat, lon,
                adminPin, baristaName, wifi, hours, cafeNotes, dayOpenedAt,
                theme: { palette, color, applyTo } },   // ثيم الألوان: palette جاهز أو custom + color، applyTo = menu | admin | both
  categories: [{ id, name, en, desc, temp, icon, image, order }],
  items:      [{ id, categoryId, name, desc, price, cost, image, available, stock, recipe, art, hue,
                 sugar, caffeine, sugarChoice, tags[], order }],
  offers:     [{ id, type: combo|discount, title, description, itemIds[], price, percent, active }],
  zones:      [{ id, name, description }],
  tables:     [{ number, zoneId, seats, sessionId?, sessionAt? }],
  orders:     [{ id, no, table (0 = طلب خارجي), takeaway?{name,phone}, zoneName, sessionId, device,
                 lines:[{ kind: item|offer, refId, name, unitPrice, qty, lineTotal, options{}, note, unitCost }],
                 subtotal, discount, manualDiscount?, total, cost, note, status, source, edited?,
                 stockTaken{}, history:[{status, at}], createdAt, updatedAt, demo? }],
  calls:      [{ id, table, kind, at }],
  days:       [{ id, openedAt, closedAt, orders, revenue, cost, profit, discounts, itemsSold, avgTicket, items[] }],
  monthly:    { "2026-09": { ...تقرير الشهر } },   // أرشيف دائم
  prunedBefore, maintainedAt
}
```
حالات الطلب: `new → preparing → ready → served → paid` أو `cancelled`.

## 5. المطلوب منك

### أ) السيرفر والدومين
1. سيرفر Linux (VPS) عليه **Node 22+**، والمشروع بيشتغل بـ `npm ci && npm start` (أو PM2 / systemd).
2. **Reverse proxy** (Caddy أسهل، أو Nginx) مع **HTTPS** (Let's Encrypt) للدومين.
   - لازم يمرّر **WebSocket** لـ Socket.io (`Upgrade` و `Connection` headers).
   - `app.set('trust proxy', 1)` بـ index.js لما يصير في proxy (عشان حدود الطلبات تشوف IP الزبون الحقيقي).
3. متغيرات البيئة (ملف `.env`، **ما بينرفع للـ git أبداً**):

| المتغير | ضروري؟ | ملاحظة |
|---|---|---|
| `PORT` | لا | الافتراضي 3000 |
| `GEMINI_API_KEY` | لا | نديم الذكي (مجاني من aistudio.google.com) |
| `GEMINI_MODEL`, `GEMINI_THINKING` | لا | |
| `ANTHROPIC_API_KEY`, `CLAUDE_MODEL` | لا | بديل Gemini |
| `DATABASE_URL` | **جديد** | انت بتضيفه لـ PostgreSQL |

4. **أول تشغيل**: السيرفر بيطبع **رمز إعداد المنصة** بالـ console. بيفتحوا `/platform` وبيعملوا أول حساب فيه، وبعدها الشريك بينضاف من "الفريق".

### ب) قاعدة البيانات (PostgreSQL)
في `docs/schema.sql` اقتراح جاهز على مرحلتين:

**المرحلة 1 (أسرع وآمنة، بنصح فيها أول):**
- جدول `tenant_state` فيه state كل محل كـ **JSONB** (صف لكل محل)، وجداول حقيقية لـ `platform_users` و `tenants` و `sessions`.
- بتبدّل بس **`db.js`** و **`platform-store.js`**، وباقي الكود ما بيتغيّر:
  - `readTenant(id)` ← `SELECT state FROM tenant_state WHERE tenant_id = $1`
  - `writeNow(id)` ← `INSERT … ON CONFLICT (tenant_id) DO UPDATE SET state = $2, updated_at = now()`
- ⚠️ **`db()` متزامنة** و pg غير متزامن. الحل: حمّل المحل قبل ما يدخل الطلب:
  ```js
  // index.js قبل withTenant(...):
  await ensureLoaded(tid);   // بيعمل SELECT مرة وحدة وبيحط state بالـ Map
  ```
  وبـ `io.on('connection')` و platform.js (الإحصائيات بتمر على كل المحلات) نفس الاشي. الكتابة بتضل مجمّعة (debounce) بس صارت `await pool.query(...)`.
- الجلسات تنتقل لجدول `sessions` (أو Redis) عشان ما تروح مع إعادة التشغيل.

**المرحلة 2 (لما يكبر الشغل):** جداول مفصّلة (`orders`، `order_lines`، `items`…). هاي بدها تعديل بـ `logic.js` و `core.js` لأنهم بيعدّلوا على objects بالذاكرة. موجودة بـ schema.sql كتصميم مقترح.

> **ملاحظة مهمة**: لأن البيانات بالذاكرة، لازم **نسخة وحدة بس** من السيرفر تشتغل (instance واحد). إذا بدكم أكتر من نسخة، لازم المرحلة 2 أو قفل لكل محل.

### ج) نقل البيانات الحالية
- `data/platform.json` ← `platform_users` + `tenants`.
- كل `data/tenants/<id>.json` ← صف بـ `tenant_state`.
- سكربت بسيط: اقرأ الملفات و INSERT. لوحة الكاشير فيها كمان "نزّل نسخة احتياطية" (JSON بنفس الشكل).

### د) الصور المرفوعة
`public/uploads/` (صور الأصناف اللي بيرفعها صاحب المحل). على السيرفر لازم تكون **مجلد دائم** أو تنتقل لـ object storage (S3 / Cloudflare R2). الكود بمكان واحد: `hooks.saveUpload` بـ `server/index.js`.

### هـ) النسخ الاحتياطي
`pg_dump` يومي على الأقل، ونسخة برّا السيرفر.

## 6. قائمة الـ API

كل مسارات المحل تحت `/api/t/<id>` (و `/api` القديم = محل 1001). مسارات `admin/*` بدها header `x-admin-token`.
المحل المجمّد بيرجع **423** لكل شي. المحل مش موجود: **404**.

**الزبون:**
`GET /menu` · `GET /weather` · `GET /tables/:n` · `GET /tables/:n/bill` · `GET /devices/:id/orders` · `POST /orders` · `GET /orders/:id` · `POST /tables/:n/call` · `POST /barista`

**الكاشير:**
`POST /admin/login` · `POST /admin/logout` · `GET /admin/bootstrap` ·
`GET|POST /admin/orders` · `PATCH /admin/orders/:id` · `PUT /admin/orders/:id/lines` · `PATCH /admin/orders/:id/lines/:i` ·
`POST /admin/tables/:n/close` · `DELETE /admin/calls/:id` ·
`GET /admin/day` · `POST /admin/day/close` · `GET /admin/days` · `GET /admin/days/:id` · `GET /admin/stats` · `GET /admin/months` · `GET /admin/months/:key` · `GET /admin/table-insight/:n` ·
`POST|PUT|DELETE /admin/categories[/:id]` · `PUT /admin/categories-order` · `POST|PUT|DELETE /admin/items[/:id]` · `POST|PUT|DELETE /admin/offers[/:id]` · `POST|PUT|DELETE /admin/zones[/:id]` · `PUT /admin/tables` · `PUT /admin/tables/:n` ·
`PUT /admin/settings` · `POST /admin/menu-template` · `GET /admin/geocode` · `POST /admin/upload` · `GET /admin/backup` · `POST /admin/restore` · `POST /admin/demo/clear`

**المنصة** (`/api/platform`، header `x-platform-token`):
`GET /info` · `POST /setup` · `POST /login` · `POST /logout` · `GET /me` · `POST /me/password` ·
`GET|POST /tenants` · `PATCH /tenants/:id` · `POST /tenants/:id/freeze` · `POST /tenants/:id/unfreeze` · `POST /tenants/:id/pin` · `POST /tenants/:id/session` ·
`GET|POST /users` · `DELETE /users/:id`

**Socket.io**: الاتصال بـ `io({ query: { tenant: '1001' }, auth: { token } })`. الغرف: `<id>:all`، `<id>:admin`، `<id>:order:<orderId>`. الأحداث: للكاشير `order:new` و`order:update` و`call:new` و`call:resolved` و`day:closed`، للكل `menu:changed` و`tenant:frozen`، ولغرفة الطلب تحديثات حالته.

## 7. أمان: أشياء لازم تنتبهلها

- `.env` ومجلد `data/` **ما بينرفعوا** للـ git (موجودين بـ `.gitignore`).
- رمز الكاشير (`settings.adminPin`) محفوظ نص عادي، وبنصح يصير hash زي كلمات سر المنصة.
- حدود الطلبات (rate limit) بالذاكرة. مع proxy لازم `trust proxy`.
- CORS مش مفعّل (الواجهة والـ API من نفس الدومين)، وخلّوه هيك.

## 8. التشغيل محلياً

```bash
npm install
npm start
```
بعدها: `http://localhost:3000/platform` (رمز الإعداد بيطلع بالـ console أول مرة)، و `http://localhost:3000/1001` للزبون، و `http://localhost:3000/1001/admin` للكاشير (الرمز الافتراضي 1234).
