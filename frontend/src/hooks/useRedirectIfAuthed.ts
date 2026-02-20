"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn } from "@/lib/auth";

/**
 * Redirects already-authenticated users away from guest-only pages
 * (login, signup, forgot-password, reset-password).
 * Call this at the top of any page that should be inaccessible after login.
 */
export function useRedirectIfAuthed(to = "/tracker") {
  const router = useRouter();
  useEffect(() => {
    if (isLoggedIn()) {
      router.replace(to);
    }
  }, [router, to]);
}
