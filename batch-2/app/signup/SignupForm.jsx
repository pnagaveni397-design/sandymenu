"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BrandMark from "@/components/BrandMark";
import Aurora from "@/components/glass/Aurora";
import { Camera } from "lucide-react";
import GoogleButton from "@/components/auth/GoogleButton";

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function SignupForm({ googleEnabled = false, googleToken = "" }) {
  const router = useRouter();
  const [restaurantName, setRestaurantName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [coverPreview, setCoverPreview] = useState(null);
  const [coverDataUrl, setCoverDataUrl] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleInfo, setGoogleInfo] = useState(null); // { email, name } once we know who signed in with Google

  useEffect(() => {
    if (!googleToken) return;
    (async () => {
      try {
        const res = await fetch(`/api/auth/google/pending?token=${encodeURIComponent(googleToken)}`);
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || "Google sign-in expired.");
        setGoogleInfo(j);
        setEmail(j.email);
      } catch (e) {
        setError(e.message);
      }
    })();
  }, [googleToken]);

  async function handleImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setCoverDataUrl(dataUrl);
    setCoverPreview(dataUrl);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!googleToken && password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    if (!/^[\d+\-\s()]{7,15}$/.test(phone.trim())) {
      setError("Enter a valid phone number.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantName, email, phone: phone.trim(), password, coverImageDataUrl: coverDataUrl, googleToken: googleToken || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Signup failed");
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
      <div className="relative z-10 w-full max-w-md view-in">
        <div className="text-center mb-7">
          <BrandMark size={24} className="mx-auto" />
          <h1 className="font-display text-2xl font-bold text-ink mt-3">Set up your restaurant</h1>
          <p className="text-ink/55 text-sm mt-1">Get your QR menu live in a couple of minutes.</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-strong rounded-3xl p-6 grid gap-4">
          {googleEnabled && !googleToken && <GoogleButton label="Sign up with Google" />}
          {googleToken && (
            <p className="text-xs bg-leaf-light text-leaf-dark rounded-card px-3.5 py-2.5">
              {googleInfo ? <>Signed in with Google as <strong>{googleInfo.email}</strong>. Just add your restaurant details.</> : "Checking your Google sign-in…"}
            </p>
          )}
          <div>
            <label className="block text-xs font-semibold text-ink mb-1.5">Restaurant / hotel name</label>
            <input
              required
              value={restaurantName}
              onChange={(e) => setRestaurantName(e.target.value)}
              placeholder="e.g. Spice Garden"
              className="w-full border border-ink/15 rounded-card px-3.5 py-2.5 text-sm bg-white outline-none focus:border-chili"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink mb-1.5">Cover / logo image (optional)</label>
            <label className="flex items-center gap-3 border border-dashed border-ink/25 rounded-card p-3 cursor-pointer hover:border-chili/50 transition-colors">
              {coverPreview ? (
                <img src={coverPreview} alt="preview" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
              ) : (
                <span className="w-14 h-14 rounded-lg bg-clay-light flex items-center justify-center flex-shrink-0"><Camera size={22} className="text-clay" /></span>
              )}
              <span className="text-xs text-clay">Click to upload a photo of your restaurant or logo</span>
              <input type="file" accept="image/*" onChange={handleImage} className="hidden" />
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink mb-1.5">Email</label>
            <input
              required
              type="email"
              value={email}
              readOnly={!!googleToken}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@restaurant.com"
              className="w-full border border-ink/15 rounded-card px-3.5 py-2.5 text-sm bg-white outline-none focus:border-chili"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink mb-1.5">Phone number</label>
            <input
              required
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className="w-full border border-ink/15 rounded-card px-3.5 py-2.5 text-sm bg-white outline-none focus:border-chili"
            />
            <p className="text-xs text-clay mt-1">So we can reach you about orders and payments.</p>
          </div>

          {!googleToken && (
            <>
          <div>
            <label className="block text-xs font-semibold text-ink mb-1.5">Password</label>
            <input
              required={!googleToken}
              type="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="w-full border border-ink/15 rounded-card px-3.5 py-2.5 text-sm bg-white outline-none focus:border-chili"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink mb-1.5">Confirm password</label>
            <input
              required
              type="password"
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              className="w-full border border-ink/15 rounded-card px-3.5 py-2.5 text-sm bg-white outline-none focus:border-chili"
            />
          </div>
            </>
          )}

          {error && <p className="text-xs text-chili-dark font-medium">{error}</p>}

          <button
            disabled={loading}
            className="bg-leaf hover:bg-leaf-dark disabled:opacity-60 transition-colors text-white font-semibold py-3 rounded-card mt-1"
          >
            {loading ? "Setting up..." : "Create restaurant account"}
          </button>

          <p className="text-center text-xs text-clay">
            Already have an account?{" "}
            <Link href="/login" className="text-leaf-dark font-semibold">Log in</Link>
          </p>
        </form>
      </div>
    </main>
  );
}
