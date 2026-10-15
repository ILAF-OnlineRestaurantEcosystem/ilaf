// البيانات الأولية: القائمة، المناطق، الطاولات، العروض، وسجل طلبات تجريبي
// يعطي الباريستا الذكي "ذاكرة" من أول تشغيل (طاولة 33 للقهوة، طاولة 20 للنسكافيه مع التحلاية…)
import { summarize } from './reports.js';
import {
  R_CATEGORIES, R_ITEMS, R_RECIPES, R_COSTS, R_IMAGES, R_CATEGORY_IMAGES, R_OFFERS, R_ZONES,
  R_TABLE_COUNT, rZoneForTable, rSeats, R_TASTE, R_HOURS,
} from './seed-restaurant.js';

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
  { id: 'flat-white', categoryId: 'hot', name: 'فلات وايت', desc: 'شوتين ريستريتو مع حليب مخملي قليل، أقوى من اللاتيه وأنعم من الكابتشينو.', price: 13, art: 'cup', hue: 30, sugar: 0, caffeine: 3, tags: ['قهوة', 'حليب', 'قوي'], sugarChoice: true },
  { id: 'cortado', categoryId: 'hot', name: 'كورتادو', desc: 'إسبريسو مع نفس كميته حليب دافي، صغير ومتوازن.', price: 10, art: 'glass', hue: 26, sugar: 0, caffeine: 3, tags: ['قهوة', 'حليب', 'صغير'], sugarChoice: true },
  { id: 'caramel-macchiato', categoryId: 'hot', name: 'كراميل ماكياتو', desc: 'حليب بالفانيلا، إسبريسو من فوق، وشبكة كراميل.', price: 15, art: 'cup', hue: 34, sugar: 3, caffeine: 2, tags: ['قهوة', 'حليب', 'كراميل', 'حلو'], sugarChoice: false },
  { id: 'v60', categoryId: 'hot', name: 'قهوة مقطّرة V60', desc: 'قهوة مختصة بالتقطير اليدوي، نكهات فواكه وزهور.', price: 14, art: 'cup', hue: 20, sugar: 0, caffeine: 3, tags: ['قهوة', 'مختصة', 'بدون حليب'], sugarChoice: true },
  { id: 'matcha-latte', categoryId: 'hot', name: 'ماتشا لاتيه', desc: 'ماتشا ياباني مخفوق مع حليب مبخّر، طاقة هادية.', price: 15, art: 'cup', hue: 70, sugar: 1, caffeine: 2, tags: ['ماتشا', 'حليب', 'صحي'], sugarChoice: true },
  { id: 'green-tea', categoryId: 'hot', name: 'شاي أخضر', desc: 'شاي أخضر خفيف مع شريحة ليمون، والعسل حسب الطلب.', price: 6, art: 'tea', hue: 60, sugar: 0, caffeine: 1, tags: ['شاي', 'خفيف', 'صحي'], sugarChoice: true },
  { id: 'zhourat', categoryId: 'hot', name: 'زهورات', desc: 'أعشاب دافية: بابونج وزوفا ويانسون وميرمية.', price: 6, art: 'tea', hue: 40, sugar: 1, caffeine: 0, tags: ['أعشاب', 'بدون كافيين', 'شتوي', 'تقليدي'], sugarChoice: true },
  { id: 'karak', categoryId: 'hot', name: 'شاي كرك', desc: 'شاي بالحليب والهيل والزعفران.', price: 8, art: 'tea', hue: 30, sugar: 2, caffeine: 1, tags: ['شاي', 'حليب', 'هيل'], sugarChoice: true },

  // بارد
  { id: 'iced-latte', categoryId: 'cold', name: 'آيس لاتيه', desc: 'إسبريسو وحليب بارد على ثلج.', price: 14, art: 'iced', hue: 34, sugar: 1, caffeine: 2, tags: ['قهوة', 'حليب', 'منعش'], sugarChoice: true },
  { id: 'iced-spanish', categoryId: 'cold', name: 'آيس سبانش لاتيه', desc: 'نسخة الثلج من المفضّل عند الكل.', price: 16, art: 'iced', hue: 38, sugar: 3, caffeine: 2, tags: ['قهوة', 'حلو', 'منعش'], sugarChoice: false },
  { id: 'cold-brew', categoryId: 'cold', name: 'كولد برو', desc: 'قهوة منقوعة 18 ساعة، ناعمة وقوية بلا مرارة.', price: 15, art: 'bottle', hue: 20, sugar: 0, caffeine: 3, tags: ['قهوة', 'تركيز', 'شغل'], sugarChoice: true },
  { id: 'caramel-frappe', categoryId: 'cold', name: 'فرابيه كراميل', desc: 'قهوة مثلّجة مخفوقة مع كراميل وكريمة.', price: 16, art: 'frappe', hue: 32, sugar: 3, caffeine: 1, tags: ['قهوة', 'حلو', 'صيفي'], sugarChoice: false },
  { id: 'iced-mocha', categoryId: 'cold', name: 'آيس موكا', desc: 'شوكولاتة وإسبريسو وحليب على ثلج.', price: 16, art: 'iced', hue: 16, sugar: 2, caffeine: 2, tags: ['قهوة', 'شوكولاتة', 'منعش'], sugarChoice: false },
  { id: 'mojito', categoryId: 'cold', name: 'موهيتو ليمون ونعنع', desc: 'صودا مع ليمون ونعنع مهروس وثلج مجروش.', price: 12, art: 'mojito', hue: 110, sugar: 2, caffeine: 0, tags: ['منعش', 'صيفي', 'بدون كافيين'], sugarChoice: true },
  { id: 'peach-tea', categoryId: 'cold', name: 'آيس تي خوخ', desc: 'شاي مبرّد بالخوخ وشرائح الليمون.', price: 10, art: 'glass', hue: 28, sugar: 2, caffeine: 1, tags: ['شاي', 'منعش'], sugarChoice: true },
  { id: 'iced-americano', categoryId: 'cold', name: 'آيس أمريكانو', desc: 'شوتين إسبريسو مع ماء بارد وثلج، منعش وقوي.', price: 11, art: 'iced', hue: 22, sugar: 0, caffeine: 3, tags: ['قهوة', 'بارد', 'تركيز'], sugarChoice: true },
  { id: 'iced-caramel', categoryId: 'cold', name: 'آيس كراميل ماكياتو', desc: 'حليب بارد بالفانيلا وإسبريسو وكراميل على ثلج.', price: 16, art: 'iced', hue: 34, sugar: 3, caffeine: 2, tags: ['قهوة', 'بارد', 'كراميل', 'حلو'], sugarChoice: false },
  { id: 'iced-matcha', categoryId: 'cold', name: 'آيس ماتشا لاتيه', desc: 'ماتشا مخفوق فوق حليب بارد وثلج.', price: 16, art: 'iced', hue: 70, sugar: 1, caffeine: 2, tags: ['ماتشا', 'بارد', 'صحي'], sugarChoice: true },
  { id: 'passion-mojito', categoryId: 'cold', name: 'موهيتو باشن فروت', desc: 'باشن فروت مع ليمون ونعنع وصودا وثلج مجروش.', price: 14, art: 'mojito', hue: 40, sugar: 2, caffeine: 0, tags: ['منعش', 'بارد', 'فواكه'], sugarChoice: true },
  { id: 'nutella-shake', categoryId: 'cold', name: 'ميلك شيك نوتيلا', desc: 'آيس كريم فانيلا مخفوق مع نوتيلا وحليب وكريمة.', price: 17, art: 'frappe', hue: 16, sugar: 3, caffeine: 0, tags: ['شوكولاتة', 'بارد', 'أطفال', 'حلو'], sugarChoice: false },
  { id: 'oreo-shake', categoryId: 'cold', name: 'ميلك شيك أوريو', desc: 'آيس كريم فانيلا مخفوق مع أوريو.', price: 16, art: 'frappe', hue: 220, sugar: 3, caffeine: 0, tags: ['حلو', 'أطفال', 'بدون كافيين'], sugarChoice: false },

  // عصائر
  { id: 'lemon-mint', categoryId: 'juice', name: 'ليمون ونعنع', desc: 'ليمون طازج مع نعنع، مثلّج.', price: 10, art: 'juice', hue: 75, sugar: 1, caffeine: 0, tags: ['منعش', 'صيفي', 'بدون كافيين'], sugarChoice: true },
  { id: 'orange', categoryId: 'juice', name: 'برتقال فريش', desc: 'برتقال يافاوي معصور على الطلب.', price: 12, art: 'juice', hue: 30, sugar: 1, caffeine: 0, tags: ['فريش', 'بدون كافيين', 'فيتامين'], sugarChoice: false },
  { id: 'mango', categoryId: 'juice', name: 'مانجا', desc: 'مانجا كثيفة مخفوقة.', price: 14, art: 'juice', hue: 42, sugar: 2, caffeine: 0, tags: ['فريش', 'بدون كافيين', 'أطفال'], sugarChoice: false },
  { id: 'strawberry', categoryId: 'juice', name: 'فراولة بالحليب', desc: 'فراولة طازجة مع حليب بارد.', price: 13, art: 'juice', hue: 350, sugar: 2, caffeine: 0, tags: ['فريش', 'حليب', 'أطفال', 'بدون كافيين'], sugarChoice: false },

  { id: 'cocktail', categoryId: 'juice', name: 'كوكتيل فواكه', desc: 'طبقات أفوكادو ومانجا وفراولة مع قشطة ومكسرات، الكوكتيل الغزاوي.', price: 18, art: 'juice', hue: 30, sugar: 3, caffeine: 0, tags: ['عصير', 'فواكه', 'طبقات'], sugarChoice: false },
  { id: 'avocado', categoryId: 'juice', name: 'عصير أفوكادو', desc: 'أفوكادو مخفوق مع حليب وعسل، ومن فوق مكسرات.', price: 16, art: 'juice', hue: 80, sugar: 2, caffeine: 0, tags: ['عصير', 'مغذّي', 'حليب'], sugarChoice: false },
  { id: 'berry-smoothie', categoryId: 'juice', name: 'سموذي توت', desc: 'توت مشكّل مخفوق مع لبن وموز.', price: 15, art: 'juice', hue: 10, sugar: 2, caffeine: 0, tags: ['سموذي', 'فواكه', 'صحي'], sugarChoice: false },
  { id: 'carrot-orange', categoryId: 'juice', name: 'جزر وبرتقال', desc: 'جزر وبرتقال معصورين على الطلب، مليان فيتامينات.', price: 12, art: 'juice', hue: 24, sugar: 1, caffeine: 0, tags: ['عصير', 'طبيعي', 'صحي'], sugarChoice: false },
  { id: 'watermelon', categoryId: 'juice', name: 'بطيخ بالنعنع', desc: 'بطيخ بارد معصور مع ورق نعنع.', price: 10, art: 'juice', hue: 4, sugar: 2, caffeine: 0, tags: ['عصير', 'صيفي', 'منعش'], sugarChoice: false },

  // حلويات
  { id: 'knafeh', categoryId: 'dessert', name: 'كنافة نابلسية', desc: 'كنافة ناعمة بالجبنة النابلسية، تُقدّم سخنة.', price: 15, art: 'knafeh', hue: 28, sugar: 3, caffeine: 0, tags: ['تقليدي', 'سخن'], sugarChoice: false },
  { id: 'lotus-cheesecake', categoryId: 'dessert', name: 'تشيز كيك لوتس', desc: 'قاعدة بسكويت لوتس وكريمة جبن ناعمة.', price: 16, art: 'cake', hue: 32, sugar: 3, caffeine: 0, tags: ['بارد', 'كريمي'], sugarChoice: false },
  { id: 'brownies', categoryId: 'dessert', name: 'براونيز', desc: 'براونيز شوكولاتة داكنة، طرية من جوّا.', price: 12, art: 'cake', hue: 14, sugar: 3, caffeine: 0, tags: ['شوكولاتة'], sugarChoice: false },
  { id: 'tiramisu', categoryId: 'dessert', name: 'تيراميسو', desc: 'بسكويت مغموس بالإسبريسو وماسكربوني.', price: 16, art: 'cake', hue: 26, sugar: 2, caffeine: 1, tags: ['قهوة', 'كريمي'], sugarChoice: false },
  { id: 'waffle', categoryId: 'dessert', name: 'وافل نوتيلا', desc: 'وافل بلجيكي مقرمش مع نوتيلا وفواكه.', price: 18, art: 'waffle', hue: 36, sugar: 3, caffeine: 0, tags: ['شوكولاتة', 'أطفال', 'للمشاركة'], sugarChoice: false },
  { id: 'basbousa', categoryId: 'dessert', name: 'بسبوسة بالقشطة', desc: 'بسبوسة بالسميد محشية قشطة.', price: 10, art: 'knafeh', hue: 40, sugar: 3, caffeine: 0, tags: ['تقليدي'], sugarChoice: false },

  { id: 'lava-cake', categoryId: 'dessert', name: 'مولتن كيك', desc: 'كيكة شوكولاتة سخنة قلبها سايل، مع آيس كريم فانيلا.', price: 18, art: 'cake', hue: 14, sugar: 3, caffeine: 0, tags: ['شوكولاتة', 'سخن', 'حلو'] },
  { id: 'crepe', categoryId: 'dessert', name: 'كريب نوتيلا', desc: 'كريب رقيق محشي نوتيلا وموز.', price: 16, art: 'waffle', hue: 20, sugar: 3, caffeine: 0, tags: ['نوتيلا', 'شوكولاتة', 'أطفال'] },
  { id: 'pancakes', categoryId: 'dessert', name: 'بان كيك بالعسل', desc: 'تلات طبقات بان كيك هش مع عسل وزبدة وفواكه.', price: 17, art: 'waffle', hue: 32, sugar: 3, caffeine: 0, tags: ['فطور', 'حلو', 'أطفال'] },
  { id: 'berry-cheesecake', categoryId: 'dessert', name: 'تشيز كيك توت', desc: 'تشيز كيك كريمي مخبوز مع صوص توت مشكّل.', price: 16, art: 'cake', hue: 6, sugar: 2, caffeine: 0, tags: ['تشيز كيك', 'فواكه'] },
  { id: 'ice-cream', categoryId: 'dessert', name: 'آيس كريم (3 سكوبات)', desc: 'تلات سكوبات على ذوقك: فانيلا، شوكولاتة، فستق أو فراولة.', price: 12, art: 'glass', hue: 40, sugar: 3, caffeine: 0, tags: ['بارد', 'أطفال', 'صيفي'] },

  // معجنات
  { id: 'croissant', categoryId: 'bakery', name: 'كرواسون زبدة', desc: 'مخبوز الصبح، طبقات هشّة وزبدة.', price: 8, art: 'croissant', hue: 36, sugar: 1, caffeine: 0, tags: ['فطور', 'خفيف'], sugarChoice: false },
  { id: 'zaatar-croissant', categoryId: 'bakery', name: 'كرواسون زعتر وجبنة', desc: 'زعتر بلدي وجبنة عكاوي.', price: 10, art: 'croissant', hue: 70, sugar: 0, caffeine: 0, tags: ['فطور', 'مالح'], sugarChoice: false },
  { id: 'halloumi', categoryId: 'bakery', name: 'ساندويش حلّوم', desc: 'حلّوم مشوي مع بندورة وزيتون وزيت زيتون.', price: 14, art: 'sandwich', hue: 50, sugar: 0, caffeine: 0, tags: ['مالح', 'وجبة'], sugarChoice: false },
  { id: 'manakish', categoryId: 'bakery', name: 'منقوشة زعتر', desc: 'عجينة طازة مع زعتر بلدي وزيت زيتون.', price: 7, art: 'sandwich', hue: 60, sugar: 0, caffeine: 0, tags: ['فطور', 'زعتر', 'تقليدي', 'مالح'] },
  { id: 'kaak', categoryId: 'bakery', name: 'كعك بالسمسم', desc: 'كعك القدس الطري بالسمسم، مع زعتر وبيضة.', price: 6, art: 'croissant', hue: 36, sugar: 0, caffeine: 0, tags: ['فطور', 'تقليدي', 'مالح'] },
  { id: 'avocado-toast', categoryId: 'bakery', name: 'توست أفوكادو', desc: 'خبز ساوردو محمّص مع أفوكادو مهروس وبيضة.', price: 18, art: 'sandwich', hue: 80, sugar: 0, caffeine: 0, tags: ['فطور', 'صحي', 'مالح'] },
  { id: 'chicken-panini', categoryId: 'bakery', name: 'بانيني دجاج', desc: 'خبز بانيني محمّص مع دجاج مدخّن وموزاريلا وبيستو.', price: 19, art: 'sandwich', hue: 34, sugar: 0, caffeine: 0, tags: ['وجبة', 'دجاج', 'مالح'] },
  { id: 'club-sandwich', categoryId: 'bakery', name: 'كلوب ساندويش', desc: 'تلات طبقات توست مع دجاج وجبنة وبيض، وبطاطا جنبه.', price: 22, art: 'sandwich', hue: 30, sugar: 0, caffeine: 0, tags: ['وجبة', 'دجاج', 'مالح'] },
  { id: 'muffin', categoryId: 'bakery', name: 'مافن شوكولاتة', desc: 'مافن طري بقطع شوكولاتة جوّا وفوق.', price: 8, art: 'cake', hue: 16, sugar: 3, caffeine: 0, tags: ['شوكولاتة', 'حلو', 'سناك'] },
  { id: 'cookie', categoryId: 'bakery', name: 'كوكيز شوكولاتة', desc: 'كوكيز طري بقطع شوكولاتة.', price: 6, art: 'cookie', hue: 30, sugar: 2, caffeine: 0, tags: ['خفيف', 'مع القهوة'], sugarChoice: false },
];

// الأصناف اللي انضافت بالقائمة v2
const MENU_V2 = ['flat-white', 'cortado', 'caramel-macchiato', 'v60', 'matcha-latte', 'green-tea', 'zhourat',
  'iced-americano', 'iced-caramel', 'iced-matcha', 'passion-mojito', 'nutella-shake',
  'cocktail', 'avocado', 'berry-smoothie', 'carrot-orange', 'watermelon',
  'lava-cake', 'crepe', 'pancakes', 'berry-cheesecake', 'ice-cream',
  'manakish', 'kaak', 'avocado-toast', 'chicken-panini', 'club-sandwich', 'muffin'];

// من شو بيتكوّن كل صنف — يظهر للزبون ويشرحه الباريستا
export const CATEGORY_TEXT = Object.fromEntries(CATEGORIES.map((c) => [c.id, { en: c.en, desc: c.desc }]));

export const RECIPES = {
  'flat-white': 'شوتين ريستريتو (إسبريسو مركّز) مع حوالي 120 مل حليب مبخّر وطبقة رغوة رقيقة جداً. القهوة فيه أوضح من اللاتيه.',
  cortado: 'شوت إسبريسو مع كمية مساوية من الحليب المبخّر (تقريباً 1:1) بكاسة صغيرة، بدون رغوة كثيرة.',
  'caramel-macchiato': 'حليب مبخّر مع سيروب فانيلا، فوقه شوت إسبريسو بيعمل طبقة، ومن فوق شبكة صوص كراميل.',
  v60: '18 غرام بن مختص مطحون وسط مع 300 مل ماء على 93°، بيتقطّر يدوياً بفلتر V60 خلال 3 دقايق. طعم صافي بدون مرارة.',
  'matcha-latte': 'غرامين بودرة ماتشا يابانية مخفوقة مع شوية ماء سخن، وفوقها حليب مبخّر. كافيين هادي وطاقة بتدوم.',
  'green-tea': 'أوراق شاي أخضر منقوعة 3 دقايق بماء 80° (مش مغلي عشان ما يمرّ)، مع شريحة ليمون، والعسل أو السكر حسب طلبك.',
  zhourat: 'خلطة زهورات شامية: بابونج، زوفا، يانسون، ميرمية وزهر ليمون، منقوعة بماء مغلي. ما فيها كافيين ومريحة للمعدة.',
  'iced-americano': 'شوتين إسبريسو فوق ماء بارد وثلج. منعش وقوي وبدون حليب.',
  'iced-caramel': 'حليب بارد مع سيروب فانيلا وثلج، فوقه شوت إسبريسو وشبكة صوص كراميل.',
  'iced-matcha': 'ماتشا يابانية مخفوقة مع شوية ماء، فوق حليب بارد وثلج.',
  'passion-mojito': 'لب باشن فروت مع ليمون أخضر ونعنع مهروس وسيروب سكر، مع صودا وثلج مجروش.',
  'nutella-shake': 'سكوبين آيس كريم فانيلا + نوتيلا + حليب بارد، مخفوقين ومزيّنين بكريمة وصوص شوكولاتة.',
  cocktail: 'طبقات من عصير المانجا والفراولة والأفوكادو بالحليب، مع قطع فواكه وقشطة وعسل ومكسرات من فوق.',
  avocado: 'أفوكادو طازج مخفوق مع حليب بارد وعسل، ومزيّن بلوز وفستق حلبي.',
  'berry-smoothie': 'توت أزرق وفراولة وتوت أحمر مجمّد، مخفوقين مع لبن وموزة وشوية عسل.',
  'carrot-orange': 'جزر طازج وبرتقال معصورين على الطلب، بدون سكر مضاف.',
  watermelon: 'بطيخ أحمر معصور ومصفّى مع نعنع طازج وثلج، بدون سكر مضاف.',
  'lava-cake': 'كيكة شوكولاتة داكنة بتنخبز ربع ساعة بس فقلبها بيضل سايل، وبتنقدّم سخنة مع سكوب آيس كريم فانيلا.',
  crepe: 'عجينة كريب رقيقة (طحين، حليب، بيض، زبدة) محشية نوتيلا وشرائح موز، ومن فوق سكر بودرة.',
  pancakes: 'تلات قطع بان كيك هش مع زبدة وعسل، وفراولة وتوت.',
  'berry-cheesecake': 'قاعدة بسكويت بالزبدة، طبقة جبنة كريمية مخبوزة، ومن فوق صوص توت مشكّل.',
  'ice-cream': 'تلات سكوبات آيس كريم (فانيلا، شوكولاتة، فستق حلبي أو فراولة) مع صوص ومكسرات حسب طلبك.',
  manakish: 'عجينة خبز طازة مدهونة زعتر بلدي مع زيت زيتون وسماق وسمسم، مخبوزة بالفرن.',
  kaak: 'كعكة قدسية طرية مغطاة سمسم، بتنقدّم مع زعتر وبيضة مسلوقة أو جبنة.',
  'avocado-toast': 'شريحة خبز ساوردو محمّصة مع أفوكادو مهروس بالليمون والملح، وبيضة، وبذور وشطة خفيفة.',
  'chicken-panini': 'خبز بانيني مع دجاج مدخّن وجبنة موزاريلا وصوص بيستو وبندورة مجففة، مكبوس لحد ما يقرمش.',
  'club-sandwich': 'توست محمّص بتلات طبقات: صدر دجاج مشوي، جبنة شيدر، بيض، خس وبندورة ومايونيز، مع بطاطا مقلية.',
  muffin: 'كيكة مافن بطحين وزبدة وبيض وكاكاو، مع قطع شوكولاتة جوّا وفوق.',
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
  'espresso': IMG('photo-1583165278997-0250ea5d72e2'),
  'americano': IMG('photo-1652507733698-b0c536a92cd4'),
  'turkish': IMG('photo-1757079649052-a24c6ab32c64'),
  'cappuccino': IMG('photo-1593443320739-77f74939d0da'),
  'latte': IMG('photo-1595485225178-457ee5893fa3'),
  'spanish': IMG('photo-1502462041640-b3d7e50d0662'),
  'mocha': IMG('photo-1621135177072-57c9b6242e7a'),
  'nescafe': IMG('photo-1575883446992-61cb2d7d301c'),
  'mint-tea': IMG('photo-1591299089616-c9604047b1a6'),
  'sahlab': IMG('photo-1567041460039-3df7d3d6d440'),
  'hot-choc': IMG('photo-1637572815755-c4b80092dce1'),
  'karak': IMG('photo-1636920272028-c27f1ae474c3'),
  'iced-latte': IMG('photo-1517701550927-30cf4ba1dba5'),
  'iced-spanish': IMG('photo-1461023058943-07fcbe16d735'),
  'cold-brew': IMG('photo-1559496417-e7f25cb247f3'),
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
  'zaatar-croissant': IMG('photo-1606758184328-faab9a86f4d3'),
  'halloumi': IMG('photo-1655279562015-047c3da9a271'),
  'cookie': IMG('photo-1634188023615-7e08901193b6'),
  'flat-white': IMG('photo-1506372023823-741c83b836fe'),
  'cortado': IMG('photo-1646908873086-881be59630cf'),
  'caramel-macchiato': IMG('photo-1604298458655-ae6e04213678'),
  'v60': IMG('photo-1587955245893-389f2215c6eb'),
  'green-tea': IMG('photo-1622480916113-9000ac49b79d'),
  'zhourat': IMG('photo-1571934811356-5cc061b6821f'),
  'matcha-latte': IMG('photo-1515823064-d6e0c04616a7'),
  'iced-matcha': IMG('photo-1749280447307-31a68eb38673'),
  'iced-americano': IMG('photo-1581996323441-538096e854b9'),
  'iced-caramel': IMG('photo-1527678357412-ef45dfbd9ecc'),
  'crepe': IMG('photo-1734056650036-7002ede7b8f8'),
  'pancakes': IMG('photo-1587339144367-f1cacbecac82'),
  'carrot-orange': IMG('photo-1618046364546-81e9d03d39a6'),
  'watermelon': IMG('photo-1683531658992-b78c311900a3'),
  'berry-smoothie': IMG('photo-1600718374662-0483d2b9da44'),
  'lava-cake': IMG('photo-1617305855058-336d24456869'),
  'berry-cheesecake': IMG('photo-1695088957322-e253097aa640'),
  'ice-cream': IMG('photo-1560008581-09826d1de69e'),
  'club-sandwich': IMG('photo-1676300184084-de35d56a9a70'),
  'chicken-panini': IMG('photo-1528736235302-52922df5c122'),
  'avocado-toast': IMG('photo-1687276287139-88f7333c8ca4'),
  'muffin': IMG('photo-1616151030755-76f6cd987a06'),
  'nutella-shake': IMG('photo-1553787499-6f9133860278'),
  'passion-mojito': IMG('photo-1754594537133-796eb54f206c'),
  'avocado': IMG('photo-1693042442021-41423615ce89'),
  'cocktail': IMG('photo-1505252585461-04db1eb84625'),
  'manakish': IMG('photo-1611107415406-1c12f8cda424'),
  'kaak': IMG('photo-1585445490387-f47934b73b54'),
};
// صور اتبدلت بالقائمة v2 بصور أوضح: الصنف بيتحدّث بس إذا لسا عليه الصورة القديمة
const OLD_IMAGES = {
  'espresso': 'photo-1579992357154-faf4bde95b3d',
  'spanish': 'photo-1742549626436-bf3c11dab212',
  'mocha': 'photo-1596078841463-5504c992222f',
  'cold-brew': 'photo-1595520519770-15d19939e648',
  'halloumi': 'photo-1553909489-cd47e0907980',
  'zaatar-croissant': 'photo-1681218079567-35aef7c8e7e4',
  'sahlab': 'photo-1561336526-2914f13ceb36',
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
  'flat-white': 4.4, 'cortado': 3.2, 'caramel-macchiato': 5.2, 'v60': 4, 'matcha-latte': 5.5, 'green-tea': 1.5, 'zhourat': 1.4,
  'iced-americano': 3.2, 'iced-caramel': 5.5, 'iced-matcha': 5.6, 'passion-mojito': 4, 'nutella-shake': 6,
  'cocktail': 7, 'avocado': 6.5, 'berry-smoothie': 5.5, 'carrot-orange': 3.5, 'watermelon': 2.8,
  'lava-cake': 6, 'crepe': 5, 'pancakes': 5.2, 'berry-cheesecake': 5.5, 'ice-cream': 3.5,
  'manakish': 1.8, 'kaak': 1.5, 'avocado-toast': 6.5, 'chicken-panini': 7, 'club-sandwich': 8, 'muffin': 2.2,
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
  indoor: { cappuccino: 6, spanish: 6, latte: 5, 'lotus-cheesecake': 4, 'iced-spanish': 4, 'caramel-macchiato': 4, tiramisu: 3, mocha: 3, 'lava-cake': 3, cookie: 2 },
  family: { waffle: 6, 'hot-choc': 5, 'oreo-shake': 5, cocktail: 5, 'nutella-shake': 4, crepe: 4, mango: 4, strawberry: 4, 'club-sandwich': 3, orange: 3, nescafe: 3, brownies: 3, 'ice-cream': 3, 'mint-tea': 2 },
  terrace: { nescafe: 7, mojito: 5, knafeh: 4, 'lotus-cheesecake': 4, 'iced-latte': 4, 'passion-mojito': 3, watermelon: 3, 'peach-tea': 3, 'caramel-frappe': 3, 'lemon-mint': 3 },
  garden: { 'mint-tea': 7, turkish: 6, sahlab: 4, karak: 4, zhourat: 3, manakish: 3, kaak: 3, basbousa: 3, 'zaatar-croissant': 3, 'lemon-mint': 2 },
  work: { americano: 8, espresso: 6, 'cold-brew': 6, 'flat-white': 4, 'iced-americano': 4, latte: 4, v60: 3, croissant: 4, 'zaatar-croissant': 3, 'chicken-panini': 3, halloumi: 3, 'avocado-toast': 2, cookie: 3 },
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

const CAFE_HOURS = { 8: 3, 9: 6, 10: 7, 11: 5, 12: 3, 13: 3, 14: 2, 15: 3, 16: 4, 17: 6, 18: 8, 19: 9, 20: 9, 21: 7, 22: 4, 23: 2 };
const CAFE_PEOPLE = { family: 5, work: 1.4 };
const REST_PEOPLE = { family: 6, majlis: 8 };
function buildDemoOrders(items, tables, zones, { taste: zoneTaste = ZONE_TASTE, tableTaste = TABLE_TASTE, hours = CAFE_HOURS, people: crowd = CAFE_PEOPLE, perPerson = 1, costs = COSTS, seed = 20261008 } = {}) {
  const rand = rng(seed);
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  const orders = [];
  const now = new Date();
  const hourWeights = hours;
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
      const taste = tableTaste[table] && rand() < 0.8 ? tableTaste[table] : zoneTaste[zoneId];
      const people = 1 + Math.floor(rand() * (crowd[zoneId] ?? 3));
      const lines = [];
      for (let p = 0; p < Math.round(people * perPerson); p++) {
        const id = pickWeighted(rand, taste);
        const existing = lines.find((l) => l.refId === id);
        if (existing) { existing.qty++; existing.lineTotal = existing.qty * existing.unitPrice; continue; }
        const it = byId[id];
        lines.push({ kind: 'item', refId: id, name: it.name, unitPrice: it.price, qty: 1, lineTotal: it.price, options: {}, note: '', unitCost: costs[id] ?? 0 });
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

/**
 * بيانات محل جديد. type: 'cafe' | 'restaurant' · name: اسم المحل · demo: سجل طلبات تجريبي لـ21 يوم (للعرض)
 */
/** القائمة الجاهزة حسب نوع المحل (أقسام، أصناف، عروض) */
export function menuTemplate(type = 'cafe') {
  if (type === 'restaurant') {
    return {
      categories: R_CATEGORIES.map((c) => ({ ...c, image: R_CATEGORY_IMAGES[c.id] ?? null })),
      items: R_ITEMS.map((it, i) => ({ image: R_IMAGES[it.id] ?? null, available: true, recipe: R_RECIPES[it.id] ?? '', cost: R_COSTS[it.id] ?? 0, sugar: 0, caffeine: 0, sugarChoice: false, order: i + 1, ...it })),
      offers: R_OFFERS.map((o) => ({ ...o, itemIds: [...o.itemIds] })),
    };
  }
  return {
    categories: CATEGORIES.map((c) => ({ ...c, image: CATEGORY_IMAGES[c.id] ?? null })),
    items: ITEMS.map((it) => ({ image: IMAGES[it.id] ?? null, available: true, recipe: RECIPES[it.id] ?? '', cost: COSTS[it.id] ?? 0, ...it })),
    offers: OFFERS.map((o) => ({ ...o, itemIds: [...o.itemIds] })),
  };
}

export function buildSeed({ type = 'cafe', name = null, demo = true } = {}) {
  const rest = type === 'restaurant';
  const zones = (rest ? R_ZONES : ZONES).map((z) => ({ ...z }));
  const tables = rest
    ? Array.from({ length: R_TABLE_COUNT }, (_, i) => ({ number: i + 1, zoneId: rZoneForTable(i + 1), seats: rSeats(rZoneForTable(i + 1)) }))
    : Array.from({ length: TABLE_COUNT }, (_, i) => ({
      number: i + 1,
      zoneId: zoneForTable(i + 1),
      seats: zoneForTable(i + 1) === 'family' ? 6 : zoneForTable(i + 1) === 'work' ? 1 : 4,
    }));
  const { categories, items, offers } = menuTemplate(type);
  const orders = !demo ? [] : rest
    ? buildDemoOrders(items, tables, zones, { taste: R_TASTE, tableTaste: {}, hours: R_HOURS, people: REST_PEOPLE, perPerson: 1.5, costs: R_COSTS, seed: 20261015 })
    : buildDemoOrders(items, tables, zones);
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
      cafeName: name || (rest ? 'مطعم السرايا' : 'كافي محمد'),
      brandWord: (name || (rest ? 'مطعم السرايا' : 'كافي محمد')).trim().split(/\s+/).pop(),
      businessType: rest ? 'restaurant' : 'cafe', // كافيه أو مطعم: بيغيّر الكلام والهوية
      tagline: rest ? 'أكل بيتي فلسطيني على أصوله' : 'قهوة على أصولها، وإطلالة على البحر',
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
    categories,
    items,
    offers,
    zones,
    tables,
    orders,
    calls: [],
    days,
    imagesSeeded: true,
    menuVersion: 2,
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
  // القائمة v2: الأصناف الجديدة بتنضاف مرة وحدة (وما بترجع إذا صاحب المحل حذفها بعدين)،
  // والصور اللي اتبدلت بصور أوضح بتتحدّث بس إذا لسا هي نفس الصورة القديمة (مش صورة رفعها صاحب المحل)
  if ((state.menuVersion ?? 1) < 2) {
    let order = Math.max(0, ...state.items.map((i) => i.order ?? 0));
    for (const it of ITEMS) {
      if (!MENU_V2.includes(it.id) || state.items.some((x) => x.id === it.id) || !state.categories.some((c) => c.id === it.categoryId)) continue;
      state.items.push({ image: IMAGES[it.id] ?? null, available: true, recipe: RECIPES[it.id] ?? '', cost: COSTS[it.id] ?? 0, ...it, order: ++order });
    }
    for (const [id, old] of Object.entries(OLD_IMAGES)) {
      const it = state.items.find((x) => x.id === id);
      if (it && it.image === IMG(old)) it.image = IMAGES[id];
    }
    state.menuVersion = 2;
  }
  state.settings.brandWord ??= state.settings.cafeName.split(/\s+/).pop();
  state.settings.businessType ??= 'cafe';
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
