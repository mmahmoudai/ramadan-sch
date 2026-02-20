import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "@/contexts/LanguageContext";
import ClientLayout from "@/components/ClientLayout";

export const metadata: Metadata = {
  title: "Ramadan Tracker - Track Your Daily Worship & Habits",
  description: "Track your daily worship, habits, and challenges during Ramadan. Monitor prayers, Quran reading, fasting, and spiritual growth with beautiful analytics.",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
  metadataBase: new URL("https://ramadantracker.club"),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var l=localStorage.getItem('language');if(l==='ar'){document.documentElement.lang='ar';document.documentElement.dir='rtl';}else if(l==='tr'){document.documentElement.lang='tr';document.documentElement.dir='ltr';}}catch(e){}document.documentElement.style.visibility='hidden';})();`,
          }}
        />
      </head>
      <body className="min-h-screen bg-bg text-ink">
        <LanguageProvider>
          <ClientLayout>
            {children}
          </ClientLayout>
        </LanguageProvider>
      </body>
    </html>
  );
}
