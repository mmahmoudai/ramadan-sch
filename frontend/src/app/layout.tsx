import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

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
    <html lang="en" dir="ltr">
      <body className="min-h-screen bg-bg text-ink">
        <Navbar />
        <main className="mx-auto max-w-[1100px] w-[96vw] my-6 p-4">
          {children}
        </main>
      </body>
    </html>
  );
}
