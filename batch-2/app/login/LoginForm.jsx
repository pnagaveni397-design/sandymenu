"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BrandMark from "@/components/BrandMark";
import Aurora from "@/components/glass/Aurora";
import GoogleButton from "@/components/auth/GoogleButton";

const LOGIN_ERRORS = {
  google_off: "Google login isn't switched on yet. The site owner needs to add the Google keys (see README). Please use your email for now.",
  google_cancelled: "Google sign-in was cancelled.",
  google_state: "That Google sign-in expired. Please try again.",
  google_failed: "Google sign-in didn't work. Please try again or use your email.",
  google_unverified: "That Google account's email isn't verified, so we can't use it.",
};

// Shown only while testing, before the Google keys exist: exactly what to create and where to put it.
function GoogleSetupHelp() {
  const [origin, setOrigin] = useState("http://localhost:3000");
  useEffect(() => setOrigin(window.location.origin), []);
  return (
    <details className="text-xs text-ink/70 bg-turmeric/15 border border-turmeric/30 rounded-card px-3.5 py-2.5 -mt-2">
      <summary className="cursor-pointer font-semibold text-ink">Google button not working? Switch it on (testing only)</summary>
      <ol className="list-decimal pl-4 mt-2 grid gap-1.5">
        <li>In Google Cloud Console, create an <strong>OAuth client ID</strong> (type: Web application).</li>
        <li>Under <strong>Authorized redirect URIs</strong> add exactly:<br /><code className="break-all bg-white/70 rounded px-1">{origin}/api/auth/google/callback</code></li>
        <li>Create a file named <code className="bg-white/70 rounded px-1">.env.local</code> next to <code className="bg-white/70 rounded px-1">package.json</code> with:<br /><code className="block bg-white/70 rounded px-1.5 py-1 mt-1">GOOGLE_CLIENT_ID=your-id<br />GOOGLE_CLIENT_SECRET=your-secret</code></li>
        <li>Stop and start <code className="bg-white/70 rounded px-1">npm run dev</code>, then try again. If Google says "access blocked", add your Gmail under <em>Test users</em>.</li>
      </ol>
      <p className="mt-2">This box disappears on your live site.</p>
    </details>
  );
}

export default function LoginForm({ googleEnabled = false, googleReady = true, initialError = "", next = "" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(LOGIN_ERRORS[initialError] || "");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      router.push(data.redirect || `/dashboard/${data.slug}`);
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
          <h1 className="font-display text-2xl font-bold text-ink mt-3">Restaurant login</h1>
          <p className="text-ink/55 text-sm mt-1">TableServe dashboard access.</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-strong rounded-3xl p-6 grid gap-4">
          {googleEnabled && <GoogleButton next={next} />}
          {googleEnabled && !googleReady && <GoogleSetupHelp />}
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
          <div>
            <label className="block text-xs font-semibold text-ink mb-1.5">Password</label>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-ink/15 rounded-card px-3.5 py-2.5 text-sm bg-white outline-none focus:border-chili"
            />
          </div>

          {error && <p className="text-xs text-chili-dark font-medium">{error}</p>}

          <button
            disabled={loading}
            className="bg-leaf hover:bg-leaf-dark disabled:opacity-60 transition-colors text-white font-semibold py-3 rounded-card mt-1"
          >
            {loading ? "Logging in..." : "Log in"}
          </button>

          <p className="text-center text-xs text-clay">
            <Link href="/forgot-password" className="text-leaf-dark font-semibold">Forgot password?</Link>
          </p>
          <p className="text-center text-xs text-clay">
            New restaurant?{" "}
            <Link href="/signup" className="text-leaf-dark font-semibold">Create an account</Link>
          </p>
        </form>
      </div>
    </main>
  );
}
