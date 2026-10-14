// الطقس الحالي من Open-Meteo (مجاني وبدون مفتاح) مع كاش ربع ساعة
import { db } from './db.js';

const CODES = {
  0: 'صافي', 1: 'صافي غالباً', 2: 'غائم جزئياً', 3: 'غائم',
  45: 'ضباب', 48: 'ضباب متجمد',
  51: 'رذاذ خفيف', 53: 'رذاذ', 55: 'رذاذ كثيف',
  61: 'مطر خفيف', 63: 'مطر', 65: 'مطر غزير',
  66: 'مطر متجمد', 67: 'مطر متجمد غزير',
  71: 'ثلج خفيف', 73: 'ثلج', 75: 'ثلج كثيف', 77: 'حبيبات ثلج',
  80: 'زخات مطر', 81: 'زخات مطر قوية', 82: 'زخات غزيرة',
  85: 'زخات ثلج', 86: 'زخات ثلج قوية',
  95: 'عاصفة رعدية', 96: 'عاصفة رعدية مع برد', 99: 'عاصفة رعدية قوية',
};

let cache = { key: '', at: 0, data: null };

export function describeFeel(t) {
  if (t == null) return null;
  if (t < 12) return 'بارد';
  if (t < 19) return 'معتدل يميل للبرودة';
  if (t < 26) return 'لطيف';
  if (t < 31) return 'دافئ';
  return 'حار';
}

export async function currentWeather() {
  const { lat, lon, city } = db().settings;
  const key = `${lat},${lon}`;
  if (cache.data && cache.key === key && Date.now() - cache.at < 15 * 60 * 1000) return cache.data;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
    + '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day&timezone=auto';
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    const c = j.current;
    const data = {
      ok: true,
      city,
      temp: Math.round(c.temperature_2m),
      feels: Math.round(c.apparent_temperature),
      humidity: c.relative_humidity_2m,
      wind: Math.round(c.wind_speed_10m),
      code: c.weather_code,
      isDay: c.is_day === 1,
      desc: CODES[c.weather_code] ?? 'غير معروف',
      rainy: [51, 53, 55, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(c.weather_code),
      feel: describeFeel(c.apparent_temperature),
    };
    cache = { key, at: Date.now(), data };
    return data;
  } catch (err) {
    console.warn('⚠️  تعذر جلب الطقس:', err.message);
    return cache.data ?? { ok: false, city };
  }
}

export async function geocode(q) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=ar&format=json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  return (j.results ?? []).map((r) => ({
    name: r.name, country: r.country, admin: r.admin1, lat: r.latitude, lon: r.longitude,
  }));
}
