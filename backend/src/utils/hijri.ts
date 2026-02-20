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

export type ChallengeScope = "daily" | "weekly" | "monthly";

export interface HijriChallengePeriodMetadata {
  periodIndex: number;
  hijriYear: number;
  hijriMonth: number | null;
  hijriDay: number | null;
  hijriWeekIndex: number | null;
  startDateGregorian: string;
  endDateGregorian: string;
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

const GREGORIAN_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseGregorianDateStrict(dateStr: string): Date {
  if (!GREGORIAN_DATE_RE.test(dateStr)) {
    throw new Error("Invalid Gregorian date format. Expected YYYY-MM-DD.");
  }

  const [yearRaw, monthRaw, dayRaw] = dateStr.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const parsed = new Date(year, month - 1, day, 12, 0, 0, 0);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    throw new Error("Invalid Gregorian date value.");
  }

  return parsed;
}

export function formatGregorianDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function sameHijriMonth(date: Date, hijriYear: number, hijriMonth: number): boolean {
  const hijri = gregorianToHijri(date);
  return hijri.year === hijriYear && hijri.month === hijriMonth;
}

function getHijriMonthBounds(anchorDate: Date): { start: Date; end: Date; lastHijriDay: number } {
  const anchorHijri = gregorianToHijri(anchorDate);
  const { year, month } = anchorHijri;

  let start = new Date(anchorDate);
  for (let i = 0; i < 40; i++) {
    const prev = addDays(start, -1);
    if (!sameHijriMonth(prev, year, month)) break;
    start = prev;
  }

  let end = new Date(anchorDate);
  for (let i = 0; i < 40; i++) {
    const next = addDays(end, 1);
    if (!sameHijriMonth(next, year, month)) break;
    end = next;
  }

  const lastHijriDay = gregorianToHijri(end).day;
  return { start, end, lastHijriDay };
}

function findGregorianDateByHijriDay(
  monthStart: Date,
  hijriYear: number,
  hijriMonth: number,
  targetHijriDay: number
): Date | null {
  let cursor = new Date(monthStart);
  for (let i = 0; i < 40; i++) {
    const hijri = gregorianToHijri(cursor);
    if (hijri.year !== hijriYear || hijri.month !== hijriMonth) return null;
    if (hijri.day === targetHijriDay) return cursor;
    cursor = addDays(cursor, 1);
  }
  return null;
}

export function getHijriChallengePeriodMetadata(
  dateGregorian: string,
  scope: ChallengeScope
): HijriChallengePeriodMetadata {
  const gregorianDate = parseGregorianDateStrict(dateGregorian);
  const hijri = gregorianToHijri(gregorianDate);
  const weekIndex = getHijriWeekIndex(hijri.day);

  if (scope === "daily") {
    return {
      periodIndex: hijri.year * 10000 + hijri.month * 100 + hijri.day,
      hijriYear: hijri.year,
      hijriMonth: hijri.month,
      hijriDay: hijri.day,
      hijriWeekIndex: weekIndex,
      startDateGregorian: dateGregorian,
      endDateGregorian: dateGregorian,
    };
  }

  const monthBounds = getHijriMonthBounds(gregorianDate);

  if (scope === "monthly") {
    return {
      periodIndex: hijri.year * 100 + hijri.month,
      hijriYear: hijri.year,
      hijriMonth: hijri.month,
      hijriDay: null,
      hijriWeekIndex: null,
      startDateGregorian: formatGregorianDate(monthBounds.start),
      endDateGregorian: formatGregorianDate(monthBounds.end),
    };
  }

  const weekStartHijriDay = Math.floor((hijri.day - 1) / 7) * 7 + 1;
  const weekEndHijriDay = Math.min(weekStartHijriDay + 6, monthBounds.lastHijriDay);

  const weekStartDate =
    findGregorianDateByHijriDay(monthBounds.start, hijri.year, hijri.month, weekStartHijriDay) || monthBounds.start;
  const weekEndDate =
    findGregorianDateByHijriDay(monthBounds.start, hijri.year, hijri.month, weekEndHijriDay) || monthBounds.end;

  return {
    periodIndex: hijri.year * 1000 + hijri.month * 10 + weekIndex,
    hijriYear: hijri.year,
    hijriMonth: hijri.month,
    hijriDay: null,
    hijriWeekIndex: weekIndex,
    startDateGregorian: formatGregorianDate(weekStartDate),
    endDateGregorian: formatGregorianDate(weekEndDate),
  };
}
