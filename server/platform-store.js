// تخزين سجل المنصة وتشفير كلمات السر (نسخة السيرفر: ملف data/platform.json و scrypt)
// نسخة الموقع الثابت بتستعمل standalone/demo-registry.js بنفس الدوال (كل شي بمتصفح الزائر)
// خبير قواعد البيانات: readRegistry/writeRegistry هون بيصيروا جداول platform_users و tenants (docs/schema.sql)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DATA_DIR } from './db.js';

const FILE = path.join(DATA_DIR, 'platform.json');
export const DEMO = false;

/** السجل المحفوظ { users, tenants, nextId, setupKey } أو null أول مرة */
export function readRegistry() {
  return fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : null;
}
export function writeRegistry(reg) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE + '.tmp', JSON.stringify(reg, null, 2));
  fs.renameSync(FILE + '.tmp', FILE);
}

export const randomHex = (bytes) => crypto.randomBytes(bytes).toString('hex');
export const newId = () => crypto.randomUUID();

export function hashPassword(password, salt = randomHex(16)) {
  return { salt, hash: crypto.scryptSync(String(password), salt, 32).toString('hex') };
}
export function samePassword(user, password) {
  const { hash } = hashPassword(password, user.salt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(user.hash, 'hex'));
}
