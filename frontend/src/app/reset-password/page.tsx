"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRedirectIfAuthed } from "@/hooks/useRedirectIfAuthed";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  useRedirectIfAuthed();

  const token = (searchParams.get("token") || "").trim();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!token) {
      setError(t("auth.validation.invalidResetLink"));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t("auth.validation.passwordsDoNotMatch"));
      return;
    }

    if (newPassword.length < 8) {
      setError(t("auth.validation.passwordMin"));
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      setError(t("auth.validation.passwordUppercase"));
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      setError(t("auth.validation.passwordNumber"));
      return;
    }

    setLoading(true);
    try {
      await apiFetch("/auth/password/reset", {
        method: "POST",
        body: JSON.stringify({ token, newPassword }),
      });
      setMessage(t("auth.passwordResetSuccess"));
      setTimeout(() => router.push("/login"), 1200);
    } catch (err: any) {
      setError(err.message || t("auth.passwordResetFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12">
      <div className="border-2 border-line rounded-2xl bg-card p-8">
        <h1 className="text-2xl font-extrabold text-center mb-6">{t("auth.resetPasswordTitle")}</h1>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm whitespace-pre-line">{error}</div>
        )}
        {message && <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-3 mb-4 text-sm">{message}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1">{t("auth.newPassword")}</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              required
              className="w-full border-2 border-line rounded-lg px-3 py-2 focus:outline-none focus:border-accent"
            />
            <p className="text-xs text-gray-400 mt-1">{t("auth.validation.passwordHint")}</p>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">{t("auth.confirmPassword")}</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
              required
              className="w-full border-2 border-line rounded-lg px-3 py-2 focus:outline-none focus:border-accent"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !token}
            className="w-full bg-ink text-white py-2.5 rounded-lg font-bold hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? t("auth.resetting") : t("auth.resetPasswordAction")}
          </button>
        </form>

        <div className="mt-4 text-center text-sm">
          <Link href="/login" className="text-accent hover:underline">
            {t("auth.backToLogin")}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-lg">Loading...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
