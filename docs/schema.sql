-- إيلاف — تصميم مقترح لقاعدة بيانات PostgreSQL 15+
-- شوف docs/HANDOVER.md للشرح. المرحلة 1 كافية للتشغيل؛ المرحلة 2 لما يكبر الشغل.

-- ═════════════════════════════════════════════
-- المرحلة 1: المنصة + بيانات كل محل كـ JSONB
-- (بتبدّل بس server/db.js وتخزين server/platform.js)
-- ═════════════════════════════════════════════

-- أصحاب المنصة (الشركاء)
CREATE TABLE platform_users (
  id          text PRIMARY KEY,                 -- نفس id الموجود بـ platform.json
  username    text NOT NULL UNIQUE,
  name        text NOT NULL,
  salt        text NOT NULL,                    -- scrypt salt (hex)
  hash        text NOT NULL,                    -- scrypt hash (hex)
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  text
);

-- المحلات (كافيهات ومطاعم)
CREATE TABLE tenants (
  id             text PRIMARY KEY CHECK (id ~ '^\d{3,8}$'),   -- '1001'، '1002'…
  name           text NOT NULL,
  type           text NOT NULL DEFAULT 'cafe' CHECK (type IN ('cafe', 'restaurant')),
  owner_name     text NOT NULL DEFAULT '',
  owner_phone    text NOT NULL DEFAULT '',
  status         text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),  -- suspended = مجمّد
  frozen_at      timestamptz,
  frozen_by      text,
  frozen_reason  text,
  notes          text NOT NULL DEFAULT '',
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     text
);
-- رقم المحل الجاي (بدل nextId بـ platform.json)
CREATE SEQUENCE tenant_id_seq START 1002;

-- كل بيانات المحل (settings, categories, items, offers, zones, tables, orders, calls, days, monthly…)
-- نفس شكل data/tenants/<id>.json بالضبط
CREATE TABLE tenant_state (
  tenant_id   text PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  state       jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- جلسات الدخول (بدل الـ Map بالذاكرة)، عشان ما تروح لما السيرفر يرجع يشتغل
CREATE TABLE sessions (
  token       text PRIMARY KEY,
  kind        text NOT NULL CHECK (kind IN ('platform', 'cashier')),
  user_id     text REFERENCES platform_users(id) ON DELETE CASCADE,  -- لجلسات المنصة
  tenant_id   text REFERENCES tenants(id) ON DELETE CASCADE,         -- لجلسات الكاشير
  expires_at  timestamptz NOT NULL
);
CREATE INDEX sessions_expiry ON sessions (expires_at);
CREATE INDEX sessions_tenant ON sessions (tenant_id);   -- التجميد بيمسح جلسات المحل كلها

-- إعدادات عامة للمنصة (مثل رمز الإعداد لأول حساب)
CREATE TABLE platform_meta (
  key    text PRIMARY KEY,
  value  text NOT NULL
);

-- أمثلة على الاستعلامات اللي بدها db.js:
--   تحميل محل:  SELECT state FROM tenant_state WHERE tenant_id = $1;
--   حفظ محل:    INSERT INTO tenant_state (tenant_id, state) VALUES ($1, $2)
--               ON CONFLICT (tenant_id) DO UPDATE SET state = EXCLUDED.state, updated_at = now();
--   تجميد:      UPDATE tenants SET status = 'suspended', frozen_at = now(), frozen_by = $2, frozen_reason = $3 WHERE id = $1;
--               DELETE FROM sessions WHERE kind = 'cashier' AND tenant_id = $1;


-- ═════════════════════════════════════════════
-- المرحلة 2 (لاحقاً): جداول مفصّلة بدل JSONB
-- بدها تعديل بـ logic.js و core.js (هلأ بيعدّلوا objects بالذاكرة)
-- ═════════════════════════════════════════════
/*
CREATE TABLE settings (
  tenant_id      text PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  cafe_name      text NOT NULL,
  brand_word     text NOT NULL,
  tagline        text NOT NULL DEFAULT '',
  business_type  text NOT NULL DEFAULT 'cafe',
  currency       text NOT NULL DEFAULT '₪',
  currency_name  text NOT NULL DEFAULT 'شيكل',
  city           text, lat numeric(8,5), lon numeric(8,5),
  admin_pin_hash text NOT NULL,                 -- بنصح بالـ hash بدل النص العادي
  barista_name   text NOT NULL DEFAULT 'نديم',
  wifi text, hours text, cafe_notes text,
  day_opened_at  timestamptz
);

CREATE TABLE categories (
  tenant_id text REFERENCES tenants(id) ON DELETE CASCADE,
  id text, name text NOT NULL, en text, "desc" text, temp text, icon text, image text, sort int,
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE items (
  tenant_id text REFERENCES tenants(id) ON DELETE CASCADE,
  id text, category_id text NOT NULL,
  name text NOT NULL, "desc" text, recipe text,
  price numeric(10,2) NOT NULL, cost numeric(10,2) NOT NULL DEFAULT 0,
  stock int,                                    -- NULL = مش متتبّع بالمخزن
  available boolean NOT NULL DEFAULT true,
  image text, art text, hue int, sugar smallint, caffeine smallint, sugar_choice boolean, tags text[], sort int,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, category_id) REFERENCES categories (tenant_id, id)
);

CREATE TABLE offers (
  tenant_id text REFERENCES tenants(id) ON DELETE CASCADE,
  id text, type text CHECK (type IN ('combo', 'discount')), title text, description text,
  item_ids text[] NOT NULL, price numeric(10,2), percent numeric(5,2), active boolean,
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE zones (
  tenant_id text REFERENCES tenants(id) ON DELETE CASCADE,
  id text, name text, description text,
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE tables (
  tenant_id text REFERENCES tenants(id) ON DELETE CASCADE,
  number int, zone_id text, seats int, session_id text, session_at timestamptz,
  PRIMARY KEY (tenant_id, number)
);

CREATE TABLE orders (
  tenant_id text REFERENCES tenants(id) ON DELETE CASCADE,
  id text, no int NOT NULL,                     -- رقم الطلب باليوم
  table_no int NOT NULL,                        -- 0 = طلب خارجي (takeaway)
  takeaway_name text, takeaway_phone text,
  zone_name text, session_id text, device text,
  subtotal numeric(10,2), discount numeric(10,2), manual_discount numeric(10,2), total numeric(10,2), cost numeric(10,2),
  note text, status text NOT NULL CHECK (status IN ('new','preparing','ready','served','paid','cancelled')),
  source text, edited boolean DEFAULT false, stock_taken jsonb, demo boolean DEFAULT false,
  created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX orders_open ON orders (tenant_id, status) WHERE status IN ('new','preparing','ready','served');
CREATE INDEX orders_time ON orders (tenant_id, created_at);

CREATE TABLE order_lines (
  tenant_id text, order_id text, line_no int,
  kind text CHECK (kind IN ('item', 'offer')), ref_id text, name text,
  unit_price numeric(10,2), qty int, line_total numeric(10,2), unit_cost numeric(10,2),
  options jsonb, note text,
  PRIMARY KEY (tenant_id, order_id, line_no),
  FOREIGN KEY (tenant_id, order_id) REFERENCES orders (tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE order_history (
  tenant_id text, order_id text, status text, at timestamptz, edited boolean,
  FOREIGN KEY (tenant_id, order_id) REFERENCES orders (tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE calls (
  tenant_id text REFERENCES tenants(id) ON DELETE CASCADE,
  id text, table_no int, kind text, at timestamptz,
  PRIMARY KEY (tenant_id, id)
);

-- تقارير الأيام والشهور (ملخصات محفوظة للأبد)
CREATE TABLE day_reports (
  tenant_id text REFERENCES tenants(id) ON DELETE CASCADE,
  id text, opened_at timestamptz, closed_at timestamptz, summary jsonb NOT NULL, demo boolean,
  PRIMARY KEY (tenant_id, id)
);
CREATE TABLE month_reports (
  tenant_id text REFERENCES tenants(id) ON DELETE CASCADE,
  month text,                                    -- '2026-09'
  summary jsonb NOT NULL,
  PRIMARY KEY (tenant_id, month)
);
*/
