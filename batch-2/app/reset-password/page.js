"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import BrandMark from "@/components/BrandMark";
import Aurora from "@/components/glass/Aurora";

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not reset password.");
      setDone(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return <p className="text-center text-sm text-chili-dark">This reset link is missing its token. Request a new one from the forgot-password page.</p>;
  }

  if (done) {
    return <p className="text-center text-sm text-herb font-medium">Password updated! Redirecting to log in...</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div>
        <label className="block text-xs font-semibold text-ink mb-1.5">New password</label>
        <input
          required
          type="password"
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-ink/15 rounded-card px-3.5 py-2.5 text-sm bg-white outline-none focus:border-chili"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-ink mb-1.5">Confirm new password</label>
        <input
          required
          type="password"
          minLength={6}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full border border-ink/15 rounded-card px-3.5 py-2.5 text-sm bg-white outline-none focus:border-chili"
        />
      </div>
      {error && <p className="text-xs text-chili-dark font-medium">{error}</p>}
      <button
        disabled={loading}
        className="bg-leaf hover:bg-leaf-dark disabled:opacity-60 transition-colors text-white font-semibold py-3 rounded-card"
      >
        {loading ? "Saving..." : "Set new password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="gd relative min-h-screen flex items-center justify-center px-6 py-10 font-quick">
      <Aurora />
      <div className="relative z-10 w-full max-w-sm view-in">
        <div className="text-center mb-7">
          <BrandMark size={24} className="mx-auto" />
          <h1 className="font-display text-2xl font-bold text-ink mt-3">Set a new password</h1>
        </div>
        <div className="glass-strong rounded-3xl p-6">
          <Suspense fallback={<p className="text-sm text-clay text-center">Loading...</p>}>
            <ResetPasswordForm />
          </Suspense>
          <p className="text-center text-xs text-clay mt-4">
            <Link href="/login" className="text-leaf-dark font-semibold">Back to log in</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
