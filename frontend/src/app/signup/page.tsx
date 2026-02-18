"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { setAuth } from "@/lib/auth";

export default function SignupPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data: any = await apiFetch("/auth/signup", {
        method: "POST",
        body: JSON.stringify({ email, password, displayName }),
      });
      setAuth(data.accessToken, data.refreshToken, data.user);
      router.push("/tracker");
    } catch (err: any) {
      setError(err.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12">
      <div className="border-2 border-line rounded-2xl bg-card p-8">
        <h1 className="text-2xl font-extrabold text-center mb-6">Create Account</h1>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Display Name</label>
            <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required className="w-full border-2 border-line rounded-lg px-3 py-2 focus:outline-none focus:border-accent" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full border-2 border-line rounded-lg px-3 py-2 focus:outline-none focus:border-accent" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Password (min 8 chars)</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="w-full border-2 border-line rounded-lg px-3 py-2 focus:outline-none focus:border-accent" />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-ink text-white py-2.5 rounded-lg font-bold hover:opacity-90 transition disabled:opacity-50">
            {loading ? "Creating..." : "Sign Up"}
          </button>
        </form>
        <div className="mt-4 text-center text-sm">
          Already have an account? <Link href="/login" className="text-accent font-semibold hover:underline">Login</Link>
        </div>
      </div>
    </div>
  );
}
