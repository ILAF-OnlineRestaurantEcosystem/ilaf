// البيانات الأولية: القائمة، المناطق، الطاولات، العروض، وسجل طلبات تجريبي
// يعطي الباريستا الذكي "ذاكرة" من أول تشغيل (طاولة 33 للقهوة، طاولة 20 للنسكافيه مع التحلاية…)
import { summarize } from './reports.js';

const CATEGORIES = [
  { id: 'hot', name: 'مشروبات ساخنة', en: 'Hot Drinks', desc: 'قهوة مختصة وشاي ومشروبات بتدفّي القلب', temp: 'hot', icon: 'cup', order: 1 },
  { id: 'cold', name: 'مشروبات باردة', en: 'Cold Drinks', desc: 'انتعش بأطيب المشروبات الباردة والمثلّجة', temp: 'cold', icon: 'iced', order: 2 },
  { id: 'juice', name: 'عصائر طبيعية', en: 'Fresh Juices', desc: 'فواكه طازة معصورة على الطلب', temp: 'cold', icon: 'juice', order: 3 },
  { id: 'dessert', name: 'حلويات', en: 'Desserts', desc: 'حلويات بيتية بتحلّي قعدتك', temp: null, icon: 'cake', order: 4 },
  { id: 'bakery', name: 'معجنات وأطعمة', en: 'Food & Bakery', desc: 'مخبوزات طازة ووجبات خفيفة بتفتح النفس', temp: null, icon: 'croissant', order: 5 },
];

// sugar: الحلاوة الطبيعية للصنف (0 بدون — 3 حلو جداً) | caffeine: 0–3
const ITEMS = [
  // ساخن
  { id: 'espresso', categoryId: 'hot', name: 'إسبريسو', desc: 'شوت مركّز من محمصتنا، بنكهة الكاكاو والكراميل المحروق.', price: 8, art: 'espresso', hue: 24, sugar: 0, caffeine: 3, tags: ['قهوة', 'مركّز', 'تركيز'], sugarChoice: true },
  { id: 'americano', categoryId: 'hot', name: 'أمريكانو', desc: 'إسبريسو مع ماء ساخن، طويل وخفيف ويرافقك لساعات شغل.', price: 10, art: 'cup', hue: 22, sugar: 0, caffeine: 3, tags: ['قهوة', 'شغل', 'تركيز'], sugarChoice: true },
  { id: 'turkish', categoryId: 'hot', name: 'قهوة عربية تركية', desc: 'محوّجة بالهيل، على الرملة وبالفنجان.', price: 6, art: 'turkish', hue: 30, sugar: 1, caffeine: 2, tags: ['قهوة', 'هيل', 'تقليدي'], sugarChoice: true },
  { id: 'cappuccino', categoryId: 'hot', name: 'كابتشينو', desc: 'إسبريسو مع حليب مبخّر ورغوة كثيفة.', price: 12, art: 'cup', hue: 32, sugar: 1, caffeine: 2, tags: ['قهوة', 'حليب'], sugarChoice: true },
  { id: 'latte', categoryId: 'hot', name: 'لاتيه', desc: 'حليب ناعم فوق شوت إسبريسو، قوام مخملي.', price: 13, art: 'cup', hue: 36, sugar: 1, caffeine: 2, tags: ['قهوة', 'حليب', 'خفيف'], sugarChoice: true },
  { id: 'spanish', categoryId: 'hot', name: 'سبانش لاتيه', desc: 'لاتيه بالحليب المكثّف المحلّى، دافئ وحلو.', price: 15, art: 'cup', hue: 38, sugar: 3, caffeine: 2, tags: ['قهوة', 'حليب', 'حلو'], sugarChoice: false },
  { id: 'mocha', categoryId: 'hot', name: 'موكا', desc: 'إسبريسو مع شوكولاتة داكنة وحليب.', price: 14, art: 'mug', hue: 18, sugar: 2, caffeine: 2, tags: ['قهوة', 'شوكولاتة'], sugarChoice: false },
  { id: 'nescafe', categoryId: 'hot', name: 'نسكافيه بالحليب', desc: 'الكلاسيكي اللي ما بيخلص، رغوة وحليب ساخن.', price: 8, art: 'mug', hue: 34, sugar: 2, caffeine: 1, tags: ['قهوة', 'حليب', 'كلاسيكي'], sugarChoice: true },
  { id: 'mint-tea', categoryId: 'hot', name: 'شاي بالنعنع', desc: 'شاي أحمر مع نعنع طازة من الحاكورة.', price: 5, art: 'tea', hue: 8, sugar: 1, caffeine: 1, tags: ['شاي', 'نعنع', 'تقليدي'], sugarChoice: true },
  { id: 'sahlab', categoryId: 'hot', name: 'سحلب', desc: 'سحلب كثيف بالقرفة وجوز الهند والمكسرات.', price: 10, art: 'mug', hue: 42, sugar: 2, caffeine: 0, tags: ['شتوي', 'حليب', 'بدون كافيين'], sugarChoice: false },
  { id: 'hot-choc', categoryId: 'hot', name: 'هوت شوكليت', desc: 'شوكولاتة بلجيكية ذائبة بالحليب مع مارشميلو.', price: 12, art: 'mug', hue: 14, sugar: 3, caffeine: 0, tags: ['شوكولاتة', 'شتوي', 'بدون كافيين', 'أطفال'], sugarChoice: false },
  { id: 'karak', categoryId: 'hot', name: 'شاي كرك', desc: 'شاي بالحليب والهيل والزعفران.', price: 8, art: 'tea', hue: 30, sugar: 2, caffeine: 1, tags: ['شاي', 'حليب', 'هيل'], sugarChoice: true },

  // بارد
  { id: 'iced-latte', categoryId: 'cold', name: 'آيس لاتيه', desc: 'إسبريسو وحليب بارد على ثلج.', price: 14, art: 'iced', hue: 34, sugar: 1, caffeine: 2, tags: ['قهوة', 'حليب', 'منعش'], sugarChoice: true },
  { id: 'iced-spanish', categoryId: 'cold', name: 'آيس سبانش لاتيه', desc: 'نسخة الثلج من المفضّل عند الكل.', price: 16, art: 'iced', hue: 38, sugar: 3, caffeine: 2, tags: ['قهوة', 'حلو', 'منعش'], sugarChoice: false },
  { id: 'cold-brew', categoryId: 'cold', name: 'كولد برو', desc: 'قهوة منقوعة 18 ساعة، ناعمة وقوية بلا مرارة.', price: 15, art: 'bottle', hue: 20, sugar: 0, caffeine: 3, tags: ['قهوة', 'تركيز', 'شغل'], sugarChoice: true },
  { id: 'caramel-frappe', categoryId: 'cold', name: 'فرابيه كراميل', desc: 'قهوة مثلّجة مخفوقة مع كراميل وكريمة.', price: 16, art: 'frappe', hue: 32, sugar: 3, caffeine: 1, tags: ['قهوة', 'حلو', 'صيفي'], sugarChoice: false },
  { id: 'iced-mocha', categoryId: 'cold', name: 'آيس موكا', desc: 'شوكولاتة وإسبريسو وحليب على ثلج.', price: 16, art: 'iced', hue: 16, sugar: 2, caffeine: 2, tags: ['قهوة', 'شوكولاتة', 'منعش'], sugarChoice: false },
  { id: 'mojito', categoryId: 'cold', name: 'موهيتو ليمون ونعنع', desc: 'صودا مع ليمون ونعنع مهروس وثلج مجروش.', price: 12, art: 'mojito', hue: 110, sugar: 2, caffeine: 0, tags: ['منعش', 'صيفي', 'بدون كافيين'], sugarChoice: true },
  { id: 'peach-tea', categoryId: 'cold', name: 'آيس تي خوخ', desc: 'شاي مبرّد بالخوخ وشرائح الليمون.', price: 10, art: 'glass', hue: 28, sugar: 2, caffeine: 1, tags: ['شاي', 'منعش'], sugarChoice: true },
  { id: 'oreo-shake', categoryId: 'cold', name: 'ميلك شيك أوريو', desc: 'آيس كريم فانيلا مخفوق مع أوريو.', price: 16, art: 'frappe', hue: 220, sugar: 3, caffeine: 0, tags: ['حلو', 'أطفال', 'بدون كافيين'], sugarChoice: false },

  // عصائر
  { id: 'lemon-mint', categoryId: 'juice', name: 'ليمون ونعنع', desc: 'ليمون طازج مع نعنع، مثلّج.', price: 10, art: 'juice', hue: 75, sugar: 1, caffeine: 0, tags: ['منعش', 'صيفي', 'بدون كافيين'], sugarChoice: true },
  { id: 'orange', categoryId: 'juice', name: 'برتقال فريش', desc: 'برتقال يافاوي معصور على الطلب.', price: 12, art: 'juice', hue: 30, sugar: 1, caffeine: 0, tags: ['فريش', 'بدون كافيين', 'فيتامين'], sugarChoice: false },
  { id: 'mango', categoryId: 'juice', name: 'مانجا', desc: 'مانجا كثيفة مخفوقة.', price: 14, art: 'juice', hue: 42, sugar: 2, caffeine: 0, tags: ['فريش', 'بدون كافيين', 'أطفال'], sugarChoice: false },
  { id: 'strawberry', categoryId: 'juice', name: 'فراولة بالحليب', desc: 'فراولة طازجة مع حليب بارد.', price: 13, art: 'juice', hue: 350, sugar: 2, caffeine: 0, tags: ['فريش', 'حليب', 'أطفال', 'بدون كافيين'], sugarChoice: false },

  // حلويات
  { id: 'knafeh', categoryId: 'dessert', name: 'كنافة نابلسية', desc: 'كنافة ناعمة بالجبنة النابلسية، تُقدّم سخنة.', price: 15, art: 'knafeh', hue: 28, sugar: 3, caffeine: 0, tags: ['تقليدي', 'سخن'], sugarChoice: false },
  { id: 'lotus-cheesecake', categoryId: 'dessert', name: 'تشيز كيك لوتس', desc: 'قاعدة بسكويت لوتس وكريمة جبن ناعمة.', price: 16, art: 'cake', hue: 32, sugar: 3, caffeine: 0, tags: ['بارد', 'كريمي'], sugarChoice: false },
  { id: 'brownies', categoryId: 'dessert', name: 'براونيز', desc: 'براونيز شوكولاتة داكنة، طرية من جوّا.', price: 12, art: 'cake', hue: 14, sugar: 3, caffeine: 0, tags: ['شوكولاتة'], sugarChoice: false },
  { id: 'tiramisu', categoryId: 'dessert', name: 'تيراميسو', desc: 'بسكويت مغموس بالإسبريسو وماسكربوني.', price: 16, art: 'cake', hue: 26, sugar: 2, caffeine: 1, tags: ['قهوة', 'كريمي'], sugarChoice: false },
  { id: 'waffle', categoryId: 'dessert', name: 'وافل نوتيلا', desc: 'وافل بلجيكي مقرمش مع نوتيلا وفواكه.', price: 18, art: 'waffle', hue: 36, sugar: 3, caffeine: 0, tags: ['شوكولاتة', 'أطفال', 'للمشاركة'], sugarChoice: false },
  { id: 'basbousa', categoryId: 'dessert', name: 'بسبوسة بالقشطة', desc: 'بسبوسة بالسميد محشية قشطة.', price: 10, art: 'knafeh', hue: 40, sugar: 3, caffeine: 0, tags: ['تقليدي'], sugarChoice: false },

  // معجنات
  { id: 'croissant', categoryId: 'bakery', name: 'كرواسون زبدة', desc: 'مخبوز الصبح، طبقات هشّة وزبدة.', price: 8, art: 'croissant', hue: 36, sugar: 1, caffeine: 0, tags: ['فطور', 'خفيف'], sugarChoice: false },
  { id: 'zaatar-croissant', categoryId: 'bakery', name: 'كرواسون زعتر وجبنة', desc: 'زعتر بلدي وجبنة عكاوي.', price: 10, art: 'croissant', hue: 70, sugar: 0, caffeine: 0, tags: ['فطور', 'مالح'], sugarChoice: false },
  { id: 'halloumi', categoryId: 'bakery', name: 'ساندويش حلّوم', desc: 'حلّوم مشوي مع بندورة وزيتون وزيت زيتون.', price: 14, art: 'sandwich', hue: 50, sugar: 0, caffeine: 0, tags: ['مالح', 'وجبة'], sugarChoice: false },
  { id: 'cookie', categoryId: 'bakery', name: 'كوكيز شوكولاتة', desc: 'كوكيز طري بقطع شوكولاتة.', price: 6, art: 'cookie', hue: 30, sugar: 2, caffeine: 0, tags: ['خفيف', 'مع القهوة'], sugarChoice: false },
];

// من شو بيتكوّن كل صنف — يظهر للزبون ويشرحه الباريستا
export const CATEGORY_TEXT = Object.fromEntries(CATEGORIES.map((c) => [c.id, { en: c.en, desc: c.desc }]));

export const RECIPES = {
  espresso: 'شوت واحد من 18 غرام بن مطحون ناعم، بينستخلص تحت ضغط عالي خلال 25–30 ثانية، وعليه طبقة كريما ذهبية.',
  americano: 'شوتين إسبريسو مع حوالي 150 مل ماء ساخن. نفس روح الإسبريسو بس أطول وأخف على المعدة.',
  turkish: 'بن محمّص مطحون ناعم جداً مع هيل، بيغلي بالركوة مع الماء (والسكر حسب طلبك) وبينصبّ مع الوش.',
  cappuccino: 'شوت إسبريسو + حليب مبخّر + رغوة حليب كثيفة، تقريباً ثلث لكل طبقة. رغوته أعلى وأخف من اللاتيه.',
  latte: 'شوت إسبريسو + حوالي 200 مل حليب مبخّر + طبقة رغوة رقيقة. أنعم وأكثر حليباً من الكابتشينو.',
  spanish: 'شوت إسبريسو + حليب مكثّف محلّى + حليب مبخّر. حلاوته من الحليب المكثّف مش من السكر.',
  mocha: 'شوت إسبريسو + صوص شوكولاتة داكنة + حليب مبخّر، ومزيّن بالكاكاو.',
  nescafe: 'قهوة سريعة الذوبان مخفوقة مع السكر لحد ما تصير رغوة، وبينصبّ عليها حليب ساخن.',
  'mint-tea': 'شاي أحمر مغلي مع أوراق نعنع طازة، والسكر حسب طلبك.',
  sahlab: 'حليب مطبوخ مع نشا السحلب والسكر وماء الورد، ومن فوق قرفة وجوز هند ومكسرات.',
  'hot-choc': 'شوكولاتة بلجيكية مذوّبة بحليب ساخن، ومن فوق مارشميلو. ما فيها قهوة.',
  karak: 'شاي أسود مغلي مع حليب مبخّر وهيل وزعفران وسكر.',
  'iced-latte': 'شوت إسبريسو + حليب بارد + ثلج.',
  'iced-spanish': 'شوت إسبريسو + حليب مكثّف محلّى + حليب بارد + ثلج.',
  'cold-brew': 'بن مطحون خشن منقوع بماء بارد 18 ساعة وبعدين مصفّى، وبيتقدّم على ثلج. مرارته أقل وكافيينه عالي.',
  'caramel-frappe': 'قهوة + حليب + ثلج + صوص كراميل مخفوقين بالخلاط، ومن فوق كريمة وكراميل.',
  'iced-mocha': 'شوت إسبريسو + صوص شوكولاتة + حليب بارد + ثلج.',
  mojito: 'ليمون طازة ونعنع مهروسين مع سكر، وصودا وثلج مجروش. بدون كحول.',
  'peach-tea': 'شاي أسود مبرّد + شراب خوخ + شرائح ليمون وثلج.',
  'oreo-shake': 'آيس كريم فانيلا + حليب + بسكويت أوريو مخفوقين، ومن فوق كريمة وأوريو مكسّر.',
  'lemon-mint': 'عصير ليمون طازة + نعنع + سكر + ثلج، بالخلاط.',
  orange: 'برتقال طازة معصور على الطلب، بدون سكر ولا ماء.',
  mango: 'مانجا طازة مخفوقة مع شوية حليب وثلج.',
  strawberry: 'فراولة طازة مخفوقة مع حليب بارد وشوية سكر.',
  knafeh: 'عجينة كنافة ناعمة بالزبدة، محشية جبنة نابلسية، بتنخبز وبينصبّ عليها قطر، ومن فوق فستق حلبي.',
  'lotus-cheesecake': 'قاعدة بسكويت لوتس بالزبدة + كريمة جبن طرية + طبقة صوص لوتس.',
  brownies: 'شوكولاتة داكنة + زبدة + بيض + شوية طحين، بتنخبز لحد ما تصير طرية من جوّا.',
  tiramisu: 'بسكويت ليدي فينغر مغموس بالإسبريسو + كريمة ماسكربوني + كاكاو. فيه شوية كافيين.',
  waffle: 'عجينة وافل بلجيكية مخبوزة + نوتيلا + موز وفراولة.',
  basbousa: 'سميد + لبن + سكر + جوز هند، محشية قشطة ومسقية قطر.',
  croissant: 'عجينة مورّقة بالزبدة، طبقات كثيرة، بتنخبز كل صبح.',
  'zaatar-croissant': 'عجينة كرواسون محشية زعتر بلدي وزيت زيتون وجبنة عكاوي.',
  halloumi: 'خبز طازة + حلّوم مشوي + بندورة + زيتون + نعنع + زيت زيتون.',
  cookie: 'عجينة زبدة وسكر بني مع قطع شوكولاتة، مخبوزة طرية.',
};

// صور مؤقتة من Unsplash (مجانية) — صاحب المحل بيقدر يبدّلها بصوره من لوحة التحكم
const IMG = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=640&q=70`;
export const IMAGES = {
  'espresso': IMG('photo-1579992357154-faf4bde95b3d'),
  'americano': IMG('photo-1652507733698-b0c536a92cd4'),
  'turkish': IMG('photo-1757079649052-a24c6ab32c64'),
  'cappuccino': IMG('photo-1593443320739-77f74939d0da'),
  'latte': IMG('photo-1595485225178-457ee5893fa3'),
  'spanish': IMG('photo-1742549626436-bf3c11dab212'),
  'mocha': IMG('photo-1596078841463-5504c992222f'),
  'nescafe': IMG('photo-1575883446992-61cb2d7d301c'),
  'mint-tea': IMG('photo-1591299089616-c9604047b1a6'),
  'sahlab': IMG('photo-1561336526-2914f13ceb36'),
  'hot-choc': IMG('photo-1637572815755-c4b80092dce1'),
  'karak': IMG('photo-1636920272028-c27f1ae474c3'),
  'iced-latte': IMG('photo-1517701550927-30cf4ba1dba5'),
  'iced-spanish': IMG('photo-1461023058943-07fcbe16d735'),
  'cold-brew': IMG('photo-1595520519770-15d19939e648'),
  'caramel-frappe': IMG('photo-1653122025451-ec76a73f8a08'),
  'iced-mocha': IMG('photo-1592663527359-cf6642f54cff'),
  'mojito': IMG('photo-1789991185396-8d244019a7c1'),
  'peach-tea': IMG('photo-1556679343-c7306c1976bc'),
  'oreo-shake': IMG('photo-1572490122747-3968b75cc699'),
  'lemon-mint': IMG('photo-1555949366-819808d99159'),
  'orange': IMG('photo-1600271886742-f049cd451bba'),
  'mango': IMG('photo-1623065422902-30a2d299bbe4'),
  'strawberry': IMG('photo-1579954115545-a95591f28bfc'),
  'knafeh': IMG('photo-1778447812923-88a9e3e6b567'),
  'lotus-cheesecake': IMG('photo-1771220433638-173b9579d199'),
  'brownies': IMG('photo-1636743715220-d8f8dd900b87'),
  'tiramisu': IMG('photo-1571115177098-24ec42ed204d'),
  'waffle': IMG('photo-1695304781788-2ae3f1b02ccc'),
  'basbousa': IMG('photo-1772469625117-412cb49042e6'),
  'croissant': IMG('photo-1691480162735-9b91238080f6'),
  'zaatar-croissant': IMG('photo-1681218079567-35aef7c8e7e4'),
  'halloumi': IMG('photo-1553909489-cd47e0907980'),
  'cookie': IMG('photo-1634188023615-7e08901193b6'),
};
export const CATEGORY_IMAGES = {
  'hot': IMG('photo-1637153468029-bd762b3a0b33'),
  'cold': IMG('photo-1461023058943-07fcbe16d735'),
  'juice': IMG('photo-1603569283847-aa295f0d016a'),
  'dessert': IMG('photo-1517427294546-5aa121f68e8a'),
  'bakery': IMG('photo-1726418490645-f5b88d2f18ea'),
};

// تكلفة القطعة على المحل (بالشيكل) — منها بينحسب الربح
export const COSTS = {
  'espresso': 2.5,
  'americano': 3,
  'turkish': 1.8,
  'cappuccino': 3.8,
  'latte': 4.2,
  'spanish': 5,
  'mocha': 4.8,
  'nescafe': 2.2,
  'mint-tea': 1,
  'sahlab': 3,
  'hot-choc': 4,
  'karak': 2,
  'iced-latte': 4.5,
  'iced-spanish': 5.5,
  'cold-brew': 4,
  'caramel-frappe': 5.5,
  'iced-mocha': 5.5,
  'mojito': 3,
  'peach-tea': 2.5,
  'oreo-shake': 6,
  'lemon-mint': 2.5,
  'orange': 4.5,
  'mango': 5.5,
  'strawberry': 4.5,
  'knafeh': 6,
  'lotus-cheesecake': 6.5,
  'brownies': 4,
  'tiramisu': 6.5,
  'waffle': 6.5,
  'basbousa': 3.5,
  'croissant': 3,
  'zaatar-croissant': 3.8,
  'halloumi': 6,
  'cookie': 2,
};

const ZONES = [
  { id: 'indoor', name: 'الصالة الداخلية', description: 'إضاءة دافئة وكنب مريح، جلسات أصحاب وأحاديث هادئة.' },
  { id: 'family', name: 'الركن العائلي', description: 'طاولات كبيرة للعائلات والأطفال، الطلبات فيها مشاركة وحلويات.' },
  { id: 'terrace', name: 'التراس المطل على البحر', description: 'إطلالة مباشرة على البحر والغروب، قعدات طويلة ورايقة.' },
  { id: 'garden', name: 'الحديقة', description: 'جلسة خارجية بين شجر الليمون، جوّ تقليدي وشاي وأرجيلة.' },
  { id: 'work', name: 'ركن العمل الهادئ', description: 'مكاتب فردية مع مقابس كهرباء وإنترنت سريع، روّاده بيشتغلوا وبيدرسوا وبدهم تركيز.' },
];

const TABLE_COUNT = 36;
function zoneForTable(n) {
  if (n <= 8) return 'indoor';
  if (n <= 16) return 'family';
  if (n <= 24) return 'terrace';
  if (n <= 30) return 'garden';
  return 'work';
}

const OFFERS = [
  {
    id: 'morning-combo', type: 'combo', title: 'صباح الخير', active: true,
    description: 'كابتشينو مع كرواسون زبدة طازة.',
    itemIds: ['cappuccino', 'croissant'], price: 16, percent: 0,
  },
  {
    id: 'sea-combo', type: 'combo', title: 'قعدة البحر', active: true,
    description: 'كاسين نسكافيه مع صحن كنافة نابلسية للمشاركة.',
    itemIds: ['nescafe', 'nescafe', 'knafeh'], price: 25, percent: 0,
  },
  {
    id: 'winter-deal', type: 'discount', title: 'دفا الشتا', active: true,
    description: 'خصم 20% على السحلب والهوت شوكليت.',
    itemIds: ['sahlab', 'hot-choc'], price: 0, percent: 20,
  },
];

// تفضيلات كل منطقة لتوليد سجل طلبات واقعي
const ZONE_TASTE = {
  indoor: { cappuccino: 6, spanish: 6, latte: 5, 'lotus-cheesecake': 4, 'iced-spanish': 4, tiramisu: 3, mocha: 3, cookie: 2 },
  family: { waffle: 6, 'hot-choc': 5, 'oreo-shake': 5, mango: 4, strawberry: 4, orange: 3, nescafe: 3, brownies: 3, 'mint-tea': 2 },
  terrace: { nescafe: 7, mojito: 5, knafeh: 4, 'lotus-cheesecake': 4, 'iced-latte': 4, 'peach-tea': 3, 'caramel-frappe': 3, 'lemon-mint': 3 },
  garden: { 'mint-tea': 7, turkish: 6, sahlab: 4, karak: 4, basbousa: 3, 'zaatar-croissant': 3, 'lemon-mint': 2 },
  work: { americano: 8, espresso: 6, 'cold-brew': 6, latte: 4, croissant: 4, 'zaatar-croissant': 3, halloumi: 3, cookie: 3 },
};
const TABLE_TASTE = {
  33: { americano: 12, espresso: 9, 'cold-brew': 7, croissant: 3 },
  20: { nescafe: 14, 'lotus-cheesecake': 10, knafeh: 3 },
};

// مولّد أرقام عشوائية ثابت (نفس البيانات في كل إعادة ضبط)
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pickWeighted(rand, weights) {
  const entries = Object.entries(weights);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [k, w] of entries) { if ((r -= w) <= 0) return k; }
  return entries[0][0];
}

function buildDemoOrders(items, tables, zones) {
  const rand = rng(20261008);
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  const orders = [];
  const now = new Date();
  const hourWeights = { 8: 3, 9: 6, 10: 7, 11: 5, 12: 3, 13: 3, 14: 2, 15: 3, 16: 4, 17: 6, 18: 8, 19: 9, 20: 9, 21: 7, 22: 4, 23: 2 };
  const DAYS = 21;

  for (let d = DAYS; d >= 0; d--) {
    const day = new Date(now);
    day.setDate(now.getDate() - d);
    const weekend = day.getDay() === 5 || day.getDay() === 6;
    let count = Math.round((weekend ? 34 : 24) + rand() * 10);
    if (d === 0) count = Math.round(count * Math.min(1, Math.max(0, (now.getHours() - 7) / 16)));
    const dailyNos = [];
    for (let i = 0; i < count; i++) {
      const hour = Number(pickWeighted(rand, hourWeights));
      const at = new Date(day);
      at.setHours(hour, Math.floor(rand() * 60), Math.floor(rand() * 60), 0);
      if (at > now) continue;
      const table = 1 + Math.floor(rand() * tables.length);
      const zoneId = tables[table - 1].zoneId;
      const taste = TABLE_TASTE[table] && rand() < 0.8 ? TABLE_TASTE[table] : ZONE_TASTE[zoneId];
      const people = 1 + Math.floor(rand() * (zoneId === 'family' ? 5 : zoneId === 'work' ? 1.4 : 3));
      const lines = [];
      for (let p = 0; p < people; p++) {
        const id = pickWeighted(rand, taste);
        const existing = lines.find((l) => l.refId === id);
        if (existing) { existing.qty++; existing.lineTotal = existing.qty * existing.unitPrice; continue; }
        const it = byId[id];
        lines.push({ kind: 'item', refId: id, name: it.name, unitPrice: it.price, qty: 1, lineTotal: it.price, options: {}, note: '', unitCost: COSTS[id] ?? 0 });
      }
      const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
      dailyNos.push({ at, table, zoneId, lines, subtotal });
    }
    dailyNos.sort((a, b) => a.at - b.at).forEach((o, idx) => {
      const iso = o.at.toISOString();
      orders.push({
        id: 'demo' + o.at.getTime().toString(36) + idx,
        no: idx + 1,
        table: o.table,
        zoneName: zones.find((z) => z.id === o.zoneId).name,
        lines: o.lines,
        subtotal: o.subtotal,
        discount: 0,
        total: o.subtotal,
        cost: Math.round(o.lines.reduce((s, l) => s + l.unitCost * l.qty, 0) * 100) / 100,
        sessionId: null,
        note: '',
        status: 'paid',
        source: rand() < 0.22 ? 'barista' : 'menu',
        createdAt: iso,
        updatedAt: iso,
        history: [{ status: 'new', at: iso }, { status: 'paid', at: iso }],
        demo: true,
      });
    });
  }
  return orders;
}

export function buildSeed() {
  const tables = Array.from({ length: TABLE_COUNT }, (_, i) => ({
    number: i + 1,
    zoneId: zoneForTable(i + 1),
    seats: zoneForTable(i + 1) === 'family' ? 6 : zoneForTable(i + 1) === 'work' ? 1 : 4,
  }));
  const items = ITEMS.map((it) => ({ image: IMAGES[it.id] ?? null, available: true, recipe: RECIPES[it.id] ?? '', cost: COSTS[it.id] ?? 0, ...it }));
  const offers = OFFERS.map((o) => ({ ...o }));
  const orders = buildDemoOrders(items, tables, ZONES);
  // يوم العمل الحالي بلّش الصبح، والأيام اللي قبل مسكّرة ومحفوظة بتقاريرها
  const now = new Date();
  const opened = new Date(now);
  opened.setHours(now.getHours() >= 7 ? 7 : 0, 0, 0, 0);
  const days = [];
  for (let back = 21; back >= 1; back--) {
    const start = new Date(opened); start.setDate(start.getDate() - back); start.setHours(7, 0, 0, 0);
    const end = new Date(start); end.setHours(23, 45, 0, 0);
    const dayOrders = orders.filter((o) => { const t = new Date(o.createdAt); return t >= start && t <= end; });
    if (!dayOrders.length) continue;
    days.unshift({ id: 'day-demo-' + back, openedAt: start.toISOString(), closedAt: end.toISOString(), demo: true, ...summarize(dayOrders, { items, offers }) });
  }
  return {
    version: 1,
    settings: {
      cafeName: 'كافي محمد',
      brandWord: 'محمد',
      tagline: 'قهوة على أصولها، وإطلالة على البحر',
      currency: '₪',
      currencyName: 'شيكل',
      city: 'غزة',
      lat: 31.5017,
      lon: 34.4668,
      adminPin: '1234',
      baristaName: 'نديم',
      // معلومات بيجاوب فيها نديم (الواي فاي، الدوام، أي ملاحظة عن المحل)
      wifi: '',
      hours: '',
      cafeNotes: '',
      dayOpenedAt: opened.toISOString(),
    },
    categories: CATEGORIES.map((c) => ({ ...c, image: CATEGORY_IMAGES[c.id] ?? null })),
    items,
    offers,
    zones: ZONES.map((z) => ({ ...z })),
    tables,
    orders,
    calls: [],
    days,
    imagesSeeded: true,
  };
}

/** ترقية بيانات قديمة لآخر نسخة (بتشتغل كل ما يفتح السيرفر أو صفحة الـ HTML) */
export function migrate(state) {
  state.calls ??= [];
  state.days ??= [];
  for (const it of state.items) {
    if (it.recipe == null) it.recipe = RECIPES[it.id] ?? '';
    if (it.cost == null) it.cost = COSTS[it.id] ?? 0;
  }
  for (const c of state.categories) {
    c.en ??= CATEGORY_TEXT[c.id]?.en ?? '';
    c.desc ??= CATEGORY_TEXT[c.id]?.desc ?? '';
  }
  // الصور المؤقتة بتنحط مرة وحدة بس، عشان ما ترجع إذا صاحب المحل شالها
  if (!state.imagesSeeded) {
    for (const it of state.items) if (!it.image && IMAGES[it.id]) it.image = IMAGES[it.id];
    for (const c of state.categories) if (!c.image && CATEGORY_IMAGES[c.id]) c.image = CATEGORY_IMAGES[c.id];
    state.imagesSeeded = true;
  }
  state.settings.brandWord ??= state.settings.cafeName.split(/\s+/).pop();
  state.settings.wifi ??= '';
  state.settings.hours ??= '';
  state.settings.cafeNotes ??= '';
  if (!state.settings.dayOpenedAt) state.settings.dayOpenedAt = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
  // طاولات عليها طلبات مفتوحة من قبل نظام الجلسات: بنفتحلها جلسة
  for (const t of state.tables) {
    const open = state.orders.filter((o) => o.table === t.number && ['new', 'preparing', 'ready', 'served'].includes(o.status));
    if (open.length && !t.sessionId) {
      t.sessionId = 's' + Date.now().toString(36) + t.number;
      t.sessionAt = open[0].createdAt;
      for (const o of open) o.sessionId = t.sessionId;
    }
  }
  return state;
}
