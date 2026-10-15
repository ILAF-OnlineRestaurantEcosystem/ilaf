// الرسومات: الدلّة والشعار المتحرك + رسومات الأصناف + أيقونات الواجهة
// كل الرسومات SVG مكتوبة باليد لتبقى خفيفة وحادّة على كل الشاشات

let gid = 0;
const nextId = (p) => `${p}${++gid}`;

/** الدلّة النحاسية — مرسومة واقفة، ونقطة الارتكاز عند قاعدتها (60,128) */
export function dallahShape(gradId, darkId) {
  return `
    <path d="M42 102C26 94 15 76 7 52c-1-3 2.5-4.5 4.5-2C21 70 32 84 47 90z" fill="url(#${gradId})" stroke="#5c4115" stroke-width="1.2"/>
    <path d="M76 72c22-2 28 26 10 44" fill="none" stroke="url(#${gradId})" stroke-width="5.5" stroke-linecap="round"/>
    <path d="M76 72c22-2 28 26 10 44" fill="none" stroke="#5c4115" stroke-width="1" stroke-linecap="round" opacity=".5"/>
    <path d="M38 128C27 114 28 98 44 86c5-4 6-12 2-19h28c-4 7-3 15 2 19 16 12 17 28 6 42z" fill="url(#${gradId})" stroke="#5c4115" stroke-width="1.2"/>
    <path d="M44 86h32M41 91h38" stroke="#5c4115" stroke-width="1.1" opacity=".75"/>
    <path d="M33 112c18 5 36 5 54 0" stroke="#fff3cf" stroke-width="1.4" opacity=".45" fill="none"/>
    <path d="M49 96c-3 8-3 18 1 26" stroke="#fff3cf" stroke-width="2.4" opacity=".35" fill="none" stroke-linecap="round"/>
    <path d="M35 128h50l-3 6H38z" fill="url(#${darkId})"/>
    <path d="M44 67c2-13 10-19 16-29 6 10 14 16 16 29z" fill="url(#${gradId})" stroke="#5c4115" stroke-width="1.2"/>
    <path d="M52 58c3-5 5-9 8-14" stroke="#fff3cf" stroke-width="1.6" opacity=".45" fill="none" stroke-linecap="round"/>
    <path d="M41 67h38" stroke="#5c4115" stroke-width="3" stroke-linecap="round"/>
    <path d="M41 67h38" stroke="url(#${gradId})" stroke-width="1.6" stroke-linecap="round"/>
    <circle cx="60" cy="34" r="4.2" fill="url(#${gradId})" stroke="#5c4115" stroke-width="1"/>`;
}

function brassDefs(gradId, darkId) {
  return `
    <linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#6e4f1d"/><stop offset=".3" stop-color="#d9b46c"/>
      <stop offset=".5" stop-color="#f6e3b4"/><stop offset=".72" stop-color="#c79a4f"/><stop offset="1" stop-color="#5e4217"/>
    </linearGradient>
    <linearGradient id="${darkId}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#4a3312"/><stop offset=".5" stop-color="#a77d38"/><stop offset="1" stop-color="#4a3312"/>
    </linearGradient>`;
}

/** الدلّة لحالها (للأيقونات وزر الباريستا) */
// ───────── هوية المطعم: قدرة فخار (أيقونة) ومغرفة نحاس بتصب (الشعار الكبير) ─────────
let BIZ = 'cafe';
/** نوع المحل بيغيّر رسمة الهوية: كافيه = دلّة، مطعم = قدرة ومغرفة */
export function setBusiness(kind) { BIZ = kind === 'restaurant' ? 'restaurant' : 'cafe'; }
export const isRestaurant = () => BIZ === 'restaurant';

export function potShape(gradId) {
  return `
    <path d="M44 30c-6-8 6-12 0-20M58 26c-6-8 6-12 0-20M72 30c-6-8 6-12 0-20" fill="none" stroke="#c9a056" stroke-width="3" stroke-linecap="round" opacity=".75"/>
    <circle cx="58" cy="44" r="6" fill="url(#${gradId})" stroke="#6b2e14" stroke-width="1.2"/>
    <path d="M24 62Q58 38 92 62z" fill="url(#${gradId})" stroke="#6b2e14" stroke-width="1.4"/>
    <path d="M22 66h72c6 30-4 58-36 60-32-2-42-30-36-60z" fill="url(#${gradId})" stroke="#6b2e14" stroke-width="1.4"/>
    <path d="M22 74c-14 0-14 18 0 18M94 74c14 0 14 18 0 18" fill="none" stroke="url(#${gradId})" stroke-width="6" stroke-linecap="round"/>
    <path d="M24 84c20 6 48 6 68 0" fill="none" stroke="#fbe2c6" stroke-width="2" opacity=".5"/>
    <path d="M44 126h28l-4 8H48z" fill="#8a3b1c"/>`;
}
export function ladleShape(gradId, darkId) {
  // مغرفة مايلة بتصب من حافتها اليسار (عند نقطة الصب 405,125 بالشعار)
  return `
    <path d="M32 78C54 52 80 26 104 4" fill="none" stroke="url(#${gradId})" stroke-width="7" stroke-linecap="round"/>
    <path d="M32 78C54 52 80 26 104 4" fill="none" stroke="#5c4115" stroke-width="1" stroke-linecap="round" opacity=".4"/>
    <circle cx="107" cy="2" r="5" fill="none" stroke="url(#${gradId})" stroke-width="3.5"/>
    <path d="M-26 104L40 70C50 92 36 120 12 126C-6 130-22 120-26 104z" fill="url(#${gradId})" stroke="#5c4115" stroke-width="1.2"/>
    <path d="M-21 102L37 72" stroke="url(#${darkId})" stroke-width="3.5" stroke-linecap="round"/>
    <circle cx="-24" cy="106" r="3.2" fill="#d0713c"/>`;
}
const terraDefs = (id) => `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e8946a"/><stop offset=".45" stop-color="#c4643a"/><stop offset="1" stop-color="#7d3218"/></linearGradient>`;

export function dallahIcon() {
  const g = nextId('dg'), d = nextId('dd');
  if (BIZ === 'restaurant') return `<svg viewBox="0 0 112 140" aria-hidden="true"><defs>${terraDefs(g)}</defs>${potShape(g)}</svg>`;
  return `<svg viewBox="0 0 112 140" aria-hidden="true"><defs>${brassDefs(g, d)}</defs><g transform="translate(-4 2)">${dallahShape(g, d)}</g></svg>`;
}

/**
 * الشعار: الدلّة بتصب قهوة، والكلمة بتتعبّى من تحت لفوق.
 * mode: 'pour' (حركة كاملة) | 'static' (الشكل النهائي)
 * بعد إدراجه بالصفحة لازم تنادي fitLogo() ليتظبط حجم الكلمة ومستوى القهوة حسب الخط.
 */
export function brandLogo({ word = 'محمد', prefix = 'كافي', mode = 'pour' } = {}) {
  const g = nextId('lg'), d = nextId('ld'), coffee = nextId('cf'), clip = nextId('wc'), crema = nextId('cr');
  const safe = (s) => String(s).replace(/[<>&"]/g, '');
  const w = safe(word), p = safe(prefix);
  const wave = (y) => `M-300 ${y} q37.5 -14 75 0` + ' t75 0'.repeat(15);
  return `
<svg class="brand-logo is-waiting" data-mode="${mode}" viewBox="0 0 600 360" role="img" aria-label="${p} ${w}">
  <defs>
    ${brassDefs(g, d)}
    <linearGradient id="${coffee}" x1="0" y1="0" x2="0" y2="1">
      ${BIZ === 'restaurant'
        ? '<stop offset="0" stop-color="#f8d58a"/><stop offset=".06" stop-color="#e8a24a"/><stop offset=".45" stop-color="#c25a2c"/><stop offset="1" stop-color="#6e2412"/>'
        : '<stop offset="0" stop-color="#f3d7a2"/><stop offset=".06" stop-color="#d9a262"/><stop offset=".45" stop-color="#a8682f"/><stop offset="1" stop-color="#5b3216"/>'}
    </linearGradient>
    <linearGradient id="${crema}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#fbe7c0" stop-opacity="0"/><stop offset=".5" stop-color="#fbe7c0" stop-opacity=".9"/><stop offset="1" stop-color="#fbe7c0" stop-opacity="0"/>
    </linearGradient>
    <clipPath id="${clip}"><text class="logo-word-clip" x="262" y="300" text-anchor="middle" direction="rtl" font-family="Aref Ruqaa, Amiri, serif" font-weight="700" font-size="200">${w}</text></clipPath>
  </defs>

  <text class="logo-prefix" x="110" y="96" text-anchor="middle" direction="rtl" font-family="Aref Ruqaa, Amiri, serif" font-weight="700" font-size="60" fill="#a8834f">${p}</text>

  <text class="logo-word-shell" x="262" y="300" text-anchor="middle" direction="rtl" font-family="Aref Ruqaa, Amiri, serif" font-weight="700" font-size="200"
        fill="rgba(92,72,46,.045)" stroke="#a8834f" stroke-width="1.4" stroke-opacity=".6">${w}</text>

  <g clip-path="url(#${clip})">
    <g class="logo-liquid">
      <g class="logo-wave">
        <path class="logo-wave-fill" d="${wave(60)} V480 H-300z" fill="url(#${coffee})"/>
        <path class="logo-wave-crema" d="${wave(60)}" fill="none" stroke="url(#${crema})" stroke-width="5"/>
      </g>
    </g>
  </g>

  <path class="logo-stream" d="M405 125 C403 150 399 172 397 214" fill="none" stroke="${BIZ === 'restaurant' ? '#d0713c' : '#b47a3f'}" stroke-width="5.5" stroke-linecap="round" pathLength="100"/>
  <circle class="logo-splash" cx="397" cy="214" r="7" fill="none" stroke="#e8c48f" stroke-width="1.5"/>

  <g class="logo-steam" fill="none" stroke="#9a8166" stroke-width="2.4" stroke-linecap="round">
    <g><path d="M0 0c-8-12 8-18 0-32s6-20 0-30"/></g>
    <g><path d="M0 0c-8-12 8-18 0-32s6-20 0-30"/></g>
    <g><path d="M0 0c-8-12 8-18 0-32s6-20 0-30"/></g>
  </g>

  <g transform="translate(434 9) scale(1.1)">
    <g class="logo-dallah">${BIZ === 'restaurant' ? ladleShape(g, d) : dallahShape(g, d)}</g>
  </g>
</svg>`;
}

/** يقيس الكلمة بعد تحميل الخط ويضبط حجمها ومستوى القهوة ومكان الصبّ والبخار، ثم يشغّل الحركة */
export async function fitLogo(svg) {
  if (!svg) return;
  try { await document.fonts.load('700 200px "Aref Ruqaa"'); } catch { /* نكمل بالخط البديل */ }
  const shell = svg.querySelector('.logo-word-shell');
  const clipText = svg.querySelector('.logo-word-clip');
  // نقيس "حبر" الحروف الفعلي بالـ canvas (getBBox بيرجع صندوق الخط كامل مع فراغاته)
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = `700 200px "Aref Ruqaa", Amiri, serif`;
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  const m = ctx.measureText(shell.textContent);
  const L = m.actualBoundingBoxLeft, R = m.actualBoundingBoxRight, A = m.actualBoundingBoxAscent, D = m.actualBoundingBoxDescent;
  const k = Math.min(350 / (L + R), 235 / (A + D));
  const fs = 200 * k;
  const baseline = 348 - D * k;
  const x = 422 - R * k;
  for (const t of [shell, clipText]) { t.setAttribute('font-size', fs.toFixed(1)); t.setAttribute('x', x.toFixed(1)); t.setAttribute('y', baseline.toFixed(1)); }
  const bb = { x: x - L * k, y: baseline - A * k, width: (L + R) * k, height: (A + D) * k };
  const top = bb.y - 8;
  svg.querySelectorAll('.logo-wave-fill, .logo-wave-crema').forEach((p) => {
    p.setAttribute('d', p.getAttribute('d').replace(/^M-300 [\d.]+/, `M-300 ${top}`));
  });
  svg.style.setProperty('--fill-from', `${bb.height + 30}px`);
  // الصبّ ينزل لثلث الكلمة تقريباً
  const landY = Math.max(150, bb.y + bb.height * 0.32);
  svg.querySelector('.logo-stream').setAttribute('d', `M405 125 C403 ${125 + (landY - 125) * 0.4} 399 ${125 + (landY - 125) * 0.75} 397 ${landY}`);
  const splash = svg.querySelector('.logo-splash');
  splash.setAttribute('cy', landY);
  // البخار فوق الكلمة
  const steam = [...svg.querySelectorAll('.logo-steam > g')];
  steam.forEach((p, i) => p.setAttribute('transform', `translate(${bb.x + bb.width * (0.3 + i * 0.2)} ${bb.y - 6})`));
  // الكلمة "كافي" فوق يسار الكلمة
  const prefix = svg.querySelector('.logo-prefix');
  prefix.setAttribute('x', Math.max(70, bb.x + 30));
  prefix.setAttribute('y', Math.max(70, bb.y + 20));
  svg.classList.remove('is-waiting');
  svg.classList.add(svg.dataset.mode === 'static' ? 'is-static' : 'is-pour');
}

/** شعار مصغّر للهيدر: دلّة + اسم المحل */
export function brandMark(name = 'كافي محمد') {
  return `<span class="brand-mark">${dallahIcon()}<span class="brand-mark-name">${String(name).replace(/[<>&]/g, '')}</span></span>`;
}

// ───────── رسومات الأصناف (64×64، خط نحاسي) ─────────
const F = 'fill="currentColor" fill-opacity=".16"';
const DOT = 'fill="currentColor" stroke="none"';
const ITEM_ART = {
  espresso: `<path d="M20 30h22v5a11 11 0 0 1-22 0z" ${F}/><path d="M42 32.5h2.5a4 4 0 0 1 0 8H41"/><path d="M12 48c5 3.5 33 3.5 38 0"/><path d="M27 23c0-3 3-3 3-6M34 23c0-3 3-3 3-6"/>`,
  cup: `<path d="M14 28h32v6a16 16 0 0 1-32 0z" ${F}/><path d="M46 31h3a5.5 5.5 0 0 1 0 11h-5"/><path d="M10 53c6 4 38 4 44 0"/><path d="M24 28.5c2-3 5-3 6 0 1-3 4-3 6 0"/><path d="M26 20c0-3 3-3 3-6M34 20c0-3 3-3 3-6"/>`,
  turkish: `<path d="M12 24h18l-3 22a3 3 0 0 1-3 2.6h-6A3 3 0 0 1 15 46z" ${F}/><path d="M30 26l19-9"/><path d="M36 38h14l-1.5 9a4 4 0 0 1-4 3.4h-3a4 4 0 0 1-4-3.4z"/><path d="M33 54h20"/><path d="M19 18c0-2.5 2.5-2.5 2.5-5"/>`,
  mug: `<path d="M16 22h26v22a8 8 0 0 1-8 8H24a8 8 0 0 1-8-8z" ${F}/><path d="M42 27h4a6 6 0 0 1 0 12h-4"/><circle cx="23" cy="19" r="3.5"/><circle cx="30" cy="17" r="3.5"/><circle cx="36.5" cy="19.5" r="3"/>`,
  tea: `<path d="M22 18h20c0 7-5 9-5 15s4 8 4 14H23c0-6 4-8 4-14s-5-8-5-15z" ${F}/><path d="M14 52c6 3 30 3 36 0"/><path d="M45 12c4.5 0 7.5 3.5 6.5 8-4.5 0-7.5-3.5-6.5-8z"/><path d="M45 12l5 6"/>`,
  iced: `<path d="M18 14h28l-3.5 38a3 3 0 0 1-3 2.7h-15a3 3 0 0 1-3-2.7z"/><path d="M19.5 29h25l-2 23.2a2 2 0 0 1-2 1.8h-17a2 2 0 0 1-2-1.8z" ${F} stroke="none"/><rect x="23" y="24" width="8" height="8" rx="1.5" transform="rotate(-12 27 28)"/><rect x="32" y="31" width="8" height="8" rx="1.5" transform="rotate(10 36 35)"/><path d="M39 5l-4 30"/>`,
  bottle: `<path d="M27 8h10v6l4 6v32a4 4 0 0 1-4 4H27a4 4 0 0 1-4-4V20l4-6z"/><path d="M23 28h18v18H23z" ${F}/><path d="M28 35h8M28 39h6"/>`,
  frappe: `<path d="M20 28h24l-3 24a3 3 0 0 1-3 2.6H26a3 3 0 0 1-3-2.6z" ${F}/><path d="M18 28h28"/><path d="M21 28c-1-5 3-8 6-7 1-4 9-4 10 0 3-1 7 2 6 7"/><path d="M35 5l-2 16"/><path d="M24.5 38c4 2.5 11 2.5 15 0M25 45c3.5 2 10.5 2 14 0"/>`,
  mojito: `<path d="M20 15h24v37a3 3 0 0 1-3 3H23a3 3 0 0 1-3-3z"/><path d="M21 31h22v21a2 2 0 0 1-2 2H23a2 2 0 0 1-2-2z" ${F} stroke="none"/><circle cx="44" cy="16" r="7"/><path d="M44 9v14M37 16h14"/><path d="M25 42c3-4.5 8-4.5 9 0-3 3.5-7 3.5-9 0z"/><path d="M30 6l-3 25"/>`,
  glass: `<path d="M16 22h32l-4 28a4 4 0 0 1-4 3.5H24a4 4 0 0 1-4-3.5z"/><path d="M18.5 32h27l-2.4 17.6a3 3 0 0 1-3 2.6H23.9a3 3 0 0 1-3-2.6z" ${F} stroke="none"/><path d="M27 39a6 6 0 0 1 12 0z"/><path d="M33 39v-6"/>`,
  juice: `<path d="M20 20h24l-3 32a3 3 0 0 1-3 2.7H26a3 3 0 0 1-3-2.7z"/><path d="M21.6 31h20.8l-2 21a2 2 0 0 1-2 1.8H25.6a2 2 0 0 1-2-1.8z" ${F} stroke="none"/><circle cx="44" cy="19" r="8"/><path d="M44 11v16M36 19h16M38.5 13.5l11 11M49.5 13.5l-11 11"/>`,
  knafeh: `<ellipse cx="32" cy="36" rx="24" ry="10"/><path d="M8 36v5c0 5.5 10.7 10 24 10s24-4.5 24-10v-5"/><ellipse cx="32" cy="34.5" rx="19" ry="7" ${F}/><path d="M19 33.5l4 2M27 31.5l4 2M35 32l4 2M43 33.5l3 1.5M23 37.5l4 1.5M32 37.5l4 1.5"/><circle cx="29" cy="33" r="1.2" ${DOT}/><circle cx="37" cy="36" r="1.2" ${DOT}/><circle cx="25" cy="36" r="1" ${DOT}/>`,
  cake: `<path d="M10 34L46 23l8 5.5v15L10 50z" ${F}/><path d="M10 34l44-5.5M10 42l44-5.5"/><circle cx="43" cy="18" r="3.6"/><path d="M43.5 14.5c1-3 3-5 6-6"/>`,
  waffle: `<rect x="12" y="16" width="40" height="32" rx="6" ${F}/><path d="M22 16v32M32 16v32M42 16v32M12 26.7h40M12 37.3h40"/><path d="M17 53c5 3 25 3 30 0"/>`,
  croissant: `<path d="M8 40c3-10 13-18 24-18s21 8 24 18c-4 3-9 2-12-1-3 3-7 4-12 4s-9-1-12-4c-3 3-8 4-12 1z" ${F}/><path d="M20 26c2 5 3 10 3 16M32 22v19M44 26c-2 5-3 10-3 16"/>`,
  sandwich: `<path d="M10 44L32 16l22 28z" ${F}/><path d="M12.5 41h39"/><path d="M14 37.5c4-2 6 2 10 0s6 2 10 0 6 2 10 0 6 2 6 2"/>`,
  cookie: `<circle cx="32" cy="32" r="20" ${F}/><circle cx="25" cy="26" r="2.6" ${DOT}/><circle cx="37.5" cy="24" r="2" ${DOT}/><circle cx="40" cy="36.5" r="2.6" ${DOT}/><circle cx="27" cy="39" r="2.1" ${DOT}/><circle cx="33" cy="31.5" r="1.6" ${DOT}/>`,
};
export const ART_KEYS = Object.keys(ITEM_ART);
export const ART_LABELS = {
  espresso: 'إسبريسو', cup: 'فنجان', turkish: 'ركوة', mug: 'كوب', tea: 'كاسة شاي', iced: 'كاس مثلج', bottle: 'قنينة',
  frappe: 'فرابيه', mojito: 'موهيتو', glass: 'كاس قصير', juice: 'عصير', knafeh: 'صينية', cake: 'قطعة كيك', waffle: 'وافل',
  croissant: 'كرواسون', sandwich: 'ساندويش', cookie: 'كوكيز',
};

export function itemArt(key) {
  const body = ITEM_ART[key] ?? ITEM_ART.cup;
  return `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

/** صورة الصنف: صورة مرفوعة إن وُجدت، وإلا الرسم النحاسي على خلفية بلون الصنف */
export function artTile(item, cls = '') {
  // الرسم دايماً موجود تحت الصورة: إذا الصورة ما تحمّلت (بدون نت) بتنشال وبيبان الرسم
  let inner = itemArt(item.art);
  if (item.image) {
    const big = /\bbig\b/.test(cls);
    const src = String(item.image).replace(/([?&]w=)\d+/, `$1${big ? 760 : 360}`).replace(/"/g, '%22');
    inner += `<img src="${src}" alt="" loading="lazy" decoding="async" onerror="this.remove()">`;
  }
  // كل الخلفيات بدرجات البني والبيج (26–40) مع فرق بسيط بين الأصناف، لتضل الهوية متناسقة
  const warm = Math.round(26 + (((Number(item.hue) || 30) % 360) / 360) * 14);
  return `<div class="art ${cls}" style="--h:${warm}">${inner}</div>`;
}

// ───────── أيقونات الواجهة (24×24) ─────────
const UI = {
  cup: '<path d="M4.5 9.5h12v4.5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5z"/><path d="M16.5 11h1.3a2.6 2.6 0 0 1 0 5.2h-1.6"/><path d="M8.5 3.5c-.9 1.1.9 1.9 0 3.2M12.5 3.5c-.9 1.1.9 1.9 0 3.2"/>',
  utensils: '<path d="M7 3v7a2 2 0 0 0 2 2v9M11 3v7a2 2 0 0 1-2 2M9 3v6M16.5 21V3c-2 1.3-3 4-3 7.5h3"/>',
  user: '<circle cx="12" cy="8.5" r="3.6"/><path d="M5 20c.8-3.8 3.6-5.8 7-5.8s6.2 2 7 5.8"/>',
  bag: '<path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  arrow: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  back: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  send: '<path d="M20 4L9.5 14.5M20 4l-6.5 16-4-7.5L2 9z"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  person: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.8 3.6-6 7-6s6.2 2.2 7 6"/>',
  receipt: '<path d="M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 21z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  table: '<path d="M4 9h16M6 9v10M18 9v10M9 9l-1-4h8l-1 4"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  cloud: '<path d="M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9.5 4.3 4.3 0 0 0 7 18z"/>',
  rain: '<path d="M7 15h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 6.5 4.3 4.3 0 0 0 7 15z"/><path d="M8 18l-1 2.5M12 18l-1 2.5M16 18l-1 2.5"/>',
  storm: '<path d="M7 15h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 6.5 4.3 4.3 0 0 0 7 15z"/><path d="M12.5 15l-2 3.5h3l-2 3.5"/>',
  fog: '<path d="M4 10h16M6 14h12M8 18h8"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  trash: '<path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13"/>',
  upload: '<path d="M12 15V4"/><path d="M7.5 8.5 12 4l4.5 4.5"/><path d="M5 19.5h14"/>',
  download: '<path d="M12 4v11"/><path d="M7.5 10.5 12 15l4.5-4.5"/><path d="M5 19.5h14"/>',
  printer: '<path d="M7 9V4h10v5"/><rect x="4" y="9" width="16" height="7" rx="2"/><path d="M7 14h10v6H7z"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  menu: '<path d="M6 4h12v16H6z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/>',
  chart: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-5M12 16V8M16 16v-3"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  map: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/><path d="M12 14.5v2.5"/>',
  unlock: '<rect x="5" y="10.5" width="14" height="10" rx="2.2"/><path d="M8 10.5V8a4 4 0 0 1 7.6-1.7"/><path d="M12 14.5v2.5"/>',
  snow: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><path d="M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5M4.5 11.2 7.6 12l-.9 3.2M19.5 12.8 16.4 12l.9-3.2M6.7 8.8 7.6 12M17.3 15.2 16.4 12"/>',
  logout: '<path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/>',
  sound: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
  mute: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l4 6M21 9l-4 6"/>',
  contrast: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  image: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4.5 4 3.5 3-2.5 4 3.5"/>',
  qr: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2"/>',
  drop: '<path d="M12 3.5c3 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-7 6-11z"/>',
  flame: '<path d="M12 21c-4 0-6.5-2.6-6.5-6 0-4 3-6 4-9.5 1.5 1.5 2.5 3 2.5 5 1-1 1.5-2 1.5-3.5 2.5 2 5 5 5 8 0 3.4-2.5 6-6.5 6z"/>',
  snow: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/>',
  home: '<path d="M4 11l8-6.5 8 6.5"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>',
  clipboard: '<rect x="5" y="4.5" width="14" height="16.5" rx="2.5"/><path d="M9 4.5V3.5h6v1"/><path d="M8.5 10h7M8.5 13.5h7M8.5 17h4"/>',
  dots: '<circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>',
  chev: '<path d="M14.5 6l-6 6 6 6"/>',
  'check-circle': '<circle cx="12" cy="12" r="9"/><path d="M8 12.3l2.8 2.8L16.2 9.5"/>',
  leaf: '<path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z"/><path d="M5 19c3-4 6-7 10-10"/>',
  heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
  star: '<path d="M12 4l2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z"/>',
  users: '<circle cx="9" cy="9" r="3.2"/><path d="M3.5 19c.6-3.3 2.8-5.2 5.5-5.2s4.9 1.9 5.5 5.2"/><circle cx="16.5" cy="8" r="2.6"/><path d="M15.5 13.2c2.6-.3 4.6 1.4 5 4.6"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.8v.2"/>',
};
export function icon(name, cls = '') {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${UI[name] ?? ''}</svg>`;
}

/** غصن أوراق للزخرفة بالزوايا */
export function leavesArt() {
  return `<svg viewBox="0 0 160 200" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" aria-hidden="true">
    <path d="M150 196C120 150 92 104 82 10"/>
    <path d="M118 150c-30 2-46-14-50-34 22-2 42 10 50 34z"/><path d="M118 150c-14-12-28-22-50-34"/>
    <path d="M100 110c4-26 24-40 46-40-2 24-20 40-46 40z"/><path d="M100 110c14-14 28-26 46-40"/>
    <path d="M90 70c-24-6-34-26-30-46 22 6 34 24 30 46z"/><path d="M90 70c-10-16-20-30-30-46"/>
    <path d="M86 36c6-16 20-24 34-22-4 16-18 24-34 22z"/><path d="M134 176c10-18 26-24 24-24"/>
  </svg>`;
}

export function weatherIcon(w) {
  if (!w?.ok) return icon('cloud');
  const c = w.code;
  if (c >= 95) return icon('storm');
  if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82)) return icon('rain');
  if (c >= 71 && c <= 86) return icon('snow');
  if (c === 45 || c === 48) return icon('fog');
  if (c >= 2) return icon('cloud');
  return w.isDay ? icon('sun') : icon('moon');
}
