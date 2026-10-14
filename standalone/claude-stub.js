// بنسخة الـ HTML المستقلة ما في سيرفر يحمي مفتاح Claude، فالباريستا بيشتغل بالوضع الأساسي
export function aiConfigured() { return false; }
export function aiStatus() { return { configured: false, model: '', paused: false, lastError: null, standalone: true }; }
export async function askClaude() { throw new Error('no-key'); }
