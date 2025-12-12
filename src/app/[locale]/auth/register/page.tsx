'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebaseClient';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';

export default function RegisterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleRegister(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    const form = e.currentTarget;
    const displayName = (form.elements.namedItem('name') as HTMLInputElement).value;
    const email = (form.elements.namedItem('email') as HTMLInputElement).value;
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName) {
        await updateProfile(cred.user, { displayName });
      }
      // TODO: لو حابب تضيف document في Firestore /users هنا

      // بعد التسجيل أول مرّة → على الـDashboard
      router.push('../f0');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Firebase: ${err?.code || err?.message || 'Failed to create account.'}`);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050816] text-white px-4 login-background">
      <div className="relative w-full max-w-md rounded-3xl bg-[#090d1e]/95 border border-[#272b4e] px-7 py-8 shadow-[0_0_40px_rgba(0,0,0,0.8)]">
        <h1 className="text-2xl font-semibold mb-1">Create your F0 account</h1>
        <p className="text-xs text-gray-400 mb-5">
          One account for dashboard, projects, live coding, and billing.
        </p>

        {errorMsg && (
          <div className="mb-3 rounded-xl border border-red-500/60 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {errorMsg}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleRegister}>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-300">Name</label>
            <input
              type="text"
              name="name"
              className="w-full rounded-xl bg-[#0f1329] border border-[#2c335f] px-3 py-2.5 text-sm outline-none focus:border-[#7b5cff] focus:ring-1 focus:ring-[#7b5cff]"
              placeholder="Your name"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-300">Email</label>
            <input
              type="email"
              name="email"
              required
              className="w-full rounded-xl bg-[#0f1329] border border-[#2c335f] px-3 py-2.5 text-sm outline-none focus:border-[#7b5cff] focus:ring-1 focus:ring-[#7b5cff]"
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-300">Password</label>
            <input
              type="password"
              name="password"
              required
              className="w-full rounded-xl bg-[#0f1329] border border-[#2c335f] px-3 py-2.5 text-sm outline-none focus:border-[#7b5cff] focus:ring-1 focus:ring-[#7b5cff]"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 w-full rounded-xl bg-gradient-to-r from-[#7b5cff] via-[#b15cff] to-[#1ec8ff] py-2.5 text-sm font-medium shadow-[0_12px_30px_rgba(123,92,255,0.55)] hover:brightness-110 transition-all disabled:opacity-60"
          >
            {isLoading ? 'Creating account…' : 'Sign up'}
          </button>
        </form>

        <p className="mt-4 text-[11px] text-center text-gray-400">
          Already have an account?{' '}
          <Link
            href="../auth"
            className="text-[#9f84ff] hover:text-[#c6a8ff] underline-offset-2 hover:underline"
          >
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
