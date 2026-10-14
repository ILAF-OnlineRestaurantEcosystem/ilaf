// إعادة ضبط البيانات للوضع التجريبي الأصلي: npm run reset
import { reset } from './db.js';
reset();
console.log('✔ رجعت البيانات للوضع الافتراضي (data/db.json).');
