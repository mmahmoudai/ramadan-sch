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
    <html>
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
