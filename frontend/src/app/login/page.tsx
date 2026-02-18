"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { setAuth } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data: any = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password, keepSignedIn }),
      });
      setAuth(data.accessToken, data.refreshToken, data.user);
      router.push("/tracker");
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12">
      <div className="border-2 border-line rounded-2xl bg-card p-8">
        <h1 className="text-2xl font-extrabold text-center mb-6">Login</h1>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full border-2 border-line rounded-lg px-3 py-2 focus:outline-none focus:border-accent" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full border-2 border-line rounded-lg px-3 py-2 focus:outline-none focus:border-accent" />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={keepSignedIn} onChange={(e) => setKeepSignedIn(e.target.checked)} className="accent-accent" />
            Keep me signed in (45 days)
          </label>
          <button type="submit" disabled={loading} className="w-full bg-ink text-white py-2.5 rounded-lg font-bold hover:opacity-90 transition disabled:opacity-50">
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
        <div className="mt-4 text-center text-sm">
          <Link href="/forgot-password" className="text-accent hover:underline">Forgot Password?</Link>
        </div>
        <div className="mt-2 text-center text-sm">
          Don&apos;t have an account? <Link href="/signup" className="text-accent font-semibold hover:underline">Sign Up</Link>
        </div>
      </div>
    </div>
  );
}
