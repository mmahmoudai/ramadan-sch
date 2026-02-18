"use client";

import { useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const data: any = await apiFetch("/auth/password/forgot", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setMessage(data.message);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12">
      <div className="border-2 border-line rounded-2xl bg-card p-8">
        <h1 className="text-2xl font-extrabold text-center mb-6">Forgot Password</h1>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">{error}</div>}
        {message && <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-3 mb-4 text-sm">{message}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full border-2 border-line rounded-lg px-3 py-2 focus:outline-none focus:border-accent" />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-ink text-white py-2.5 rounded-lg font-bold hover:opacity-90 transition disabled:opacity-50">
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
        </form>
        <div className="mt-4 text-center text-sm">
          <Link href="/login" className="text-accent hover:underline">Back to Login</Link>
        </div>
      </div>
    </div>
  );
}
