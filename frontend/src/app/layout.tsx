import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Ramadan Tracker",
  description: "Track your daily worship, habits, and challenges during Ramadan",
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
