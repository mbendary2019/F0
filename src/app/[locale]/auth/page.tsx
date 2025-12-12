'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, googleProvider, githubProvider } from '@/lib/firebaseClient';
import { signInWithPopup, signInWithEmailAndPassword } from 'firebase/auth';

export default function AuthPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSocialLogin(provider: 'google' | 'github') {
    try {
      setIsLoading(true);
      setErrorMsg(null);
      if (provider === 'google') {
        await signInWithPopup(auth, googleProvider);
      } else {
        await signInWithPopup(auth, githubProvider);
      }

      // 🌟 بعد أي Login ناجح → روح للـDashboard /f0
      router.push('../f0'); // من /en/auth → /en/f0
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Firebase: ${err?.message || 'Failed to sign in.'}`);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleEmailSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    const form = e.currentTarget;
    const email = (form.elements.namedItem('email') as HTMLInputElement).value;
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;

    try {
      await signInWithEmailAndPassword(auth, email, password);

      // 🌟 Email login ناجح → برضه روح للـDashboard
      router.push('../f0');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Firebase: ${err?.code || err?.message || 'Failed to sign in with email.'}`);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="f0-lightning-bg flex items-center justify-center px-6 py-10">
      {/* Main content */}
      <div className="relative z-10 flex flex-col-reverse md:flex-row items-center justify-center gap-20 lg:gap-28 w-full max-w-6xl">
        {/* Login content column (Title + Social + Email card) */}
        <div className="flex flex-col items-center text-center max-w-md w-full space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
              <span className="text-white">Login to </span>
              <span className="text-[#7b5cff]">F0</span>
            </h1>
            <p className="text-sm md:text-base text-gray-300 max-w-sm mx-auto">
              Access your AI-powered workspace, projects, and live coding sessions with one secure login.
            </p>
          </div>

          {/* Error message */}
          {errorMsg && (
            <div className="w-full rounded-xl border border-red-500/60 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {errorMsg}
            </div>
          )}

          {/* Social buttons */}
          <div className="w-full space-y-3">
            <button
              type="button"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 rounded-xl bg-black/20 hover:bg-black/30 backdrop-blur transition-colors h-11 text-sm font-medium border border-white/10 text-white disabled:opacity-60"
              onClick={() => handleSocialLogin('google')}
            >
              <span>{isLoading ? 'Signing in...' : 'Continue with Google'}</span>
              <span className="text-xs opacity-80">G</span>
            </button>

            <button
              type="button"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 rounded-xl bg-black/20 hover:bg-black/30 backdrop-blur transition-colors h-11 text-sm font-medium border border-white/10 text-white disabled:opacity-60"
              onClick={() => handleSocialLogin('github')}
            >
              <span>{isLoading ? 'Signing in...' : 'Continue with GitHub'}</span>
              <span>🐙</span>
            </button>

            {/* OR divider */}
            <div className="text-[11px] uppercase tracking-[0.2em] text-gray-500 pt-1">
              OR
            </div>
          </div>

          {/* Email / password card */}
          <div className="w-full rounded-3xl bg-[#090d1e]/95 border border-[#272b4e] shadow-[0_0_40px_rgba(0,0,0,0.65)] px-6 py-6 md:px-7 md:py-7">
            <h2 className="text-lg font-medium mb-4 text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.8)]">Sign in with email</h2>

            <form className="space-y-4" onSubmit={handleEmailSubmit}>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-300">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  className="w-full rounded-xl bg-[#0f1329] border border-[#2c335f] px-3 py-2.5 text-sm outline-none focus:border-[#7b5cff] focus:ring-1 focus:ring-[#7b5cff] placeholder:text-gray-500"
                  placeholder="you@example.com"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-300">
                  Password
                </label>
                <input
                  type="password"
                  name="password"
                  required
                  className="w-full rounded-xl bg-[#0f1329] border border-[#2c335f] px-3 py-2.5 text-sm outline-none focus:border-[#7b5cff] focus:ring-1 focus:ring-[#7b5cff] placeholder:text-gray-500"
                  placeholder="••••••••"
                />
              </div>

              {/* زرار نيون جريدنت زي القديم */}
              <button
                type="submit"
                disabled={isLoading}
                className="mt-3 w-full rounded-xl bg-gradient-to-r from-[#7b5cff] via-[#b15cff] to-[#1ec8ff] py-2.5 text-sm font-medium shadow-[0_12px_30px_rgba(123,92,255,0.55)] hover:brightness-110 transition-all disabled:opacity-60"
              >
                {isLoading ? 'Signing in…' : 'Sign in'}
              </button>

              <p className="mt-3 text-xs text-center text-gray-400">
                New to F0?{' '}
                <Link
                  href="./auth/register"
                  className="text-[#9f84ff] hover:text-[#c6a8ff] underline-offset-2 hover:underline"
                >
                  Create an account
                </Link>
              </p>

              <p className="mt-1 text-[11px] text-center text-gray-500">
                Prefer classic email screen?{' '}
                <Link
                  href="./email-login"
                  className="text-[#7b5cff] hover:text-[#a48bff] underline-offset-2 hover:underline"
                >
                  Open advanced email login
                </Link>
              </p>
            </form>
          </div>
        </div>

        {/* Mascot */}
        <div className="flex flex-col items-center justify-center translate-y-4 scale-[1.6] lg:-translate-x-10 xl:-translate-x-20">
          <Image
            src="/mascots/f0-mascot-login.gif"
            alt="F0 Mascot"
            width={720}
            height={720}
            className="transition-all duration-700 hover:scale-105 opacity-100 drop-shadow-[0_0_45px_rgba(124,58,237,0.65)]"
          />
        </div>
      </div>
    </main>
  );
}
