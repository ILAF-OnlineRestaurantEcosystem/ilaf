// "ساعدنا نختارك": يختار للزبون صنف رئيسي + اقتراح جانبي + اشي جديد يجربه
// حسب مزاجه وحبه للسكر وعدد الأشخاص، مع مراعاة الأكثر طلباً على طاولته والطقس.

export const MOODS = [
  { id: 'coffee', label: 'قهوة', art: 'cup' },
  { id: 'cold', label: 'مشروب بارد', art: 'iced' },
  { id: 'sweet', label: 'حلو', art: 'cake' },
  { id: 'meal', label: 'وجبة', art: 'sandwich' },
  { id: 'light', label: 'شي خفيف', art: 'croissant', wide: true },
];
export const SWEETNESS = [
  { id: 'none', label: 'بدون سكر', hint: 'الطعم الأصلي' },
  { id: 'light', label: 'حلاوة خفيفة', hint: 'بين وبين' },
  { id: 'sweet', label: 'بحب الحلو', hint: 'كل ما زاد أطيب' },
];
export const PEOPLE = [
  { id: 1, label: 'لحالي' },
  { id: 2, label: 'شخصين' },
  { id: 3, label: '3 أشخاص' },
  { id: 4, label: '4 أو أكثر' },
];

const isDrink = (i) => ['hot', 'cold', 'juice'].includes(i.categoryId) || i.temp === 'hot' || i.temp === 'cold';
const has = (i, t) => (i.tags ?? []).includes(t);

function moodPool(items, mood) {
  const pick = {
    coffee: (i) => isDrink(i) && has(i, 'قهوة'),
    cold: (i) => isDrink(i) && (i.categoryId === 'cold' || i.categoryId === 'juice' || i.temp === 'cold'),
    sweet: (i) => i.categoryId === 'dessert' || (!isDrink(i) && i.sugar >= 3),
    meal: (i) => !isDrink(i) && i.categoryId !== 'dessert' && (has(i, 'وجبة') || has(i, 'مالح') || has(i, 'فطور')),
    light: (i) => has(i, 'خفيف') || has(i, 'شاي') || i.categoryId === 'juice',
  }[mood] ?? (() => true);
  const pool = items.filter((i) => i.available && pick(i));
  return pool.length ? pool : items.filter((i) => i.available);
}

function sugarFit(item, pref) {
  const s = item.sugar ?? 1;
  if (pref === 'none') return item.sugarChoice ? 6 : s === 0 ? 8 : s === 1 ? 2 : -8;
  if (pref === 'light') return s === 1 ? 6 : s === 2 ? 4 : item.sugarChoice ? 4 : s === 0 ? 1 : -2;
  return s >= 3 ? 8 : s === 2 ? 5 : -3;
}

/**
 * menu: { items (بأسعار فعلية), popular: [ids] }
 * ctx: { weather, tableTop: [ids], seed }
 */
export function recommend(menu, { mood, sweet, people = 1 }, ctx = {}) {
  const items = menu.items;
  const popRank = Object.fromEntries((menu.popular ?? []).map((id, i) => [id, 10 - i]));
  const tableRank = Object.fromEntries((ctx.tableTop ?? []).map((id, i) => [id, 9 - i * 2]));
  const w = ctx.weather;
  const wantHot = w?.ok ? (w.feels < 20 || w.rainy) : null;

  const score = (i) => {
    let s = (popRank[i.id] ?? 0) + (tableRank[i.id] ?? 0) + sugarFit(i, sweet);
    if (wantHot != null && isDrink(i)) s += (wantHot ? i.temp === 'hot' : i.temp !== 'hot') ? 4 : -3;
    if (people >= 3 && has(i, 'للمشاركة')) s += 3;
    return s;
  };
  const ranked = moodPool(items, mood).map((i) => ({ i, s: score(i) })).sort((a, b) => b.s - a.s);
  const main = ranked[0]?.i;
  if (!main) return null;

  // الاقتراح الجانبي يكمّل الأساسي: مشروب ← حلو أو معجنات، أكل ← مشروب
  const sideIsDrink = !isDrink(main);
  const sidePool = items.filter((i) => i.available && i.id !== main.id && (sideIsDrink ? isDrink(i) : !isDrink(i)));
  const side = sidePool.map((i) => ({ i, s: score(i) + (sideIsDrink && has(i, 'قهوة') ? 2 : 0) })).sort((a, b) => b.s - a.s)[0]?.i ?? null;

  // اشي جديد: من نفس المزاج بس مش من الأكثر طلباً، يتغيّر كل يوم
  const fresh = ranked.filter(({ i }) => i.id !== main.id && i.id !== side?.id && !popRank[i.id]);
  const daySeed = ctx.seed ?? new Date().getDate();
  const discover = fresh.length ? fresh[daySeed % Math.min(fresh.length, 4)].i : null;

  const sugarOpt = main.sugarChoice ? ({ none: 'none', light: 'light', sweet: 'medium' }[sweet]) : '';
  const reasons = [];
  if (tableRank[main.id]) reasons.push('أكثر اشي بينطلب على طاولتك');
  else if (popRank[main.id]) reasons.push('من الأكثر طلباً عنا هالأسبوع');
  const fitsWeather = wantHot != null && isDrink(main) && (wantHot ? main.temp === 'hot' : main.temp !== 'hot');
  if (fitsWeather) reasons.push(wantHot ? `والجو ${w.temp}° بدّه اشي يدفّي` : `والجو ${w.temp}° بدّه اشي منعش`);
  if (sweet === 'none' && (main.sugar === 0 || main.sugarChoice)) reasons.push('وبنعمله بدون سكر متل ما بتحب');
  if (sweet === 'sweet' && main.sugar >= 2) reasons.push('وحلاوته على ذوقك');

  return { main, side, discover, qty: Math.max(1, Number(people) || 1), sugar: sugarOpt, reasons };
}
