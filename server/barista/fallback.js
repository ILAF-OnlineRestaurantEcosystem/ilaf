// الوضع الأساسي للباريستا: يشتغل بدون مفتاح ذكاء (Gemini/Claude).
// يفهم أشهر الطلبات (الميزانية، عدد الأشخاص، السكر، الطقس، الأكثر طلباً، الطاولة) بقواعد بسيطة،
// وبيدردش (كيفك، نكتة، تعبان)، وبيحكي بصراحة إذا اشي مش عنا وبيقترح الأقرب، وبيعرف معلومات المحل من الإعدادات.
import { normalizeDigits } from './context.js';

const NUM_WORDS = {
  'اثنين': 2, 'اتنين': 2, 'ثنين': 2, 'تنين': 2, 'ثلاثة': 3, 'تلاتة': 3, 'ثلاث': 3, 'تلات': 3,
  'أربعة': 4, 'اربعة': 4, 'أربع': 4, 'اربع': 4, 'خمسة': 5, 'خمس': 5, 'ستة': 6, 'ست': 6,
  'سبعة': 7, 'سبع': 7, 'ثمانية': 8, 'تمانية': 8, 'تسعة': 9, 'تسع': 9, 'عشرة': 10,
};

function clean(text) {
  let t = normalizeDigits(text).replace(/[ً-ْـ]/g, '').replace(/[إأآ]/g, 'ا');
  for (const [w, n] of Object.entries(NUM_WORDS)) {
    t = t.replace(new RegExp(`(^|\\s)${w.replace(/[إأآ]/g, 'ا')}(?=\\s|$)`, 'g'), `$1${n}`);
  }
  return t;
}

function parse(raw) {
  const t = clean(raw);
  const budget = Number(
    (t.match(/(\d+(?:\.\d+)?)\s*(?:شيكل|شيقل|شواكل|₪)/) || t.match(/(?:معي|معاي|ميزانيتي|ميزانيه|ميزانية)\s*(\d+(?:\.\d+)?)/) || [])[1],
  ) || null;
  const people = Number(
    (t.match(/(?:احنا|نحنا|نحن)\s*(\d{1,2})/) || t.match(/(\d{1,2})\s*(?:اشخاص|شخص|نفر|انفار|شباب|بنات|صحاب|اصحاب)/) || [])[1],
  ) || null;
  const lowSugarMatch = t.match(/(\d{1,2})\s*(?:منهم|منا|منّا)?\s*(?:ما|مش|لا)\s*(?:ب|بي|ي)?حب(?:و|وا)?\s*(?:ال)?سكر/);
  const lowSugarAll = /(?:ما|مش)\s*(?:ب)?حب\s*(?:ال)?سكر|بدون سكر|سكر خفيف|قليل السكر|دايت|رجيم/.test(t);
  const weatherCold = /(?:الجو|الطقس|الدنيا|برا)\s*(?:كثير|كتير|شوي)?\s*(?:بارد|برد|ماطر|ممطر|شتا)|برد|مطر|شتا|سقعه|سقعة/.test(t);
  const weatherHot = /(?:الجو|الطقس|الدنيا)\s*(?:كثير|كتير|شوي)?\s*(?:حر|حار|شوب|سخن)|شوب|(?:^|\s)حر(?:\s|$)|حراره|حرارة/.test(t);
  const wantCold = /(?:^|\s)(?:اشي|شي|مشروب|مشروبات|بدي|عطيني|اعطيني|اقترح)(?=\s)[^.؟?،,]{0,25}(?:بارد|بارده|باردة|مثلج|منعش|ساقع)/.test(t);
  const wantHot = /(?:^|\s)(?:اشي|شي|مشروب|مشروبات|بدي|عطيني|اعطيني|اقترح)(?=\s)[^.؟?،,]{0,25}(?:سخن|سخنه|سخنة|ساخن|ساخنه|ساخنة|دافي|دافئ)/.test(t);
  return {
    t,
    budget,
    people: people && people <= 20 ? people : null,
    lowSugar: lowSugarMatch ? Number(lowSugarMatch[1]) : lowSugarAll ? -1 : 0,
    weather: /طقس|شو الجو|كيف الجو|ذوقك|فاجئني|انت اختار|اختارلي/.test(t),
    weatherCold, weatherHot, wantCold, wantHot,
    popular: /اكثر|الاكثر|مشهور|ترند|بيطلبوا|يطلبوا|الافضل|افضل|بتنصح|انصحني|شو في حلو|احلى اشي|اطيب|ازكى/.test(t),
    sweet: /حلو(?!ين)|حلويات|تحلايه|تحلاية|كيك|كنافه|كنافة|حلى/.test(t),
    focus: /قهوه|قهوة|كافيين|صحصح|نعسان|دراسه|دراسة|ادرس|شغل|اشتغل|تركيز|تعبان|تعبانه|مرهق|هلكان|سهران|ما نمت/.test(t),
    coffee: /قهوه|قهوة|كوفي/.test(t),
    tired: /تعبان|تعبانه|مرهق|نعسان|نعسانه|هلكان|سهران|ما نمت|صاحي من بدري/.test(t),
    sad: /زهقان|زهقانه|زعلان|زعلانه|مضايق|متضايق|حزين|حزينه|مكتئب|طفشان|مليت|ملل/.test(t),
    noSugar: /بدون سكر|بلا سكر|(?:^|\s)ساده(?:\s|$)|(?:^|\s)سادة(?:\s|$)|(?:ما|مش)\s*(?:ب)?حب\s*(?:ال)?سكر/.test(t),
    noCaffeine: /بدون كافيين|ما بدي كافيين|اطفال|ولاد|اولاد|بدي انام|بنام/.test(t),
    hungry: /جوعان|جوعانين|اكل|فطور|سناك|ساندويش/.test(t),
    greeting: /^(?:مرحبا|مرحبتين|هلا|السلام|اهلين|اهلا|هاي|صباح|مسا|هلو|يا هلا)/.test(t),
    howAreYou: /كيفك|كيف حالك|كيف الحال|شو اخبارك|شلونك|كيفكم|شو الاخبار|كيف الصحه/.test(t),
    whoAreYou: /شو اسمك|مين انت|مين حضرتك|انت مين|عرفني عليك|انت روبوت|انت حقيقي|ذكاء اصطناعي|بوت/.test(t),
    joke: /نكته|نكتة|ضحكني|اضحكني|اشي بيضحك|قول اشي حلو/.test(t),
    compliment: /بحبك|حبيبي|انت حلو|شاطر|عسل|انت ذكي|برافو|احسنت|يا سلام عليك/.test(t),
    wifi: /واي فاي|وايفاي|wifi|wi-fi|(?:^|\s)نت(?:\s|$|؟)|انترنت|باسورد|كلمه السر|كلمة السر|كلمة سر|كلمه سر/i.test(t),
    hours: /بتسكروا|بتفتحوا|ساعات الدوام|دوامكم|الدوام|لايمتى|لإيمتى|لوقتيش|فاتحين|مفتوحين|بتغلقوا|اوقات/.test(t),
    thanks: /شكرا|يسلمو|تسلم|مشكور|يعطيك العافيه|يعطيك العافية/.test(t),
    tableAsk: /طاول/.test(t),
  };
}

/** المبلغ اللي حكى الزبون إنه معه (أو null) */
export function detectBudget(text) {
  return parse(String(text ?? '')).budget;
}

const fmt = (n, cur) => `${Number.isInteger(n) ? n : n.toFixed(1)}${cur}`;

// أسماء دارجة للأصناف الأساسية؛ الأصناف الجديدة تُطابق باسمها الكامل
const ALIASES = {
  espresso: ['اسبريسو', 'اكسبريسو', 'اسبرسو'],
  americano: ['امريكانو'],
  turkish: ['قهوه عربيه', 'قهوه تركيه', 'قهوه ساده', 'تركي'],
  cappuccino: ['كابتشينو', 'كابوتشينو', 'كابيتشينو'],
  latte: ['لاتيه', 'لاتي'],
  spanish: ['سبانش', 'اسبانش'],
  mocha: ['موكا', 'موكه'],
  nescafe: ['نسكافيه', 'نسكافي', 'نسكفيه'],
  'mint-tea': ['شاي بالنعنع', 'شاي نعنع', 'شاي'],
  sahlab: ['سحلب', 'سحلبيه'],
  'hot-choc': ['هوت شوكليت', 'هوت شوكلت', 'شوكولاته سخنه'],
  karak: ['كرك'],
  'iced-latte': ['ايس لاتيه', 'ايس لاتي'],
  'iced-spanish': ['ايس سبانش'],
  'cold-brew': ['كولد برو', 'كولدبرو'],
  'caramel-frappe': ['فرابيه', 'فرابتشينو', 'فرابي'],
  'iced-mocha': ['ايس موكا'],
  mojito: ['موهيتو', 'موخيتو'],
  'peach-tea': ['ايس تي', 'شاي بارد'],
  'oreo-shake': ['ميلك شيك', 'اوريو'],
  'lemon-mint': ['ليمون ونعنع', 'ليمون نعنع', 'ليموناضه', 'ليموناده'],
  orange: ['برتقال'],
  mango: ['مانجا', 'مانجو', 'منجا'],
  strawberry: ['فراوله'],
  knafeh: ['كنافه'],
  'lotus-cheesecake': ['تشيز كيك', 'تشيزكيك', 'لوتس'],
  brownies: ['براونيز', 'براوني'],
  tiramisu: ['تيراميسو'],
  waffle: ['وافل'],
  basbousa: ['بسبوسه', 'هريسه'],
  croissant: ['كرواسون', 'كرواسان', 'كروسان'],
  'zaatar-croissant': ['كرواسون زعتر', 'زعتر'],
  halloumi: ['حلوم', 'ساندويش'],
  cookie: ['كوكيز', 'كوكي'],
  'flat-white': ['فلات وايت', 'فلات'],
  cortado: ['كورتادو'],
  'caramel-macchiato': ['كراميل ماكياتو', 'ماكياتو'],
  v60: ['v60', 'في 60', 'قهوه مقطره', 'تقطير'],
  'matcha-latte': ['ماتشا'],
  'green-tea': ['شاي اخضر'],
  zhourat: ['زهورات', 'بابونج', 'اعشاب', 'يانسون', 'ميرميه'],
  'iced-americano': ['ايس امريكانو'],
  'iced-caramel': ['ايس كراميل'],
  'iced-matcha': ['ايس ماتشا'],
  'passion-mojito': ['باشن فروت', 'باشن'],
  'nutella-shake': ['شيك نوتيلا', 'ميلك شيك نوتيلا'],
  cocktail: ['كوكتيل'],
  avocado: ['افوكادو'],
  'berry-smoothie': ['سموذي', 'سموزي'],
  'carrot-orange': ['جزر'],
  watermelon: ['بطيخ'],
  'lava-cake': ['مولتن', 'لافا'],
  crepe: ['كريب'],
  pancakes: ['بان كيك', 'بانكيك'],
  'berry-cheesecake': ['تشيز كيك توت'],
  'ice-cream': ['ايس كريم', 'ايسكريم', 'بوظه', 'جيلاتو'],
  manakish: ['منقوشه', 'مناقيش', 'منقيشه'],
  kaak: ['كعك', 'كعكه'],
  'avocado-toast': ['توست افوكادو'],
  'chicken-panini': ['بانيني'],
  'club-sandwich': ['كلوب'],
  muffin: ['مافن', 'مفن'],
};
const norm = (s) => normalizeDigits(String(s)).replace(/[ً-ْـ]/g, '').replace(/[إأآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');

/** الأصناف المذكورة في الرسالة بترتيب ظهورها (الأطول أولاً كي لا يغلب "لاتيه" على "آيس لاتيه") */
function findItems(text, items) {
  let t = ' ' + norm(text) + ' ';
  const keys = [];
  for (const it of items) {
    const names = new Set([norm(it.name), norm(it.name).replace(/^ال/, ''), ...(ALIASES[it.id] ?? [])]);
    for (const n of names) if (n.length >= 3) keys.push({ n, it });
  }
  keys.sort((a, b) => b.n.length - a.n.length);
  const found = [];
  for (const { n, it } of keys) {
    const idx = t.indexOf(n);
    if (idx === -1) continue;
    t = t.slice(0, idx) + ' '.repeat(n.length) + t.slice(idx + n.length);
    if (!found.some((f) => f.it.id === it.id)) found.push({ it, idx });
  }
  return found.sort((a, b) => a.idx - b.idx).map((f) => f.it);
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const JOKES = [
  'مرة فنجان قهوة راح عالدكتور، قاله: صرلي فترة مش قادر أنام 😅 قاله الدكتور: طبيعي، إنت إسبريسو!',
  'سألوا الإسبريسو ليش دايماً مستعجل؟ قال: لأني قصير ومركّز وما عندي وقت للحكي ☕',
  'الكابتشينو قال للاتيه: ليش دايماً هادي؟ قاله: لأني فيّ حليب أكثر منك 😄',
  'الشاي والقهوة تخانقوا مين أحسن، والنعنع قعد يتفرّج وقال: أنا اللي بنعش الجلسة 🌿',
];

// كلمات بتساعدنا نعرف شو نوع الشي اللي طلبه الزبون إذا مش بالمنيو
const FOOD_WORDS = /شاورما|بيتزا|برجر|برغر|همبرجر|فلافل|حمص|فول|سندويش|ساندويش|توست|معكرونه|باستا|سلطه|بطاطا|شيبس|دجاج|جاج|لحمه|فطور|منقوشه|مناقيش|كعك|جبنه|بيض/;
const SWEET_WORDS = /ايس كريم|ايسكريم|بوظه|جيلاتو|كريب|بان كيك|بانكيك|دونات|شوكولا|كيك|بقلاوه|قطايف|مهلبيه|حلاوه/;
const SODA_WORDS = /كولا|بيبسي|سفن|سبرايت|فانتا|غازي|غازيه|مشروب طاقه|ريد بول|ريدبول|بيره/;
const WATER_WORDS = /(?:^|\s)(?:مي|ميه|مية|مياه|ماء|ماي)(?:\s|$|؟)/;
const SHISHA_WORDS = /اركيله|ارجيله|اراكيل|شيشه|معسل/;
const DRINK_WORDS = /عصير|سموذي|مشروب|شاي|حليب|ليمون|كوكتيل|ميلك/;
// كلمات عامة بعد "بدي" ما بتعني صنف
const NOT_AN_ITEM = /^(?:اطلب|اشي|شي|حاجه|حاجة|اشرب|اعرف|اسال|اسأل|اقعد|احكي|ادفع|الحساب|النادل|مساعده|طاوله|اغير|اقترح|تقترح|رايك|نصيحه|اكل|بس|كمان|اياه|ياه|هيك|هاد|هاي)/;

/** الشي اللي طلبه الزبون بكلامه (بعد "بدي/عندكم/في...")، أو null */
function requestedThing(t) {
  const m = t.match(/(?:^|\s)(?:بدي|بدنا|عطيني|اعطيني|جيبلي|جيبولي|في عندكم|عندكم|في عنكم|عنكم|بتعملوا|بتبيعوا|بتقدموا|فيه|في)\s+([^.؟?!،,\n]{2,40})/);
  if (!m) return null;
  const thing = m[1].replace(/\s*(?:لو سمحت|من فضلك|يا ريت|اذا بتريد|اذا ممكن|ممكن)\s*$/, '').trim().split(/\s+/).slice(0, 3).join(' ');
  return thing && !NOT_AN_ITEM.test(thing) ? thing : null;
}

const isCoffee = (i) => ['hot', 'cold'].includes(i.categoryId) && /اسبريسو|إسبريسو|قهوه|قهوة|بن |نسكافيه|كولد برو/.test(`${i.name} ${i.recipe ?? ''}`);

export function basicBarista(ctx, history, freshTable) {
  const lastUser = [...history].reverse().find((m) => m.role !== 'assistant');
  const q = parse(lastUser?.text ?? '');
  const cur = ctx.settings.currency;
  const drinks = ctx.items.filter((i) => ['hot', 'cold', 'juice'].includes(i.categoryId));
  const desserts = ctx.items.filter((i) => i.categoryId === 'dessert');
  const food = ctx.items.filter((i) => i.categoryId === 'bakery');
  const popRank = Object.fromEntries(ctx.popular.map((p, i) => [p.id, 10 - i]));
  const tableRank = Object.fromEntries((ctx.table?.topAtTable ?? []).map((p, i) => [p.id, 8 - i * 2]));
  const parts = [];

  // تحديد الحرارة المطلوبة
  let temp = null;
  const w = ctx.weather;
  if (q.wantCold) temp = 'cold';
  else if (q.wantHot) temp = 'hot';
  else if (q.weatherCold) temp = 'hot';
  else if (q.weatherHot) temp = 'cold';
  else if (q.weather && w.ok) temp = w.feels < 21 || w.rainy ? 'hot' : 'cold';

  if (q.weather && w.ok) {
    parts.push(`الجو هلأ بـ${w.city} ${w.temp}° و${w.desc}${w.rainy ? ' ومطر' : ''}، يعني ${temp === 'hot' ? 'بدها اشي سخن يدفّيك' : 'بدها اشي بارد ومنعش'}.`);
  } else if (q.weather && !w.ok) {
    parts.push('ما قدرت أشوف الطقس هلأ، بس خليني أختارلك على ذوقي.');
  }

  if (freshTable && ctx.table) {
    const t = ctx.table;
    const top = t.topAtTable.slice(0, 2).map((x) => x.name);
    parts.push(`أهلين بطاولة ${t.number} 👋 هاي بـ"${t.zone?.name}"${top.length ? `، وأكثر شي بينطلب عليها ${top.join(' و')}` : ''}.`);
  } else if (ctx.requestedTable) {
    parts.push(`ما عنا طاولة رقم ${ctx.requestedTable}، الطاولات من 1 لـ ${ctx.tableCount}. شيّك على الرقم المكتوب ع الطاولة.`);
  }

  const score = (i) => (popRank[i.id] ?? 0) + (tableRank[i.id] ?? 0)
    + (q.focus ? i.caffeine * (q.tired ? 6 : 3) : 0) - (q.noCaffeine ? i.caffeine * 6 : 0)
    + (q.coffee && q.noSugar && !/حليب/.test(i.recipe ?? '') ? 12 : 0)
    + ((temp === 'hot' && i.temp === 'hot') || (temp === 'cold' && i.temp === 'cold') ? 8 : 0)
    - ((temp === 'hot' && i.temp === 'cold') || (temp === 'cold' && i.temp === 'hot') ? 12 : 0);

  // نادل إنسان
  if (/نادل|جرسون|ويتر|موظف|حدا من الفريق|انسان|بشري|الكاشير|بدي احكي مع حدا|الفاتوره|الفاتورة|الحساب|حساسيه|حساسية|مشكله|مشكلة|تاخر|اتاخر/.test(q.t)) {
    const allergy = /حساسيه|حساسية/.test(q.t);
    return {
      reply: allergy
        ? 'سلامتك أهم اشي 🙏 اضغط زر "نادِ نادل" وبيجيك حدا من الفريق يتأكد معك من المكونات قبل ما تطلب.'
        : 'أكيد! اضغط زر "نادِ نادل" وبيجيك حدا من الفريق ع طول.',
      suggestions: [],
      offerWaiter: true,
    };
  }

  // معلومات المحل من الإعدادات (الواي فاي والدوام)
  const s = ctx.settings;
  if (q.wifi) {
    return s.wifi
      ? { reply: `الواي فاي عنا: ${s.wifi} 📶 وإذا ما زبط معك احكيلي وبناديلك حدا من الفريق.`, suggestions: [] }
      : { reply: 'كلمة سر الواي فاي بتعرفها من النادل 📶 اضغط "نادِ نادل" وبيجيك حدا ع طول.', suggestions: [], offerWaiter: true };
  }
  if (q.hours) {
    return s.hours
      ? { reply: `دوامنا: ${s.hours} 🕗 وبنستناك بأي وقت!`, suggestions: [] }
      : { reply: 'ساعات الدوام بيأكدلك ياها النادل، اضغط "نادِ نادل" إذا بدك تعرف بالضبط 🙂', suggestions: [], offerWaiter: true };
  }

  // شرح صنف أو المقارنة بين صنفين
  const mentioned = findItems(lastUser?.text ?? '', ctx.items);
  const asksAbout = /شو|ايش|من شو|مكونات|بتتكون|بيتكون|مكون|يعني|الفرق|فرق|كيف بتعملو|بتعملوه|احكيلي عن|عرفني|اشرح|شرح|طعمه|طعمها|قوي|خفيف/.test(q.t);
  if (mentioned.length >= 2 && (asksAbout || /ولا|او|احسن|ابين/.test(q.t))) {
    const [a, b] = mentioned;
    const lines = [a, b].map((i) => `${i.name} (${fmt(i.price, cur)}): ${i.recipe || i.desc}`);
    const diff = [];
    if (a.caffeine !== b.caffeine) diff.push(`${a.caffeine > b.caffeine ? a.name : b.name} أقوى بالكافيين`);
    if (a.sugar !== b.sugar) diff.push(`${a.sugar > b.sugar ? a.name : b.name} أحلى`);
    if (a.temp !== b.temp && a.temp && b.temp) diff.push(`${a.temp === 'hot' ? a.name : b.name} سخن والثاني بارد`);
    return {
      reply: `${lines.join('\n')}\n${diff.length ? 'باختصار: ' + diff.join('، ') + '.' : ''} إنت بتحبها أقوى ولا أنعم؟ بقلك أنا شو بناسبك.`,
      suggestions: [a, b].map((i) => ({ item_id: i.id, qty: 1, sugar: '', for_whom: '' })),
    };
  }
  const wantsIt = /بدي|بدنا|عطيني|اعطيني|جيبلي|جيبولي|ابغى|اريد|لو سمحت|من فضلك|اطلبلي/.test(q.t);
  if (mentioned.length === 1 && (asksAbout || wantsIt || q.noSugar || q.t.trim().split(/\s+/).length <= 4)) {
    const i = mentioned[0];
    const qty = Math.min(12, Number((q.t.match(/(?:^|\s)(\d{1,2})(?=\s)/) || [])[1]) || 1);
    const sugar = i.sugarChoice ? (q.noSugar ? 'none' : q.lowSugar ? 'light' : '') : '';
    const notes = [
      i.caffeine >= 3 ? 'كافيينه عالي' : i.caffeine === 0 ? 'ما فيه كافيين' : '',
      i.sugar >= 3 ? 'حلو' : i.sugar === 0 ? 'ما فيه سكر أساساً' : '',
      sugar === 'none' ? 'وبنعمله بدون سكر متل ما بدك' : i.sugarChoice ? 'والسكر حسب ما بتحب' : '',
    ].filter(Boolean).join('، ');
    if (wantsIt && !asksAbout) {
      return {
        reply: `من عيوني! ${qty > 1 ? `${qty} × ` : ''}${i.name}${qty > 1 ? ` = ${fmt(i.price * qty, cur)}` : ` بـ${fmt(i.price, cur)}`}${notes ? `، ${notes}` : ''}. اضغط "أضف للسلة" تحت وبيوصلك ع الطاولة ☕`,
        suggestions: [{ item_id: i.id, qty, sugar, for_whom: '' }],
      };
    }
    return {
      reply: `${i.name}: ${i.recipe || i.desc}\nسعره ${fmt(i.price, cur)}${i.was ? ` بدل ${fmt(i.was, cur)}` : ''}${notes ? `، ${notes}` : ''}. بتحب أضيفلك ياه؟`,
      suggestions: [{ item_id: i.id, qty, sugar, for_whom: '' }],
    };
  }

  // "شو في أكل/حلويات/عصاير؟": بنعرض القسم بأسعاره
  const CAT_WORDS = [['bakery', /اكل|معجنات|سندويش|ساندويش|فطور/], ['dessert', /حلويات|تحلايه|تحلاية|حلو(?!ين)/], ['juice', /عصاير|عصير|فريش/], ['cold', /بارد|مثلج|ايس/], ['hot', /سخن|ساخن|قهوه|قهوة/]];
  if (/(?:شو|ايش|شي|وش)\s*(?:في|فيه|عندكم|عنكم|بتقدموا)/.test(q.t) && !q.budget && !q.people) {
    const hit = CAT_WORDS.find(([, re]) => re.test(q.t));
    const list = hit ? ctx.items.filter((i) => i.categoryId === hit[0]) : [];
    if (list.length) {
      const top = [...list].sort((a, b) => (popRank[b.id] ?? 0) - (popRank[a.id] ?? 0));
      return {
        reply: `عنا ${list.map((i) => `${i.name} (${fmt(i.price, cur)})`).join('، ')}. أكثر اشي بينطلب منهم ${top[0].name} 😋`,
        suggestions: top.slice(0, 2).map((i) => ({ item_id: i.id, qty: 1, sugar: '', for_whom: '' })),
      };
    }
  }

  // دردشة: كيفك، مين إنت، نكتة، مجاملة
  const popTwo = () => ctx.popular.slice(0, 2).map((p) => ({ item_id: p.id, qty: 1, sugar: '', for_whom: '' }));
  if (q.joke) return { reply: `${pick(JOKES)}\nوهلق بجد، شو بتحب أعملك؟`, suggestions: [] };
  if (q.whoAreYou) {
    return {
      reply: `أنا ${s.baristaName}، الباريستا تبع ${s.cafeName} 🤎 بعرف كل مشروب عنا من شو بيتكوّن، وبختارلك حسب مزاجك أو ميزانيتك أو قديش إنتو. وإذا بدك حدا من الفريق بناديلك ياه.`,
      suggestions: [],
    };
  }
  if (q.compliment) return { reply: pick(['تسلم يا غالي، إنت الأحلى 🤎 شو بتحب أعملك؟', 'يا عمري عليك! هيك بتخجّلني 😄 خليني أرد الجميل بفنجان على ذوقك؟']), suggestions: [] };
  if (q.howAreYou && !q.tired && !q.sad) {
    return {
      reply: `${pick(['تمام الحمدلله، وإنت كيفك؟', 'بخير والحمدلله، والريحة هون بتفتح النفس ☕ وإنت شو أخبارك؟', 'منيح كتير، خصوصاً إنك نوّرتنا 🙂 وإنت كيفك؟'])} ${ctx.time?.dayPart ? `هالوقت (${ctx.time.dayPart}) الناس عنا بتحب ${ctx.popular[0]?.name ?? 'القهوة'}.` : ''}`,
      suggestions: popTwo().slice(0, 1),
    };
  }
  if (q.sad && !q.budget && !q.people) {
    const comfort = ['hot-choc', 'sahlab', 'knafeh', 'lotus-cheesecake'].map((id) => ctx.items.find((i) => i.id === id)).filter(Boolean).slice(0, 2);
    const fallbackPick = comfort.length ? comfort : [...desserts].slice(0, 2);
    return {
      reply: `سلامة قلبك 🤎 الدنيا بتحلى بشي دافي وحلو. شو رأيك بـ${fallbackPick.map((i) => `${i.name} (${fmt(i.price, cur)})`).join(' أو ')}؟ وإذا بدك تحكي، أنا هون.`,
      suggestions: fallbackPick.map((i) => ({ item_id: i.id, qty: 1, sugar: '', for_whom: '' })),
    };
  }

  // الزبون ما عجبه الاقتراح: نستبعد اللي اقترحناه قبل
  const lastBot = [...history].reverse().find((m) => m.role === 'assistant');
  // "ما بحبوا السكر" مش رفض للاقتراح
  const rejected = /ما بحب(?![^.،,؟?]{0,8}سكر)|مش حابب|ما عجبني|ما بدي(?![^.،,؟?]{0,8}سكر)|غيرها|غيرو|غيره|اشي ثاني|اشي تاني|بدي غير|غير هيك/.test(q.t);
  const excluded = new Set(rejected ? (lastBot?.suggestionNames ?? []).map((n) => ctx.items.find((i) => n.startsWith(i.name))?.id).filter(Boolean) : []);
  if (rejected) parts.push('ولا يهمك، خليني أجربلك اشي ثاني.');

  const anyIntent = q.budget || q.people || q.lowSugar || temp || q.popular || q.sweet || q.focus || q.noCaffeine || q.hungry || q.weather || rejected;

  if (!anyIntent) {
    if (/^(?:تمام|ماشي|اوكي|اوك|ok|حلو|منيح|زاكي|يلا)\b/i.test(q.t.trim())) {
      return { reply: 'على راسي! اضغط "أضف للسلة" على اللي بدك ياه، وإذا بدك اشي حلو جنبه احكيلي 😉', suggestions: [] };
    }
    if (/شو عندكم|شو في عندكم|شو القائمه|شو القائمة|المنيو|شو بتقدموا/.test(q.t)) {
      const cats = [...new Set(ctx.items.map((i) => i.category))];
      return { reply: `عنا ${cats.join('، ')}. بتحب أبلشلك بالقهوة؟ ولا بدك اشي منعش؟`, suggestions: [] };
    }
    if (q.thanks) return { reply: 'تكرم عينك! إذا بدك اشي كمان أنا هون ☕', suggestions: [] };
    if (freshTable && ctx.table) {
      const top = ctx.table.topAtTable[0] ?? ctx.popular[0];
      parts.push('بتحب أقترحلك؟ احكيلي معك قديش، أو كم واحد إنتو، أو شو مزاجك اليوم.');
      return { reply: parts.join(' '), suggestions: top ? [{ item_id: top.id, qty: 1, sugar: '', for_whom: 'المفضّل على طاولتك' }] : [] };
    }
    if (q.tableAsk && !ctx.table) return { reply: 'طاولتك رقم كم؟ الرقم مكتوب على الطاولة نفسها.', suggestions: [] };

    // طلب اشي مش موجود بالمنيو: بنحكي بصراحة وبنقترح الأقرب
    const tn = norm(q.t); // اركيلة = اركيله
    const thing = requestedThing(tn);
    const asText = (list) => list.map((i) => `${i.name} (${fmt(i.price, cur)})`).join(' أو ');
    const cards = (list) => list.map((i) => ({ item_id: i.id, qty: 1, sugar: '', for_whom: '' }));
    const byPop = (list) => [...list].sort((a, b) => (popRank[b.id] ?? 0) - (popRank[a.id] ?? 0));
    if (WATER_WORDS.test(tn)) {
      return { reply: 'المي اطلبها من النادل وبيجيبلك ياها ع الطاولة 💧 اضغط "نادِ نادل".', suggestions: [], offerWaiter: true };
    }
    if (SHISHA_WORDS.test(tn)) {
      const chill = byPop(drinks).slice(0, 2);
      return { reply: `الأراكيل مش عندي بالقائمة 🙏 اسأل النادل إذا متوفرة. بس للقعدة الرايقة بنصحك بـ${asText(chill)}.`, suggestions: cards(chill), offerWaiter: true };
    }
    if (thing || SODA_WORDS.test(tn) || FOOD_WORDS.test(tn) || SWEET_WORDS.test(tn)) {
      const name = thing ? `"${thing}"` : 'هاد الصنف';
      if (SODA_WORDS.test(tn)) {
        const fresh = byPop(ctx.items.filter((i) => ['juice', 'cold'].includes(i.categoryId))).slice(0, 2);
        return { reply: `ما عنا مشروبات غازية للأسف، بس عنا اشي منعش أطيب: ${asText(fresh)} 🧊`, suggestions: cards(fresh) };
      }
      if (FOOD_WORDS.test(tn)) {
        const alt = byPop(food).slice(0, 2);
        return { reply: `${name} مش موجود عنا للأسف 🙏 الأكل عنا خفيف: ${food.map((i) => i.name).join('، ')}. جرّب ${asText(alt)}.`, suggestions: cards(alt) };
      }
      if (SWEET_WORDS.test(tn)) {
        const alt = byPop(desserts).slice(0, 2);
        return { reply: `${name} مش عنا هلأ، بس الحلو عنا بيعوّض: ${asText(alt)} 😋`, suggestions: cards(alt) };
      }
      const alt = (DRINK_WORDS.test(tn) ? byPop(drinks) : byPop([...drinks, ...desserts])).slice(0, 2);
      return { reply: `دوّرت عـ${name} بالمنيو وما لقيته 🤔 بس يمكن يعجبك ${asText(alt)}. وإذا بدك اشي معيّن، النادل بيقدر يساعدك.`, suggestions: cards(alt) };
    }

    if (q.greeting) {
      return {
        reply: `${pick(['يا هلا فيك! نوّرت', 'أهلين وسهلين، نوّرت', 'يا مية هلا'])} ${s.cafeName} ☕ أنا ${s.baristaName}. شو جاي عبالك: اشي سخن يدفّيك ولا بارد ينعشك؟`,
        suggestions: popTwo(),
      };
    }
    return {
      reply: pick([
        'ما فهمت عليك منيح 😅 بس ولا يهمك: احكيلي شو جاي عبالك (سخن ولا بارد، حلو ولا مر)، أو كم واحد إنتو، أو معك قديش.',
        'سامحني ما لقطتها 🙈 جرّب تحكيلي مزاجك بكلمتين، أو اسألني عن أي مشروب وبشرحلك من شو بيتكوّن.',
        'خليني أساعدك أحسن: بدك اشي يصحصح، اشي منعش، ولا اشي حلو؟ وهاي اللي ماشية كتير عنا اليوم 👇',
      ]),
      suggestions: popTwo(),
    };
  }

  // اختيار المشروبات
  const count = q.people ?? (q.budget && !q.popular ? 1 : q.popular ? 3 : 1);
  const lowCount = q.lowSugar === -1 ? count : Math.min(q.lowSugar, count);
  let pool = drinks.filter((i) => !excluded.has(i.id) && !(temp === 'hot' && i.temp === 'cold') && !(temp === 'cold' && i.temp === 'hot'));
  if (q.noCaffeine) pool = pool.filter((i) => i.caffeine === 0).length ? pool.filter((i) => i.caffeine === 0) : pool;
  if (q.coffee && pool.some(isCoffee)) pool = pool.filter(isCoffee);
  // التعبان بدّه كافيين حقيقي، حتى لو طاولته بتحب النسكافيه
  if (q.tired && !q.noCaffeine && pool.some((i) => i.caffeine >= 2)) pool = pool.filter((i) => i.caffeine >= 2);
  if (!pool.length) pool = drinks;
  const ranked = [...pool].sort((a, b) => score(b) - score(a));
  const lowPool = ranked.filter((i) => i.sugar <= 1);

  const picks = [];
  const take = (list, n, label, sugar) => {
    for (let k = 0; k < n; k++) {
      const used = new Set(picks.map((p) => p.item.id));
      const item = list.find((i) => !used.has(i.id)) ?? list[k % Math.max(1, list.length)];
      if (item) picks.push({ item, sugar: sugar && item.sugarChoice ? sugar : '', for_whom: label });
    }
  };
  const lowSugarLevel = q.noSugar ? 'none' : 'light';
  if (lowCount > 0) take(lowPool.length ? lowPool : ranked, lowCount, lowCount === count ? '' : 'للي ما بحبوا السكر', lowSugarLevel);
  take(ranked, count - lowCount, lowCount > 0 ? 'للباقي' : '', '');

  // ملاءمة الميزانية: بدّل الأغلى بالأرخص لحد ما يزبط
  const total = () => picks.reduce((s, p) => s + p.item.price, 0);
  if (q.budget) {
    const cheap = [...pool].sort((a, b) => a.price - b.price);
    let guard = 0;
    while (total() > q.budget && guard++ < 40) {
      picks.sort((a, b) => b.item.price - a.item.price);
      const worst = picks[0];
      const alt = cheap.find((i) => i.price < worst.item.price && (worst.for_whom !== 'للي ما بحبوا السكر' || i.sugar <= 1));
      if (alt) worst.item = alt; else picks.shift();
      if (!picks.length) break;
    }
  }

  // حلو أو أكل إذا طُلب وبقي مجال
  const extras = [];
  const remaining = () => (q.budget ? q.budget - total() - extras.reduce((s, e) => s + e.item.price, 0) : Infinity);
  const addExtra = (list, label) => {
    const choice = [...list].sort((a, b) => (popRank[b.id] ?? 0) + (tableRank[b.id] ?? 0) - (popRank[a.id] ?? 0) - (tableRank[a.id] ?? 0))
      .find((i) => i.price <= remaining() && (lowCount !== count || i.sugar <= 2));
    if (choice) extras.push({ item: choice, sugar: '', for_whom: label });
  };
  if (q.sweet || (q.people && q.people >= 3 && !q.budget)) addExtra(desserts, q.people ? 'للمشاركة' : '');
  if (q.hungry) addExtra(food, '');
  else if (q.budget && !q.people && !q.sweet && remaining() >= 6) addExtra([...food, ...desserts], 'جنب المشروب');

  // تجميع الاقتراحات بالكميات
  const merged = [];
  for (const p of [...picks, ...extras]) {
    const m = merged.find((x) => x.item_id === p.item.id && x.sugar === p.sugar && x.for_whom === p.for_whom);
    if (m) m.qty++; else merged.push({ item_id: p.item.id, qty: 1, sugar: p.sugar, for_whom: p.for_whom, _item: p.item });
  }
  const sum = merged.reduce((s, m) => s + m._item.price * m.qty, 0);

  if (!merged.length) {
    const cheapest = [...drinks].sort((a, b) => a.price - b.price)[0];
    parts.push(`المبلغ ما بيكفي للأسف، أرخص اشي عنا ${cheapest.name} بـ${fmt(cheapest.price, cur)}.`);
    return { reply: parts.join(' '), suggestions: [] };
  }

  const names = merged.map((m) => `${m._item.name}${m.qty > 1 ? ` ×${m.qty}` : ''}`).join('، ');
  if (q.popular && !q.people && !q.budget) {
    parts.push(`الأكثر طلباً عنا هالفترة: ${names}. ${merged[0]._item.name} بالذات ما بينزل عن الطاولات!`);
  } else if (q.people) {
    parts.push(`لـ${q.people} أشخاص اخترتلكم: ${names}${lowCount > 0 && lowCount < count ? ` — ولـ${lowCount} اللي ما بحبوا السكر اخترت أصناف خفيفة وحطيت سكر خفيف` : ''}.`);
  } else if (q.tired) {
    parts.push(`يعطيك العافية 🤍 بدك اشي يرجّعلك طاقتك: ${names}${q.noSugar ? ' (بدون سكر)' : ''}.`);
  } else if (q.coffee) {
    parts.push(`قهوتك عندي${q.noSugar ? ' بدون سكر' : ''}: ${names}.`);
  } else if (q.focus) {
    parts.push(`بدك تركيز؟ ${names} بيصحصحك وبيضل معك.`);
  } else {
    parts.push(`على ذوقي: ${names}.`);
  }
  parts.push(`المجموع ${fmt(sum, cur)}${q.budget ? ` وبيضل معك ${fmt(q.budget - sum, cur)}` : ''}.`);
  if (!ctx.table && (q.people || q.budget)) parts.push('وإذا بدك تطلب، طاولتك رقم كم؟');
  else parts.push('اضغط "أضف للسلة" وبتوصلك ع الطاولة.');

  return { reply: parts.join(' '), suggestions: merged.map(({ _item, ...s }) => s) };
}
