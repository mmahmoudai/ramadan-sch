export type Locale = "en" | "ar";

const translations: Record<Locale, Record<string, string>> = {
  en: {
    "app.title": "Ramadan Tracker",
    "app.subtitle": "رمضان كريم",
    "nav.home": "Home",
    "nav.tracker": "Tracker",
    "nav.dashboard": "Dashboard",
    "nav.challenges": "Challenges",
    "nav.family": "Family",
    "nav.reports": "Reports",
    "nav.settings": "Settings",
    "nav.login": "Login",
    "nav.signup": "Sign Up",
    "nav.logout": "Logout",
    "auth.email": "Email",
    "auth.password": "Password",
    "auth.displayName": "Display Name",
    "auth.keepSignedIn": "Keep me signed in (45 days)",
    "auth.forgotPassword": "Forgot Password?",
    "auth.noAccount": "Don't have an account?",
    "auth.hasAccount": "Already have an account?",
    "tracker.ibadah": "Ibadah (العبادة)",
    "tracker.habits": "Habits",
    "tracker.salah": "Salah Tracker",
    "tracker.sunnah": "Sunnah Tracker",
    "tracker.mood": "Mood Tracker",
    "tracker.gratitude": "Alhamdulillah for",
    "tracker.quran": "Qur'an Tracker",
    "tracker.hadith": "Hadith of the Day",
    "tracker.challenge": "Challenge of the Day",
    "tracker.locked": "This entry is permanently locked",
    "tracker.completed": "completed items",
    "tracker.resetDay": "Reset Day",
    "dashboard.title": "Dashboard",
    "dashboard.streak": "Current Streak",
    "dashboard.totalEntries": "Total Entries",
    "dashboard.todayScore": "Today's Score",
    "dashboard.weeklyTrend": "Weekly Trend",
    "challenges.title": "Challenges",
    "challenges.create": "Create Challenge",
    "challenges.daily": "Daily",
    "challenges.weekly": "Weekly",
    "challenges.monthly": "Monthly",
    "family.title": "Family Groups",
    "family.create": "Create Group",
    "family.invite": "Invite Member",
    "reports.title": "Reports",
    "reports.create": "Create Report",
    "settings.title": "Settings",
    "settings.language": "Language",
    "settings.timezone": "Timezone",
    "settings.reminders": "Email Reminders",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.delete": "Delete",
    "common.loading": "Loading...",
    "common.error": "An error occurred",
  },
  ar: {
    "app.title": "متتبع رمضان",
    "app.subtitle": "رمضان كريم",
    "nav.home": "الرئيسية",
    "nav.tracker": "المتتبع",
    "nav.dashboard": "لوحة المعلومات",
    "nav.challenges": "التحديات",
    "nav.family": "العائلة",
    "nav.reports": "التقارير",
    "nav.settings": "الإعدادات",
    "nav.login": "تسجيل الدخول",
    "nav.signup": "إنشاء حساب",
    "nav.logout": "تسجيل الخروج",
    "auth.email": "البريد الإلكتروني",
    "auth.password": "كلمة المرور",
    "auth.displayName": "الاسم",
    "auth.keepSignedIn": "البقاء متصلاً (45 يوم)",
    "auth.forgotPassword": "نسيت كلمة المرور؟",
    "auth.noAccount": "ليس لديك حساب؟",
    "auth.hasAccount": "لديك حساب بالفعل؟",
    "tracker.ibadah": "العبادة",
    "tracker.habits": "العادات",
    "tracker.salah": "متتبع الصلاة",
    "tracker.sunnah": "متتبع السنن",
    "tracker.mood": "المزاج",
    "tracker.gratitude": "الحمد لله على",
    "tracker.quran": "متتبع القرآن",
    "tracker.hadith": "حديث اليوم",
    "tracker.challenge": "تحدي اليوم",
    "tracker.locked": "هذا الإدخال مقفل نهائياً",
    "tracker.completed": "عناصر مكتملة",
    "tracker.resetDay": "إعادة تعيين اليوم",
    "dashboard.title": "لوحة المعلومات",
    "dashboard.streak": "السلسلة الحالية",
    "dashboard.totalEntries": "إجمالي الأيام",
    "dashboard.todayScore": "نتيجة اليوم",
    "dashboard.weeklyTrend": "الاتجاه الأسبوعي",
    "challenges.title": "التحديات",
    "challenges.create": "إنشاء تحدي",
    "challenges.daily": "يومي",
    "challenges.weekly": "أسبوعي",
    "challenges.monthly": "شهري",
    "family.title": "مجموعات العائلة",
    "family.create": "إنشاء مجموعة",
    "family.invite": "دعوة عضو",
    "reports.title": "التقارير",
    "reports.create": "إنشاء تقرير",
    "settings.title": "الإعدادات",
    "settings.language": "اللغة",
    "settings.timezone": "المنطقة الزمنية",
    "settings.reminders": "تذكيرات البريد",
    "common.save": "حفظ",
    "common.cancel": "إلغاء",
    "common.delete": "حذف",
    "common.loading": "جاري التحميل...",
    "common.error": "حدث خطأ",
  },
};

export function t(key: string, locale: Locale = "en"): string {
  return translations[locale]?.[key] || translations.en[key] || key;
}

export function getDirection(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

// Hijri month names in Arabic and English
const hijriMonths = {
  ar: [
    "محرم", "صفر", "ربيع الأول", "ربيع الثاني", "جمادى الأولى", "جمادى الثانية",
    "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة"
  ],
  en: [
    "Muharram", "Safar", "Rabi' al-Awwal", "Rabi' al-Thani", "Jumada al-Awwal", "Jumada al-Thani",
    "Rajab", "Sha'ban", "Ramadan", "Shawwal", "Dhu al-Qi'dah", "Dhu al-Hijjah"
  ]
};

export function formatHijriDate(day: number, month: number, year: number, locale: Locale = "en"): string {
  const monthName = hijriMonths[locale][month - 1] || hijriMonths.en[month - 1];
  
  if (locale === "ar") {
    return `${day} ${monthName} ${year} هـ`;
  } else {
    return `${day} ${monthName} ${year} AH`;
  }
}
