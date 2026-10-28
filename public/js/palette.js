// ثيمات الألوان: الكاشير بيختار ثيم (أو لون محله) من الإعدادات، وبيطبّقه على المنيو أو لوحته أو الاثنين.
// من لون واحد بنولّد كل ألوان الواجهة بالفاتح والغامق، مع فحص الوضوح (تباين النص WCAG).

// ───────── الثيمات الجاهزة ─────────
export const PALETTES = [
  { id: 'terracotta', name: 'تيراكوتا', color: '#c46a3d' },
  { id: 'olive', name: 'زيتوني', color: '#5f6b3a' },
  { id: 'purple', name: 'بنفسجي', color: '#6b3fa0' },
  { id: 'navy', name: 'كحلي', color: '#1f3a5f' },
  { id: 'burgundy', name: 'عنّابي', color: '#8e2f4f' },
  { id: 'teal', name: 'فيروزي', color: '#1f7a73' },
  { id: 'rose', name: 'وردي', color: '#b4537a' },
  { id: 'blue', name: 'أزرق', color: '#2f6fb0' },
  { id: 'charcoal', name: 'فحمي وذهبي', color: '#2b2b2b', accent: '#c9a24d' },
];
// كل واجهة إلها ثيمها لحالها: المنيو (الزباين) ولوحة الكاشير
export const TARGETS = [['menu', 'ألوان المنيو (الزباين)'], ['admin', 'ألوان لوحة الكاشير']];
const HEX_RE = /^#[0-9a-f]{6}$/i;

/** الثيم المحفوظ (الشكل الجديد أو القديم) ← { menu: {...}, admin: {...} } */
export function normalizeTheme(theme) {
  const def = { palette: 'default', color: null, accent: null };
  if (!theme) return { menu: { ...def }, admin: { ...def } };
  if (theme.menu || theme.admin) return { menu: { ...def, ...(theme.menu ?? {}) }, admin: { ...def, ...(theme.admin ?? {}) } };
  // الشكل القديم: ثيم واحد + applyTo
  const one = { ...def, palette: theme.palette ?? 'default', color: theme.color ?? null };
  const to = theme.applyTo ?? 'menu';
  return { menu: ['menu', 'both'].includes(to) ? one : { ...def }, admin: ['admin', 'both'].includes(to) ? { ...one } : { ...def } };
}

// ───────── رياضيات الألوان ─────────
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export function hexToRgb(hex) {
  const h = String(hex).replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const toHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
export function hsl(h, s, l) {
  h = ((h % 360) + 360) % 360; s = clamp(s, 0, 1); l = clamp(l, 0, 1);
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return toHex(f(0) * 255, f(8) * 255, f(4) * 255);
}
const lum = (hex) => {
  const c = hexToRgb(hex).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
export const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const rgbList = (hex) => hexToRgb(hex).join(', ');

/** بنغمّق (أو بنفتّح) اللون لحد ما يصير مقروء على الخلفية المطلوبة */
function fit(h, s, l, against, min, dir) {
  let c = hsl(h, s, l);
  for (let i = 0; i < 60 && contrast(c, against) < min; i++) { l += dir * 0.015; c = hsl(h, s, l); }
  return c;
}

/**
 * ألوان الأساس ثابتة بكل المحلات (الخلفية، البطاقات، الكتابة) عشان الكلام يضل واضح،
 * ولون المحل بيطلع مليان على الهوية بس: الأزرار، الشريط المتحرك، العروض، الشريط المختار.
 */
const NEUTRAL = {
  light: { abyss: '#e7e4de', harbor: '#f4f2ee', line: '#e4e0d9', lineStrong: '#d2cdc4', inset: '#faf9f7', foam: '#1c1a17', foam2: '#565049', foam3: '#78726a' },
  dark: { abyss: '#0a0908', harbor: '#121110', tide: '#1c1a18', swell: '#252320', line: '#2e2b28', lineStrong: '#3a3632', inset: '#171513', foam: '#f3f0ec', foam2: '#b8b1a8', foam3: '#8e877e' },
};

/** كل متغيرات الواجهة من لون واحد: { light: {...}, dark: {...} } */
export function paletteFrom(color, accent = null) {
  const [h0, s0, l0] = rgbToHsl(hexToRgb(color));
  const grey = s0 < 0.1; // لون رمادي/أسود: الخلفيات بتاخد لون اللمسة (الذهبي مثلاً)
  const [ha, sa] = accent ? rgbToHsl(hexToRgb(accent)) : [h0, s0];
  const h = grey ? ha : h0;
  const st = grey ? Math.min(sa, 0.35) * 0.5 : Math.min(s0, 0.6); // تشبّع الخلفيات (هادي)

  // ── الفاتح ──
  const N = NEUTRAL.light;
  const harbor = N.harbor;
  const brass = fit(h0, s0, Math.min(l0, 0.5), '#ffffff', 4.8, -1);
  const [bh, bs, bl] = rgbToHsl(hexToRgb(brass));
  const light = {
    '--abyss': N.abyss,
    '--harbor': harbor,
    '--tide': '#ffffff',
    '--swell': '#ffffff',
    '--tint': rgbList(N.foam),
    '--line': N.line,
    '--line-strong': N.lineStrong,
    '--inset': N.inset,
    '--foam': N.foam,
    '--foam-2': N.foam2,
    '--foam-3': N.foam3,
    '--brass': brass,
    '--brass-hi': fit(bh, bs, bl - 0.08, harbor, 6, -1),
    '--brass-lo': hsl(bh, bs * 0.45, 0.72),
    '--olive-soft': hsl(h, st * 0.5, 0.91),
    '--gold': accent ?? hsl(h0, Math.max(s0, 0.35), clamp(l0 + 0.2, 0.5, 0.62)),
    '--gold-soft': hsl(grey ? ha : h0, (grey ? sa : s0) * 0.5, 0.92),
    '--on-brass': '#ffffff',
    '--side-a': hsl(bh, bs * 0.85, clamp(bl * 0.9, 0.18, 0.3)),
    '--side-b': hsl(bh, bs * 0.85, clamp(bl * 0.55, 0.1, 0.18)),
    '--side-ink': hsl(h, st * 0.5, 0.92),
    '--offer-a': hsl(h, st * 0.55, 0.94),
    '--offer-b': hsl(h, st * 0.55, 0.88),
    '--fab-bg': brass,
    '--tab-on': brass,
  };

  // ── الغامق ──
  const D = NEUTRAL.dark;
  const dHarbor = D.harbor;
  const dBrassBase = grey && accent ? accent : color;
  const [dh, ds, dl] = rgbToHsl(hexToRgb(dBrassBase));
  const dSat = grey && !accent ? 0 : Math.max(ds, 0.35); // رمادي بدون لمسة: بيضل رمادي
  const dBrass = fit(dh, dSat, Math.max(dl, 0.5), dHarbor, 6, 1);
  const dFoam = D.foam;
  const dark = {
    '--abyss': D.abyss,
    '--harbor': dHarbor,
    '--tide': D.tide,
    '--swell': D.swell,
    '--tint': rgbList(dFoam),
    '--line': D.line,
    '--line-strong': D.lineStrong,
    '--inset': D.inset,
    '--foam': dFoam,
    '--foam-2': D.foam2,
    '--foam-3': D.foam3,
    '--brass': dBrass,
    '--brass-hi': fit(dh, dSat, rgbToHsl(hexToRgb(dBrass))[2] + 0.07, dHarbor, 7, 1),
    '--brass-lo': hsl(dh, ds * 0.45, 0.35),
    '--olive-soft': hsl(h, st * 0.45, 0.14),
    '--gold': accent ?? dBrass,
    '--gold-soft': hsl(h, st * 0.6, 0.16),
    '--on-brass': dHarbor,
    '--side-a': hsl(h, st * 0.6, 0.12),
    '--side-b': hsl(h, st * 0.6, 0.07),
    '--side-ink': dFoam,
    '--offer-a': hsl(h, st * 0.55, 0.14),
    '--offer-b': hsl(h, st * 0.55, 0.1),
    '--fab-bg': hsl(dh, dSat * 0.7, 0.2),
    '--tab-on': brass, // الشريط السفلي أبيض بالغامق، فالأيقونة المختارة بلون الفاتح
  };
  return { light, dark };
}

// ───────── الهوية الأصلية (بدون ثيم): للمعاينة بس، القيم الحقيقية بـ base.css و theme.css ─────────
const BASE = {
  cafe: {
    light: { '--harbor': '#f4ece1', '--abyss': '#e9dfd1', '--tide': '#ffffff', '--swell': '#ffffff', '--line': '#e8e1d9', '--inset': '#fbf8f5', '--foam': '#2b1a12', '--foam-2': '#7a685d', '--foam-3': '#8f7d70', '--brass': '#4a2c1d', '--brass-hi': '#3a2216', '--gold': '#d4a359', '--gold-soft': '#f6ead4', '--olive-soft': '#efe5d8', '--on-brass': '#fbf8f5', '--side-a': '#4a2c1d', '--side-b': '#2b1a12', '--side-ink': '#f1e4cc', '--offer-a': '#f3ead9', '--offer-b': '#ece0c9', '--fab-bg': '#4a2c1d', '--tab-on': '#4a2c1d' },
    dark: { '--harbor': '#160d08', '--abyss': '#0d0704', '--tide': '#251710', '--swell': '#2f1e15', '--line': '#38251b', '--inset': '#1d120c', '--foam': '#f5ece5', '--foam-2': '#a8988d', '--foam-3': '#8a7a6f', '--brass': '#e8a852', '--brass-hi': '#e8a852', '--gold': '#d4a359', '--gold-soft': '#3a2616', '--olive-soft': '#2a1a12', '--on-brass': '#160d08', '--side-a': '#2a1a12', '--side-b': '#1a0f0a', '--side-ink': '#f5ece5', '--offer-a': '#2c1b12', '--offer-b': '#22150e', '--fab-bg': '#3a2417', '--tab-on': '#4a2c1d' },
  },
  restaurant: {
    light: { '--harbor': '#f6efe6', '--abyss': '#ebe0d2', '--tide': '#ffffff', '--swell': '#ffffff', '--line': '#eadfd2', '--inset': '#fbf6f0', '--foam': '#2a1c14', '--foam-2': '#75645a', '--foam-3': '#8e7c70', '--brass': '#a8482a', '--brass-hi': '#7a3018', '--gold': '#d9952e', '--gold-soft': '#f7e7cf', '--olive-soft': '#efe3d3', '--on-brass': '#fff8f1', '--side-a': '#8a3a20', '--side-b': '#4a1d0e', '--side-ink': '#f6ede4', '--offer-a': '#fbeee2', '--offer-b': '#f3e0cd', '--fab-bg': '#a8482a', '--tab-on': '#a8482a' },
    dark: { '--harbor': '#140e0b', '--abyss': '#0d0907', '--tide': '#221813', '--swell': '#2c1f18', '--line': '#3a2a21', '--inset': '#1a120e', '--foam': '#f6ede4', '--foam-2': '#b09e92', '--foam-3': '#8d7b6f', '--brass': '#e0784e', '--brass-hi': '#f0936a', '--gold': '#e0a443', '--gold-soft': '#3a2416', '--olive-soft': '#2a1d16', '--on-brass': '#140e0b', '--side-a': '#2c1b14', '--side-b': '#1a100c', '--side-ink': '#f6ede4', '--offer-a': '#2c1d15', '--offer-b': '#21160f', '--fab-bg': '#3a2016', '--tab-on': '#a8482a' },
  },
};

/** الثيم المحفوظ بإعدادات المحل → لون أساسي (أو null = الهوية الأصلية) */
export function themeColors(theme) {
  if (!theme || !theme.palette || theme.palette === 'default') return null;
  // لون المحل: لون أساسي (الأزرار والعناوين) + لون ثاني اختياري (اللمسات)
  if (theme.palette === 'custom') return HEX_RE.test(theme.color ?? '') ? { color: theme.color, accent: HEX_RE.test(theme.accent ?? '') ? theme.accent : null } : null;
  const p = PALETTES.find((x) => x.id === theme.palette);
  return p ? { color: p.color, accent: p.accent ?? null } : null;
}
/** متغيرات المعاينة لثيم معيّن ووضع معيّن (فاتح/غامق) */
export function previewVars(theme, mode, biz = 'cafe') {
  const c = themeColors(theme);
  if (!c) return BASE[biz === 'restaurant' ? 'restaurant' : 'cafe'][mode];
  return paletteFrom(c.color, c.accent)[mode];
}
export const varsToStyle = (vars) => Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';');

/** CSS الثيم للصفحة كلها (بالفاتح والغامق). :root:root عشان يغلب ألوان المطعم الأصلية */
export function paletteCss(theme) {
  const c = themeColors(theme);
  if (!c) return '';
  const { light, dark } = paletteFrom(c.color, c.accent);
  return `:root:root[data-palette]{${varsToStyle(light)}}:root:root[data-palette][data-theme="dark"]{${varsToStyle(dark)}}`;
}

/**
 * بيطبّق ثيم هالصفحة (page = 'menu' للزبون أو 'admin' للكاشير) من ثيمات المحل.
 * وبيحفظه بالمتصفح عشان المرة الجاية يطلع من أول لحظة (بدون وميض الألوان القديمة).
 */
export function applyPalette(theme, page, cacheKey = null) {
  theme = normalizeTheme(theme)[page]; // ثيم هالواجهة بس
  const css = paletteCss(theme);
  let el = document.getElementById('cfPalette');
  if (css) {
    if (!el) { el = document.createElement('style'); el.id = 'cfPalette'; document.head.append(el); }
    el.textContent = css;
    document.documentElement.dataset.palette = theme.palette;
  } else {
    el?.remove();
    delete document.documentElement.dataset.palette;
  }
  if (cacheKey) { try { if (css) localStorage.setItem(cacheKey, css); else localStorage.removeItem(cacheKey); } catch { /* */ } }
}
