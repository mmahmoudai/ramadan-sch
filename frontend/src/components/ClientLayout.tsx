"use client";

import Navbar from "@/components/Navbar";
import { LanguageProvider } from "@/contexts/LanguageContext";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <Navbar />
      <main className="mx-auto max-w-[1100px] w-[96vw] my-6 p-4">
        {children}
      </main>
    </LanguageProvider>
  );
}
