// إعادة ضبط بيانات محل للوضع التجريبي: npm run reset (محل 1001) أو npm run reset -- 1002
import { reset, withTenant, DEFAULT_TENANT } from './db.js';

const id = process.argv[2] ?? DEFAULT_TENANT;
withTenant(id, () => reset());
console.log(`✔ رجعت بيانات المحل ${id} للوضع التجريبي (data/tenants/${id}.json).`);
