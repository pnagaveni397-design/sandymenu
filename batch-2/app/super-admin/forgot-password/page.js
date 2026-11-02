"use client";

import { useState } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export default function SuperAdminForgotPasswordPage() {
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
      const res = await fetch("/api/super-admin/auth/forgot-password", {
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
    <main className="min-h-screen bg-ink flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-7">
          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mx-auto">
            <ShieldCheck size={24} className="text-turmeric" />
          </div>
          <h1 className="font-display text-2xl font-bold text-paper mt-3">Reset super admin password</h1>
          <p className="text-paper/50 text-sm mt-1">Enter the email on your super admin account.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-paper rounded-2xl p-6 shadow-2xl grid gap-4">
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
            className="bg-chili hover:bg-chili-dark disabled:opacity-60 transition-colors text-white font-semibold py-3 rounded-card"
          >
            {loading ? "Sending..." : "Send reset instructions"}
          </button>

          <p className="text-center text-xs text-clay">
            <Link href="/super-admin/login" className="text-chili font-semibold">Back to log in</Link>
          </p>
        </form>

        <p className="text-center text-xs text-paper/40 mt-4">
          If email isn't set up on this server, the reset link is printed to the server's terminal/log instead.
        </p>
      </div>
    </main>
  );
}
