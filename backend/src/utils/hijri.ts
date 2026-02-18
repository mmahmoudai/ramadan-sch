/**
 * Simple Hijri date conversion using the Umm al-Qura approximation.
 * For production, consider using a dedicated library like hijri-date or moment-hijri.
 * This implementation uses the well-known algorithm for approximate conversion.
 */

export interface HijriDate {
  year: number;
  month: number;
  day: number;
}

export function gregorianToHijri(gDate: Date): HijriDate {
  const gy = gDate.getFullYear();
  const gm = gDate.getMonth() + 1;
  const gd = gDate.getDate();

  let jd =
    Math.floor((1461 * (gy + 4800 + Math.floor((gm - 14) / 12))) / 4) +
    Math.floor((367 * (gm - 2 - 12 * Math.floor((gm - 14) / 12))) / 12) -
    Math.floor((3 * Math.floor((gy + 4900 + Math.floor((gm - 14) / 12)) / 100)) / 4) +
    gd -
    32075;

  jd = jd - 1948440 + 10632;
  const n = Math.floor((jd - 1) / 10631);
  jd = jd - 10631 * n + 354;

  const j =
    Math.floor((10985 - jd) / 5316) *
      Math.floor((50 * jd) / 17719) +
    Math.floor(jd / 5670) *
      Math.floor((43 * jd) / 15238);

  jd =
    jd -
    Math.floor((30 - j) / 15) *
      Math.floor((17719 * j) / 50) -
    Math.floor(j / 16) *
      Math.floor((15238 * j) / 43) +
    29;

  const hm = Math.floor((24 * jd) / 709);
  const hd = jd - Math.floor((709 * hm) / 24);
  const hy = 30 * n + j - 30;

  return { year: hy, month: hm, day: hd };
}

export function formatHijriDate(h: HijriDate): string {
  const monthNames = [
    "Muharram", "Safar", "Rabi al-Awwal", "Rabi al-Thani",
    "Jumada al-Ula", "Jumada al-Thani", "Rajab", "Sha'ban",
    "Ramadan", "Shawwal", "Dhu al-Qi'dah", "Dhu al-Hijjah"
  ];
  const monthNameAr = [
    "محرم", "صفر", "ربيع الأول", "ربيع الآخر",
    "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان",
    "رمضان", "شوال", "ذو القعدة", "ذو الحجة"
  ];
  return `${h.day} ${monthNames[h.month - 1] || "?"} ${h.year} هـ / ${h.day} ${monthNameAr[h.month - 1] || "?"} ${h.year}`;
}

export function getHijriWeekIndex(hijriDay: number): number {
  return Math.ceil(hijriDay / 7);
}
