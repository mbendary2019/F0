// src/app/[locale]/(app)/billing/page.tsx
import Link from "next/link";

type BillingPageProps = { params: { locale: string } };

export default function BillingPage({ params }: BillingPageProps) {
  const { locale } = params;

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Billing & Plans
      </h1>
      <p className="mt-2 text-sm text-slate-400">
        Manage your F0 subscription. Stripe integration from Phase 70.1 is used
        to create checkout sessions and confirm payments (Version B).
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {[
          { name: "Free", price: "$0", desc: "1 project • 5 IDE jobs/day • 10k tokens" },
          { name: "Starter", price: "$9", desc: "5 projects • 50 IDE jobs/day • 100k tokens" },
          { name: "Pro", price: "$29", desc: "20 projects • 200 IDE jobs/day • 500k tokens" },
        ].map((plan) => (
          <div
            key={plan.name}
            className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#050519] p-4 text-sm text-slate-200"
          >
            <div>
              <h2 className="text-base font-semibold text-slate-50">
                {plan.name}
              </h2>
              <p className="mt-1 text-xl font-bold text-white">
                {plan.price}
              </p>
              <p className="mt-2 text-xs text-slate-400">{plan.desc}</p>
            </div>

            <button className="mt-4 rounded-full bg-gradient-to-r from-[#7F5CFF] to-[#5CA8FF] px-4 py-2 text-xs font-semibold text-white shadow-[0_0_18px_rgba(127,92,255,0.7)] hover:brightness-110">
              Upgrade with Stripe
            </button>
          </div>
        ))}
      </div>

      <div className="mt-6 text-xs text-slate-500">
        Need to see your usage and invoices?{" "}
        <Link
          href={`/${locale}/settings`}
          className="text-[#9FA7FF] hover:text-[#c5cbff]"
        >
          Go to settings →
        </Link>
      </div>
    </div>
  );
}
