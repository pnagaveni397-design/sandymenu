"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Login fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Setup fields
  const [setupEmail, setSetupEmail] = useState("");
  const [setupPassword, setSetupPassword] = useState("");
  const [setupConfirmPassword, setSetupConfirmPassword] = useState("");

  useEffect(() => {
    fetch("/api/super-admin/auth/status")
      .then((r) => r.json())
      .then((data) => setConfigured(!!data.configured))
      .catch(() => setConfigured(true))
      .finally(() => setChecking(false));
  }, []);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/super-admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      router.push("/super-admin");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSetup(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/super-admin/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: setupEmail,
          password: setupPassword,
          confirmPassword: setupConfirmPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Setup failed");
      router.push("/super-admin");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <main className="min-h-screen bg-ink flex items-center justify-center px-6">
        <p className="text-paper/50 text-sm">Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-ink flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-7">
          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mx-auto">
            <ShieldCheck size={24} className="text-turmeric" />
          </div>
          <h1 className="font-display text-2xl font-bold text-paper mt-3">Super admin</h1>
          <p className="text-paper/50 text-sm mt-1">Platform owner access only — not for restaurant clients.</p>
        </div>

        {!configured ? (
          <form onSubmit={handleSetup} className="bg-paper rounded-2xl p-6 shadow-2xl grid gap-4">
            <p className="text-xs text-clay -mt-1">
              First time here — set up your own super admin login. There's no default/demo account; this is
              stored securely and only you will know it.
            </p>
            <Field label="Your email" type="email" value={setupEmail} onChange={setSetupEmail} />
            <Field label="Password" type="password" value={setupPassword} onChange={setSetupPassword} minLength={6} placeholder="At least 6 characters" />
            <Field label="Confirm password" type="password" value={setupConfirmPassword} onChange={setSetupConfirmPassword} minLength={6} />
            {error && <p className="text-xs text-chili-dark font-medium">{error}</p>}
            <button
              disabled={loading}
              className="bg-chili hover:bg-chili-dark disabled:opacity-60 transition-colors text-white font-semibold py-3 rounded-card"
            >
              {loading ? "Setting up..." : "Create super admin account"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="bg-paper rounded-2xl p-6 shadow-2xl grid gap-4">
            <Field label="Email" type="email" value={email} onChange={setEmail} />
            <Field label="Password" type="password" value={password} onChange={setPassword} />
            {error && <p className="text-xs text-chili-dark font-medium">{error}</p>}
            <button
              disabled={loading}
              className="bg-chili hover:bg-chili-dark disabled:opacity-60 transition-colors text-white font-semibold py-3 rounded-card"
            >
              {loading ? "Logging in..." : "Log in"}
            </button>
            <Link href="/super-admin/forgot-password" className="text-xs font-semibold text-chili text-center">
              Forgot password?
            </Link>
          </form>
        )}
      </div>
    </main>
  );
}

function Field({ label, type = "text", value, onChange, minLength, placeholder, inputMode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-ink mb-1.5">{label}</label>
      <input
        required
        type={type}
        inputMode={inputMode}
        minLength={minLength}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-ink/15 rounded-card px-3.5 py-2.5 text-sm bg-white outline-none focus:border-chili"
      />
    </div>
  );
}
