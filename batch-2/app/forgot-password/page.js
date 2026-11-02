"use client";

import { useState } from "react";
import Link from "next/link";
import BrandMark from "@/components/BrandMark";
import Aurora from "@/components/glass/Aurora";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setMessage(data.message);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="gd relative min-h-screen flex items-center justify-center px-6 py-10 font-quick">
      <Aurora />
      <div className="relative z-10 w-full max-w-sm view-in">
        <div className="text-center mb-7">
          <BrandMark size={24} className="mx-auto" />
          <h1 className="font-display text-2xl font-bold text-ink mt-3">Reset your password</h1>
          <p className="text-ink/55 text-sm mt-1">Enter the email on your restaurant account.</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-strong rounded-3xl p-6 grid gap-4">
          <div>
            <label className="block text-xs font-semibold text-ink mb-1.5">Email</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-ink/15 rounded-card px-3.5 py-2.5 text-sm bg-white outline-none focus:border-chili"
            />
          </div>

          {error && <p className="text-xs text-chili-dark font-medium">{error}</p>}
          {message && <p className="text-xs text-herb font-medium">{message}</p>}

          <button
            disabled={loading}
            className="bg-leaf hover:bg-leaf-dark disabled:opacity-60 transition-colors text-white font-semibold py-3 rounded-card"
          >
            {loading ? "Sending..." : "Send reset instructions"}
          </button>

          <p className="text-center text-xs text-clay">
            <Link href="/login" className="text-leaf-dark font-semibold">Back to log in</Link>
          </p>
        </form>
      </div>
    </main>
  );
}
