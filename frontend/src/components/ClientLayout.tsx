"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import Navbar from "@/components/Navbar";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { locale } = useLanguage();
  
  return (
    <div key={locale}>
      <Navbar />
      <main className="mx-auto max-w-[1100px] w-[96vw] my-6 p-4">
        {children}
      </main>
    </div>
  );
}
