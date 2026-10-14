// ربط الأجهزة بنسخة العرض (بدون سيرفر): لوحة الكاشير بتشتغل كأنها هي السيرفر.
// الزبون بيبعت طلبه كرسالة صغيرة عبر وسيط MQTT عام ومجاني (ما بدّه حساب)، واللوحة بتنفّذه بنفس core.js وبترد عليه.
// - كود المحل ثابت ومحسوب من رابط الموقع، فرابط الزبائن والـ QR ما بيتغيّروا مهما فتحت اللوحة من أي جهاز.
// - جهاز واحد بس هو "الكاشير" بأي لحظة، وأي لوحة ثانية بتستنى وبتقدر تاخد الدور بكبسة.
// - الطلب والنداء بينحفظوا على الوسيط إذا الكاشير مش فاتح، وبيوصلوه أول ما يفتح اللوحة.
// اللوحة متصلة بوسيطين مع بعض، والزبون بيستعمل أول واحد بيرد، فإذا وقع واحد بيضل التاني شغّال.

export const BROKERS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt'];
const ROOT = 'cafe-mohammad/v1/';
const KEEPALIVE = 120; // ثانية، التبويب المخفي بيبطّئ المؤقتات فبنعطي مهلة واسعة

const enc = new TextEncoder();
const dec = new TextDecoder();

/** نص عشوائي قصير بحروف وأرقام ما بتتلخبط ببعض */
export function randomId(n = 12) {
  const abc = 'abcdefghijkmnpqrstuvwxyz23456789';
  return [...crypto.getRandomValues(new Uint8Array(n))].map((x) => abc[x % 32]).join('');
}
export const cleanCode = (c) => String(c ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24);

/** كود المحل من رابط الموقع نفسه (نفس الكود للوحة والزبون على أي جهاز) */
export function siteCode(loc = location) {
  const key = `${loc.host}${loc.pathname.replace(/[^/]*$/, '')}`.toLowerCase();
  let a = 0x811c9dc5;
  let b = 0x9e3779b9;
  for (const ch of key) {
    const c = ch.codePointAt(0);
    a = Math.imul(a ^ c, 16777619) >>> 0;
    b = Math.imul(b ^ c, 2246822519) >>> 0;
  }
  const abc = 'abcdefghijkmnpqrstuvwxyz23456789';
  let out = 's';
  for (let i = 0; i < 6; i++) { out += abc[a % 32] + abc[b % 32]; a = Math.floor(a / 32); b = Math.floor(b / 32); }
  return out;
}

function join(parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) { out.set(p, i); i += p.length; }
  return out;
}
const u16 = (n) => Uint8Array.of(n >> 8, n & 255);
const utf8 = (s) => { const b = enc.encode(s); return join([u16(b.length), b]); };
function packet(first, ...parts) {
  const body = join(parts);
  const len = [];
  let n = body.length;
  do { let d = n % 128; n = Math.floor(n / 128); if (n) d |= 128; len.push(d); } while (n);
  return join([Uint8Array.of(first, ...len), body]);
}

/** عميل MQTT 3.1.1 صغير فوق WebSocket: نشر واشتراك بجودة 0، رسائل محفوظة، ووصية بتنبعت إذا انقطع */
export class MqttLink {
  constructor(url, { clientId, will = null, onMessage = () => {}, onState = () => {} }) {
    Object.assign(this, { url, clientId, will, onMessage, onState });
    this.subs = new Set();
    this.connected = false;
    this.closed = false;
    this.retry = 1000;
    this.packetId = 0;
    this.open();
  }

  open() {
    if (this.closed) return;
    let ws;
    try { ws = new WebSocket(this.url, 'mqtt'); } catch { this.later(); return; }
    ws.binaryType = 'arraybuffer';
    this.ws = ws;
    this.buf = new Uint8Array(0);
    ws.onopen = () => {
      let flags = 0x02; // جلسة نظيفة
      const payload = [utf8(this.clientId)];
      if (this.will) {
        flags |= 0x04 | 0x20; // وصية محفوظة: "الكاشير طلع" لما ينقطع الاتصال
        const msg = enc.encode(JSON.stringify(this.will.payload));
        payload.push(utf8(this.will.topic), u16(msg.length), msg);
      }
      ws.send(packet(0x10, utf8('MQTT'), Uint8Array.of(4, flags), u16(KEEPALIVE), ...payload));
    };
    ws.onmessage = (e) => this.read(new Uint8Array(e.data));
    ws.onerror = () => { try { ws.close(); } catch { /* */ } };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      clearInterval(this.ping);
      const was = this.connected;
      this.connected = false;
      if (was) this.onState(false);
      this.later();
    };
  }

  /** لما ترجع الصفحة قدّام المستخدم: إذا الاتصال واقع بنعيده هلق بدل ما نستنى دور المحاولة */
  kick() {
    if (this.closed || this.connected) return;
    if (this.ws && this.ws.readyState < 2) return; // لسا عم يتصل
    clearTimeout(this.timer);
    this.retry = 1000;
    this.open();
  }

  later() {
    if (this.closed) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.open(), this.retry);
    this.retry = Math.min(this.retry * 2, 30_000);
  }

  /** الرسائل ممكن توصل مقطّعة أو كذا وحدة بنفس الإطار */
  read(chunk) {
    this.buf = this.buf.length ? join([this.buf, chunk]) : chunk;
    for (;;) {
      if (this.buf.length < 2) return;
      let len = 0;
      let mul = 1;
      let i = 1;
      let byte;
      do {
        if (i >= this.buf.length) return;
        byte = this.buf[i++];
        len += (byte & 127) * mul;
        mul *= 128;
      } while (byte & 128);
      if (this.buf.length < i + len) return;
      const first = this.buf[0];
      const body = this.buf.subarray(i, i + len);
      this.buf = this.buf.slice(i + len);
      this.handle(first, body);
    }
  }

  handle(first, body) {
    const kind = first >> 4;
    if (kind === 2) { // CONNACK
      if (body[1] !== 0) { this.ws.close(); return; }
      this.connected = true;
      this.retry = 1000;
      clearInterval(this.ping);
      this.ping = setInterval(() => this.raw(Uint8Array.of(0xc0, 0)), (KEEPALIVE / 3) * 1000);
      if (this.subs.size) this.sendSubscribe([...this.subs]);
      this.onState(true);
    } else if (kind === 3) { // PUBLISH
      const tlen = (body[0] << 8) | body[1];
      const topic = dec.decode(body.subarray(2, 2 + tlen));
      const start = 2 + tlen + (((first >> 1) & 3) ? 2 : 0);
      const text = dec.decode(body.subarray(start));
      if (!text) return; // رسالة محفوظة انمسحت
      let data;
      try { data = JSON.parse(text); } catch { return; }
      try { this.onMessage(topic, data); } catch (err) { console.error(err); }
    }
  }

  raw(bytes) {
    if (!this.connected || this.ws?.readyState !== 1) return false;
    this.ws.send(bytes);
    return true;
  }

  sendSubscribe(topics) {
    this.packetId = (this.packetId % 65535) + 1;
    this.raw(packet(0x82, u16(this.packetId), ...topics.flatMap((t) => [utf8(t), Uint8Array.of(0)])));
  }

  subscribe(topic) {
    if (this.subs.has(topic)) return;
    this.subs.add(topic);
    if (this.connected) this.sendSubscribe([topic]);
  }

  unsubscribe(topic) {
    if (!this.subs.delete(topic)) return;
    this.packetId = (this.packetId % 65535) + 1;
    this.raw(packet(0xa2, u16(this.packetId), utf8(topic)));
  }

  /** بيمسح رسالة محفوظة على الوسيط (رسالة فاضية محفوظة) */
  clear(topic) {
    return this.raw(packet(0x31, utf8(topic)));
  }

  /** إعادة اتصال سريعة (مثلاً لتغيير الوصية) */
  reconnect() {
    if (this.closed) return;
    this.retry = 300;
    if (this.ws && this.ws.readyState < 2) { try { this.ws.close(); } catch { /* */ } } else this.kick();
  }

  publish(topic, data, { retain = false } = {}) {
    return this.raw(packet(0x30 | (retain ? 1 : 0), utf8(topic), enc.encode(JSON.stringify(data))));
  }

  close() {
    this.closed = true;
    this.onState = () => {};
    this.onMessage = () => {};
    clearTimeout(this.timer);
    clearInterval(this.ping);
    try { this.ws?.close(); } catch { /* */ }
  }
}

// ───────── جهة الكاشير ─────────
// presence (محفوظة على base/admin): { online, id, since, at } — id للجهاز، since لحظة ما صار كاشير، at آخر نبضة.
const BEAT = 30_000;          // نبضة "أنا هون" كل 30 ثانية
const HANDOVER = 10 * 60_000; // إذا الكاشير غايب 10 دقايق، أي لوحة مفتوحة بتاخد الدور لحالها

/**
 * serve(msg) → { id, status, data } أو null · snapshot() → المنيو الحالي (بينحفظ على الوسيط للي بيفتح جديد)
 * onState({ connected, active, presence }) — active يعني هالجهاز هو الكاشير هلق
 */
export function createHost({ code, hostId, serve, snapshot, onState = () => {}, handover = HANDOVER }) {
  const base = ROOT + code;
  const QUEUE = base + '/q/+/+';
  const will = { topic: base + '/admin', payload: { online: false, id: hostId } };
  let active = false;
  let decided = false;
  let since = 0;
  let presence = null; // آخر حالة شفناها على الوسيط
  let offlineSeen = null; // من إيمتى شايفين الكاشير طالع (الوصية ما فيها وقت)
  const report = () => onState({ connected: links.filter((l) => l.connected).length, active, presence });
  const mine = () => ({ online: true, id: hostId, since, at: Date.now() });
  const announce = () => links.forEach((l) => l.publish(base + '/admin', mine(), { retain: true }));

  const links = BROKERS.map((url) => {
    const link = new MqttLink(url, {
      clientId: 'cmh' + randomId(14),
      onState: async (up) => {
        report();
        if (!up) return;
        if (!decided) { setTimeout(decide, 1500); return; }
        if (active) {
          link.publish(base + '/admin', mine(), { retain: true });
          link.publish(base + '/menu', await snapshot(), { retain: true });
        }
      },
      onMessage: async (topic, msg) => {
        if (topic === base + '/admin') { onPresence(msg); return; }
        if (!active) return;
        const queued = topic.startsWith(base + '/q/');
        if (topic !== base + '/req' && !queued) return;
        const res = await serve(msg);
        if (queued) link.clear(topic); // انخدم، بنشيله من الطابور
        if (!res) return;
        const out = `${base}/r/${msg.from}/${msg.id}`;
        // رد الطلب المحفوظ بيضل محفوظ على الوسيطين، عشان يوصل للزبون حتى لو سكّر الصفحة ورجع
        if (queued) links.forEach((l) => l.publish(out, res, { retain: true }));
        else link.publish(out, res);
      },
    });
    link.subscribe(base + '/admin');
    return link;
  });

  /** أول ما نتصل: منقرر إذا هالجهاز هو الكاشير */
  function decide() {
    if (decided) return;
    decided = true;
    const p = presence;
    // أول ما تنفتح اللوحة: بتصير الكاشير إذا ما في كاشير، أو كانت هي نفسها، أو الكاشير طالع/ساكت من زمان
    if (!p || p.id === hostId || !p.online || Date.now() - (p.at ?? 0) > handover) activate();
    else report();
  }
  function activate() {
    active = true;
    since = Date.now();
    // الوصية بتنحط وقت الاتصال، فبنعيد الاتصال معها
    links.forEach((l) => { l.will = will; l.subscribe(base + '/req'); l.subscribe(QUEUE); l.reconnect(); });
    report();
  }
  function standby() {
    active = false;
    links.forEach((l) => { l.will = null; l.unsubscribe(base + '/req'); l.unsubscribe(QUEUE); l.reconnect(); });
    report();
  }
  function onPresence(msg) {
    presence = msg;
    if (msg.online) offlineSeen = null; else offlineSeen ??= Date.now();
    if (active && msg.id !== hostId) {
      // جهاز ثاني أخد الدور بعدي (كبسة "خلّي هالجهاز هو الكاشير"): بتنحّى
      if (msg.online && (msg.since > since || (msg.since === since && msg.id > hostId))) { standby(); return; }
      // حدا كتب فوق حالتي (وصية قديمة أو كاشير أقدم): برجع بثبّتها
      announce();
    }
    report();
  }

  setInterval(() => {
    if (active) announce();
    // لوحة مفتوحة وبتستنى: بتاخد الدور إذا الكاشير غاب فترة (مش فوراً، عشان جوال الكاشير ممكن يكون بالخلفية شوي)
    else if (decided && (!presence || (presence.online ? Date.now() - (presence.at ?? 0) : Date.now() - (offlineSeen ?? Date.now())) > handover)) activate();
  }, Math.min(BEAT, handover / 2));

  return {
    code,
    get active() { return active; },
    get online() { return links.some((l) => l.connected); },
    takeover() { if (!active) activate(); },
    /** للتجارب: بيقطع الاتصال (الوسيط بيبعت الوصية "الكاشير طلع") */
    stop() { links.forEach((l) => l.close()); },
    wake() {
      links.forEach((l) => l.kick());
      if (active) announce();
    },
    /** حدث مباشر للزباين: للكل أو لصاحب طلب معيّن (أحداث الكاشير ما بتطلع برّا) */
    event(ev) {
      if (!active) return;
      const room = ev.room ?? null;
      const topic = room === null ? base + '/ev/all' : room.startsWith('order:') ? `${base}/ev/o/${room.slice(6)}` : null;
      if (topic) links.forEach((l) => l.publish(topic, ev));
    },
    async refreshMenu() {
      if (!active) return;
      const menu = await snapshot();
      links.forEach((l) => l.publish(base + '/menu', menu, { retain: true }));
    },
  };
}

// ───────── جهة الزبون ─────────
const LIVE = 150_000; // إذا ما في نبضة من الكاشير من دقيقتين ونص، بنعتبره مش فاتح

/**
 * بيتصل بكل الوسطاء مع بعض وبيكمّل مع أول واحد بيرد.
 * me: معرّف ثابت للجهاز (عشان رد الطلب المحفوظ يوصله حتى بعد ما يسكّر الصفحة ويرجع)
 * request(..., { queue }) — الطلب والنداء (queue) بينحفظوا على الوسيط إذا الكاشير مش فاتح، وبيرمي { queued, reqId }
 * onLate(reqId, res): رد وصل بعد ما انحفظ الطلب · onStatus: 'connecting' | 'online' | 'offline'
 */
export function createClient({ code, me, onEvent = () => {}, onStatus = () => {}, onLate = () => {} }) {
  const base = ROOT + code;
  const pending = new Map();
  const tracked = new Set();
  let links = [];
  let link = null;
  let swap = null;
  let admin = null;
  let menu = null;
  let isReady = false;
  let markReady;
  const ready = new Promise((r) => { markReady = () => { isReady = true; r(); report(); }; });

  const hostLive = () => admin?.online === true && Date.now() - (admin.at ?? 0) < LIVE;
  const status = () => (!link?.connected ? 'connecting' : hostLive() ? 'online' : isReady ? 'offline' : 'connecting');
  let last = null;
  function report() {
    const st = status();
    if (st !== last) { last = st; onStatus(st); }
  }
  setInterval(report, 15_000); // النبضة ممكن تقدم مع الوقت

  function onMessage(topic, msg) {
    if (topic === base + '/admin') { admin = msg; report(); }
    else if (topic === base + '/menu') menu = msg;
    else if (topic.startsWith(`${base}/r/${me}/`)) {
      const id = topic.slice(topic.lastIndexOf('/') + 1);
      link.clear(topic); // وصلنا، بنشيله عن الوسيط
      const done = pending.get(id);
      if (done) done(msg); else onLate(id, msg);
    } else if (topic.startsWith(base + '/ev/')) onEvent(msg);
    if (admin && menu) markReady();
  }

  const topics = () => [base + '/admin', base + '/menu', `${base}/r/${me}/+`, base + '/ev/all', ...[...tracked].map((id) => `${base}/ev/o/${id}`)];

  function race() {
    links.forEach((l) => l.close());
    link = null;
    clearTimeout(swap);
    links = BROKERS.map((url) => {
      const l = new MqttLink(url, {
        clientId: 'cmc' + me + randomId(4),
        onMessage: (t, m) => { if (l === link) onMessage(t, m); },
        onState: (up) => {
          if (up && !link) {
            link = l;
            links.filter((x) => x !== l).forEach((x) => x.close());
            setTimeout(markReady, 1500);
          } else if (l === link && !up) {
            clearTimeout(swap);
            swap = setTimeout(() => { if (!l.connected) race(); }, 8000);
          }
          report();
        },
      });
      topics().forEach((t) => l.subscribe(t));
      return l;
    });
    report();
  }
  race();

  const offline = (why, extra = {}) => Object.assign(new Error(why), { offline: true }, extra);
  return {
    get menu() { return menu; },
    get adminOnline() { return hostLive(); },
    get status() { return status(); },
    async whenReady(ms = 7000) {
      await Promise.race([ready, new Promise((r) => setTimeout(r, ms))]);
    },
    wake() {
      if (!link) links.forEach((l) => l.kick());
      else if (!link.connected) link.kick();
      report();
    },
    /** للتجارب: كأن الصفحة تسكّرت */
    close() { clearTimeout(swap); links.forEach((l) => l.close()); },
    track(ids) {
      for (const id of [].concat(ids)) {
        if (typeof id !== 'string' || tracked.has(id)) continue;
        tracked.add(id);
        (link ? [link] : links).forEach((l) => l.subscribe(`${base}/ev/o/${id}`));
      }
    },
    async request(method, path, body, { timeout = 12_000, queue = false } = {}) {
      await this.whenReady();
      if (!link?.connected) throw offline('network');
      if (!queue && !hostLive()) throw offline('admin');
      const id = randomId(10);
      return new Promise((resolve, reject) => {
        // الطلب المحفوظ ما بنستنى عليه كتير إذا الكاشير مش فاتح: بيضل محفوظ وبيوصلنا رده بعدين
        const wait = queue && !hostLive() ? 2500 : timeout;
        const t = setTimeout(() => {
          pending.delete(id);
          admin = { ...(admin ?? {}), online: false }; // الكاشير ما رد: غالباً لوحته بالخلفية
          report();
          reject(offline(queue ? 'queued' : 'timeout', queue ? { queued: true, reqId: id } : {}));
        }, wait);
        pending.set(id, (msg) => { clearTimeout(t); pending.delete(id); resolve(msg); });
        const topic = queue ? `${base}/q/${me}/${id}` : base + '/req';
        if (!link.publish(topic, { id, from: me, method, path, body: body ?? null }, { retain: queue })) {
          clearTimeout(t);
          pending.delete(id);
          reject(offline('network'));
        }
      });
    },
  };
}
