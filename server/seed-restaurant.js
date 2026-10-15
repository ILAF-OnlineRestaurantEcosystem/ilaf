// قالب المطعم: مطبخ فلسطيني (مقبلات، طبخات، مشاوي، سندويشات، مشروبات، حلويات)
// بيستخدمه buildSeed لما نوع المحل "مطعم"، وزر "حمّل قائمة المطعم" بلوحة الكاشير
const IMG = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=640&q=70`;

export const R_CATEGORIES = [
  { id: 'starters', name: 'مقبلات وشوربات', en: 'Starters', desc: 'صحون صغيرة للمشاركة قبل الطبخة', temp: null, icon: 'sandwich', order: 1 },
  { id: 'mains', name: 'طبخات البيت', en: 'Main Dishes', desc: 'طبخات فلسطينية على أصولها، زي أكل الستّ', temp: 'hot', icon: 'knafeh', order: 2 },
  { id: 'grills', name: 'مشاوي', en: 'Grills', desc: 'على الفحم، طازة من المنقل', temp: 'hot', icon: 'sandwich', order: 3 },
  { id: 'sandwiches', name: 'سندويشات', en: 'Sandwiches', desc: 'سريعة وشبعانة، بخبز الصاج والكماج', temp: null, icon: 'sandwich', order: 4 },
  { id: 'drinks', name: 'مشروبات', en: 'Drinks', desc: 'باردة مع الأكل، وقهوة عربية بعده', temp: 'cold', icon: 'glass', order: 5 },
  { id: 'r-dessert', name: 'حلويات', en: 'Desserts', desc: 'حلو بعد الأكل، على الطريقة الشامية', temp: null, icon: 'cake', order: 6 },
];

// sugar/caffeine بيضلّوا 0 للأكل؛ tags بيستعملها نديم ليقترح ويرتّب البدائل
export const R_ITEMS = [
  // مقبلات وشوربات
  { id: 'hummus', categoryId: 'starters', name: 'حمص بطحينة', desc: 'حمص ناعم بالطحينة وزيت الزيتون، مع خبز سخن.', price: 12, art: 'sandwich', hue: 40, tags: ['نباتي', 'مشاركة', 'خفيف', 'تقليدي'] },
  { id: 'mutabbal', categoryId: 'starters', name: 'متبّل باذنجان', desc: 'باذنجان مشوي على الفحم مع طحينة وثوم وليمون.', price: 12, art: 'sandwich', hue: 30, tags: ['نباتي', 'مشاركة', 'مدخّن'] },
  { id: 'falafel', categoryId: 'starters', name: 'صحن فلافل', desc: '8 حبات فلافل مقرمشة مع طحينة ومخلل.', price: 10, art: 'sandwich', hue: 28, tags: ['نباتي', 'مقلي', 'مشاركة'] },
  { id: 'fattoush', categoryId: 'starters', name: 'فتوش', desc: 'خضار طازة مع خبز محمّص وسماق ودبس رمان.', price: 14, art: 'sandwich', hue: 90, tags: ['نباتي', 'سلطة', 'خفيف', 'حامض'] },
  { id: 'tabbouleh', categoryId: 'starters', name: 'تبولة', desc: 'بقدونس مفروم ناعم مع برغل وبندورة وليمون.', price: 14, art: 'sandwich', hue: 100, tags: ['نباتي', 'سلطة', 'خفيف', 'حامض'] },
  { id: 'lentil-soup', categoryId: 'starters', name: 'شوربة عدس', desc: 'عدس مجروش بالكمون، مع ليمون وخبز محمّص.', price: 12, art: 'mug', hue: 34, tags: ['نباتي', 'شوربة', 'شتوي', 'خفيف'] },
  // طبخات
  { id: 'maqluba', categoryId: 'mains', name: 'مقلوبة دجاج', desc: 'رز مع باذنجان وقرنبيط مقلي ودجاج، بتنقلب قدّامك.', price: 45, art: 'knafeh', hue: 36, tags: ['دجاج', 'رز', 'تقليدي', 'مشاركة', 'شبعان'] },
  { id: 'musakhan', categoryId: 'mains', name: 'مسخّن', desc: 'نص جاجة على خبز طابون مع بصل وسماق وزيت زيتون.', price: 45, art: 'knafeh', hue: 18, tags: ['دجاج', 'تقليدي', 'سماق', 'شبعان'] },
  { id: 'mansaf', categoryId: 'mains', name: 'منسف', desc: 'لحمة خروف مطبوخة بالجميد، على رز وشراك ومكسرات.', price: 60, art: 'knafeh', hue: 44, tags: ['لحمة', 'رز', 'تقليدي', 'مناسبات', 'شبعان'] },
  { id: 'kofta-tahini', categoryId: 'mains', name: 'كفتة بالطحينة', desc: 'كفتة لحمة مع بطاطا بصينية فرن وصوص طحينة.', price: 42, art: 'knafeh', hue: 26, tags: ['لحمة', 'فرن', 'تقليدي'] },
  // مشاوي
  { id: 'shish-tawook', categoryId: 'grills', name: 'شيش طاووق', desc: 'صدر دجاج متبّل باللبن والثوم، مع ثومية وبطاطا.', price: 38, art: 'sandwich', hue: 32, tags: ['دجاج', 'مشاوي', 'ثوم'] },
  { id: 'kebab', categoryId: 'grills', name: 'كباب', desc: 'لحمة مفرومة بالبقدونس والبصل، مع خبز مشروح وسلطة.', price: 40, art: 'sandwich', hue: 20, tags: ['لحمة', 'مشاوي'] },
  { id: 'mixed-grill', categoryId: 'grills', name: 'مشاوي مشكّلة (لشخصين)', desc: 'كباب وشيش طاووق وشقف لحمة، مع ثومية ومخلل وخبز.', price: 75, art: 'sandwich', hue: 16, tags: ['لحمة', 'دجاج', 'مشاوي', 'مشاركة', 'شبعان'] },
  { id: 'shawarma-plate', categoryId: 'grills', name: 'صحن شاورما', desc: 'شاورما دجاج مع بطاطا وثومية ومخلل.', price: 32, art: 'sandwich', hue: 30, tags: ['دجاج', 'شاورما', 'ثوم'] },
  // سندويشات
  { id: 'shawarma-wrap', categoryId: 'sandwiches', name: 'سندويش شاورما', desc: 'شاورما دجاج بخبز الصاج مع ثومية ومخلل.', price: 18, art: 'sandwich', hue: 30, tags: ['دجاج', 'شاورما', 'سريع'] },
  { id: 'falafel-wrap', categoryId: 'sandwiches', name: 'سندويش فلافل', desc: 'فلافل سخنة مع طحينة وبندورة ومخلل.', price: 8, art: 'sandwich', hue: 40, tags: ['نباتي', 'سريع', 'رخيص'] },
  { id: 'tawook-sandwich', categoryId: 'sandwiches', name: 'سندويش طاووق', desc: 'شيش طاووق مشوي مع ثومية وبطاطا، بخبز كماج.', price: 20, art: 'sandwich', hue: 34, tags: ['دجاج', 'مشاوي', 'سريع'] },
  // مشروبات
  { id: 'lemon-mint-r', categoryId: 'drinks', name: 'ليمون ونعنع', desc: 'ليمون معصور مع نعنع وثلج.', price: 10, art: 'juice', hue: 70, tags: ['بارد', 'منعش', 'حامض'], sugarChoice: true },
  { id: 'ayran', categoryId: 'drinks', name: 'لبن عيران', desc: 'لبن بارد بشوية ملح ونعنع، رفيق المشاوي.', price: 5, art: 'glass', hue: 50, tags: ['بارد', 'لبن', 'مع المشاوي'] },
  { id: 'soda', categoryId: 'drinks', name: 'مشروب غازي', desc: 'كولا أو سبرايت أو فانتا، بارد مع ثلج.', price: 5, art: 'bottle', hue: 10, tags: ['بارد', 'غازي'] },
  { id: 'water', categoryId: 'drinks', name: 'مي معدنية', desc: 'قنينة نص لتر باردة.', price: 2, art: 'bottle', hue: 200, tags: ['بارد'] },
  { id: 'arabic-coffee', categoryId: 'drinks', name: 'قهوة عربية', desc: 'سادة بالهيل من الدلّة، بعد الأكل.', price: 5, art: 'turkish', hue: 30, tags: ['قهوة', 'هيل', 'تقليدي', 'ساخن'], caffeine: 2 },
  { id: 'mint-tea-r', categoryId: 'drinks', name: 'شاي بالنعنع', desc: 'إبريق شاي بالنعنع الطازة، بيكفي 2–3.', price: 8, art: 'tea', hue: 8, tags: ['شاي', 'ساخن', 'مشاركة', 'بعد الأكل'], sugarChoice: true, caffeine: 1 },
  // حلويات
  { id: 'knafeh-r', categoryId: 'r-dessert', name: 'كنافة نابلسية', desc: 'جبنة نابلسية سايحة تحت كنافة ناعمة وقطر.', price: 18, art: 'knafeh', hue: 28, tags: ['حلو', 'جبنة', 'تقليدي', 'مشاركة'], sugar: 3 },
  { id: 'muhallebi', categoryId: 'r-dessert', name: 'مهلبية', desc: 'مهلبية بماء الزهر مع فستق حلبي مطحون.', price: 12, art: 'cake', hue: 44, tags: ['حلو', 'بارد', 'خفيف'], sugar: 2 },
  { id: 'qatayef', categoryId: 'r-dessert', name: 'قطايف', desc: 'قطايف بالجوز أو بالقشطة، مقلية مع قطر.', price: 15, art: 'cake', hue: 32, tags: ['حلو', 'تقليدي', 'رمضاني'], sugar: 3 },
];

// شو بيعرف نديم عن كل طبق (مكوّنات وطريقة) عشان يجاوب الزباين
export const R_RECIPES = {
  hummus: 'حمص مسلوق ومطحون ناعم مع طحينة وليمون وثوم، فوقه زيت زيتون وحمص حب وبابريكا. نباتي وبدون جلوتين (الخبز لحاله).',
  mutabbal: 'باذنجان بينشوى كامل على الفحم لحد ما يطري، بينقشّر وبيتهرس مع طحينة وثوم وليمون ولبن خفيف. طعمه مدخّن.',
  falafel: 'حمص منقوع مطحون مع بقدونس وكزبرة وبصل وثوم وكمون، بينقلى بالزيت. نباتي.',
  fattoush: 'خس وبندورة وخيار وفجل ونعنع، مع خبز محمّص، والتتبيلة زيت زيتون وليمون ودبس رمان وسماق.',
  tabbouleh: 'بقدونس كثير مفروم ناعم مع برغل ناعم وبندورة وبصل أخضر ونعنع، بزيت الزيتون والليمون.',
  'lentil-soup': 'عدس أحمر مع بصل وجزر وكمون، مطحون ناعم. بتنقدّم مع ليمون وخبز محمّص. نباتية.',
  maqluba: 'رز مطبوخ بمرق الدجاج مع طبقات باذنجان وقرنبيط وبطاطا مقلية، بينقلب الطنجرة على الصدر قدّام الزبون، فوقه لوز وصنوبر. بتتقدّم مع لبن أو سلطة.',
  musakhan: 'دجاج متبّل بالسماق والبهارات بينشوى، وبيتحط على خبز طابون مدهون بزيت زيتون وبصل كثير مقلي بالسماق، وفوقه صنوبر. أكلة الزيتون الفلسطينية.',
  mansaf: 'لحمة خروف مطبوخة بلبن الجميد الكركي، على رز أصفر وخبز شراك، مع لوز وصنوبر محمّص، والجميد بيتسكب فوقه. طبق المناسبات.',
  'kofta-tahini': 'أقراص كفتة لحمة مع بقدونس وبصل، بصينية مع شرائح بطاطا وبندورة، وفوقها صوص طحينة بالليمون وبتدخل الفرن.',
  'shish-tawook': 'مكعبات صدر دجاج متبّلة بلبن وثوم وليمون وبابريكا ودبس فلفل، بتنشوى على الفحم. بتنقدّم مع ثومية وبطاطا مقلية.',
  kebab: 'لحمة عجل وخروف مفرومة مع بقدونس وبصل وبهارات، على أسياخ فوق الفحم. مع خبز وبصل بالسماق وبندورة مشوية.',
  'mixed-grill': 'سيخين كباب وسيخين شيش طاووق وسيخ شقف لحمة، مع بندورة وبصل مشوي، ثومية، مخلل، وخبز. بيكفي شخصين.',
  'shawarma-plate': 'دجاج متبّل بالبهارات والليمون مشوي على السيخ العامودي، مقطّع شرائح، مع بطاطا وثومية ومخلل.',
  'shawarma-wrap': 'شرائح شاورما دجاج بخبز صاج رقيق مع ثومية ومخلل وبطاطا، ملفوف ومحمّص.',
  'falafel-wrap': 'أقراص فلافل مع طحينة وبندورة وخيار مخلل وبقدونس، بخبز كماج.',
  'tawook-sandwich': 'شيش طاووق مشوي مع ثومية وبطاطا ومخلل، بخبز كماج.',
  'lemon-mint-r': 'ليمون معصور مع نعنع مطحون وثلج، والسكر حسب طلبك.',
  ayran: 'لبن رايب مخفوق مع مي باردة وشوية ملح، أحياناً نعنع ناشف.',
  'arabic-coffee': 'قهوة عربية شقرا مغلية بالهيل بالدلّة، سادة بدون سكر، بفناجين صغيرة.',
  'mint-tea-r': 'شاي أحمر مع نعنع طازة بإبريق، والسكر حسب طلبك.',
  'knafeh-r': 'جبنة نابلسية محلّاة بتسيح بين طبقتين كنافة ناعمة بالسمنة، بتنخبز وبتتسقى قطر، وفوقها فستق.',
  muhallebi: 'حليب مع نشا وسكر وماء زهر، بيتطبخ لحد ما يثقل، بيبرد وبيتزيّن بالفستق الحلبي.',
  qatayef: 'عجينة قطايف محشية جوز بالقرفة أو قشطة، بتنقلى أو بتنخبز وبتتسقى قطر.',
};

export const R_COSTS = {
  hummus: 3, mutabbal: 3.5, falafel: 2, fattoush: 3.5, tabbouleh: 3.5, 'lentil-soup': 2.5,
  maqluba: 16, musakhan: 17, mansaf: 26, 'kofta-tahini': 15,
  'shish-tawook': 13, kebab: 15, 'mixed-grill': 30, 'shawarma-plate': 11,
  'shawarma-wrap': 6.5, 'falafel-wrap': 2.5, 'tawook-sandwich': 7,
  'lemon-mint-r': 2.5, ayran: 1.5, soda: 2.2, water: 0.8, 'arabic-coffee': 1, 'mint-tea-r': 1.5,
  'knafeh-r': 6, muhallebi: 3, qatayef: 5,
};

export const R_IMAGES = {
  'hummus': IMG('photo-1687244433510-747e3fd97afe'),
  'mutabbal': IMG('photo-1627308595127-d9acf19107ce'),
  'falafel': IMG('photo-1680990999782-ba7fe26e4d0b'),
  'fattoush': IMG('photo-1572449043416-55f4685c9bb7'),
  'tabbouleh': IMG('photo-1594040815645-5442fb6d48f6'),
  'lentil-soup': IMG('photo-1605909388460-74ec8b204127'),
  'maqluba': IMG('photo-1719239885399-f87d992e0f18'),
  'musakhan': IMG('photo-1687020835890-b0b8c6a04613'),
  'mansaf': IMG('photo-1778634304493-23531df07739'),
  'kofta-tahini': IMG('photo-1615385361723-9f4c2daf42f4'),
  'shish-tawook': IMG('photo-1594266063697-304befca9629'),
  'kebab': IMG('photo-1532636875304-0c89119d9b4d'),
  'mixed-grill': IMG('photo-1750190624608-57ceddba8d69'),
  'shawarma-plate': IMG('photo-1777199298385-07e46ccc2004'),
  'shawarma-wrap': IMG('photo-1719282431723-9d0f4370d4bc'),
  'falafel-wrap': IMG('photo-1604908816649-c8bdfc3ca68b'),
  'tawook-sandwich': IMG('photo-1662116765994-1e4200c43589'),
  'lemon-mint-r': IMG('photo-1575596510825-f748919a2bf7'),
  'ayran': IMG('photo-1555791902-2bd22de5cd9c'),
  'soda': IMG('photo-1629654613528-5d0a2e4166de'),
  'water': IMG('photo-1660303438028-b59af33c618c'),
  'arabic-coffee': IMG('photo-1604924434662-4127d9fa3070'),
  'mint-tea-r': IMG('photo-1591299089616-c9604047b1a6'),
  'knafeh-r': IMG('photo-1778447812923-88a9e3e6b567'),
  'muhallebi': IMG('photo-1604748839931-5b5104964970'),
  'qatayef': IMG('photo-1605566815186-9a7c30a381bc'),
};

export const R_CATEGORY_IMAGES = {
  'starters': IMG('photo-1787069789754-636ce94929e5'),
  'mains': IMG('photo-1748540459503-19efc015143b'),
  'grills': IMG('photo-1555939594-58d7cb561ad1'),
  'sandwiches': IMG('photo-1530469912745-a215c6b256ea'),
  'drinks': IMG('photo-1507281549113-040fcfef650e'),
  'r-dessert': IMG('photo-1778447812923-88a9e3e6b567'),
};

export const R_OFFERS = [
  {
    id: 'family-meal', type: 'combo', title: 'سفرة العيلة', active: true,
    description: 'مقلوبة دجاج مع حمص وفتوش و4 مشروبات غازية.',
    itemIds: ['maqluba', 'hummus', 'fattoush', 'soda', 'soda', 'soda', 'soda'], price: 80, percent: 0,
  },
  {
    id: 'quick-lunch', type: 'combo', title: 'غدا سريع', active: true,
    description: 'سندويش شاورما مع لبن عيران.',
    itemIds: ['shawarma-wrap', 'ayran'], price: 20, percent: 0,
  },
  {
    id: 'grill-night', type: 'combo', title: 'سهرة مشاوي', active: true,
    description: 'مشاوي مشكّلة لشخصين مع متبّل وكاسين لبن عيران.',
    itemIds: ['mixed-grill', 'mutabbal', 'ayran', 'ayran'], price: 85, percent: 0,
  },
];

export const R_ZONES = [
  { id: 'hall', name: 'الصالة الرئيسية', description: 'طاولات 4 أشخاص، جو حيوي وقت الغدا.' },
  { id: 'family', name: 'القاعة العائلية', description: 'طاولات كبيرة للعائلات والعزايم، طلبات مشاركة وطبخات.' },
  { id: 'terrace', name: 'التراس', description: 'جلسة خارجية، مشاوي وأراجيل وقعدات مسا.' },
  { id: 'majlis', name: 'الجلسة العربية', description: 'فرشات أرضية وقهوة عربية، للمناسف والسفرات.' },
];
export const R_TABLE_COUNT = 24;
export function rZoneForTable(n) {
  if (n <= 10) return 'hall';
  if (n <= 16) return 'family';
  if (n <= 21) return 'terrace';
  return 'majlis';
}
export const rSeats = (zoneId) => (zoneId === 'family' ? 8 : zoneId === 'majlis' ? 10 : 4);

// تفضيلات كل منطقة لتوليد سجل طلبات تجريبي واقعي
export const R_TASTE = {
  hall: { 'shawarma-plate': 6, 'shish-tawook': 5, kebab: 4, hummus: 5, falafel: 3, soda: 7, 'lemon-mint-r': 4, 'shawarma-wrap': 5, 'tawook-sandwich': 3, fattoush: 3, water: 3 },
  family: { maqluba: 7, musakhan: 5, 'mixed-grill': 4, hummus: 6, fattoush: 5, tabbouleh: 4, soda: 8, 'knafeh-r': 4, muhallebi: 3, 'lentil-soup': 3 },
  terrace: { 'mixed-grill': 6, kebab: 5, 'shish-tawook': 5, mutabbal: 4, hummus: 4, ayran: 5, 'mint-tea-r': 4, 'arabic-coffee': 3, 'knafeh-r': 3 },
  majlis: { mansaf: 8, maqluba: 4, 'kofta-tahini': 3, hummus: 3, 'arabic-coffee': 7, 'mint-tea-r': 4, qatayef: 3, water: 3 },
};
// ساعات الضغط بالمطعم: الغدا والعشا
export const R_HOURS = { 11: 2, 12: 5, 13: 8, 14: 8, 15: 5, 16: 3, 17: 3, 18: 5, 19: 8, 20: 9, 21: 7, 22: 4, 23: 1 };
