"use client";
import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebaseClient"; // ✅ Changed to firebaseClient
import Link from "next/link";

export default function Login() {
  const [email, setEmail] = useState("m.bendary2019@gmail.com");
  const [pass, setPass] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) {
      setMsg("Firebase auth not initialized");
      return;
    }

    setLoading(true);
    setMsg("Signing in…");

    try {
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      await cred.user.getIdToken(true); // refresh claims
      setMsg("✓ Signed in successfully! Redirecting...");

      // Redirect after short delay
      setTimeout(() => {
        window.location.href = "/f0";
      }, 1000);
    } catch (e: any) {
      setLoading(false);
      setMsg(`✗ ${e?.message || "Login failed"}`);
    }
  };

  return (
    <main className="min-h-dvh flex items-center justify-center p-8">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold">Login</h1>
          <p className="text-muted-foreground">Sign in to access admin features</p>
        </div>

        <form onSubmit={login} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2"
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2"
              disabled={loading}
              required
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        {msg && (
          <div
            className={`rounded-lg border p-3 text-sm ${
              msg.startsWith("✓")
                ? "bg-green-50 text-green-800 border-green-200"
                : msg.startsWith("✗")
                ? "bg-red-50 text-red-800 border-red-200"
                : "bg-blue-50 text-blue-800 border-blue-200"
            }`}
          >
            {msg}
          </div>
        )}

        <div className="pt-4 border-t">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
