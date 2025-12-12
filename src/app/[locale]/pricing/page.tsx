'use client';

import { useParams } from "next/navigation";

// Stripe Checkout URL - مؤقتًا كل الباقات تروح على Pro
const CHECKOUT_PRO_URL = 'https://checkout.stripe.com/c/pay/cs_test_a1mjYjGsNkzaq8LUED1UyUQCewV1cvIbtNCGrdK5wIockqtlopH4CPcKp8#fidnandhYHdWcXxpYCc%2FJ2FgY2RwaXEnKSdkdWxOYHwnPyd1blpxYHZxWjA0VkBRd3JJXEtDSG1dYFFgUnxkNGkxcml9Szw1SGJ8TlJfMURBYG92U2RWTkNgS0Jybn98U0w8amB0fF1%2FUDAwb1RfPG0zVnB8fVR2SXxCUUNybjRQdVxHNTVOYUwxaks3MycpJ2N3amhWYHdzYHcnP3F3cGApJ2dkZm5id2pwa2FGamlqdyc%2FJyZjY2NjY2MnKSdpZHxqcHFRfHVgJz8ndmxrYmlgWmxxYGgnKSdga2RnaWBVaWRmYG1qaWFgd3YnP3F3cGB4JSUl';

const plans = [
  {
    id: "starter",
    name: "Starter",
    price: "$0",
    period: "Free forever",
    features: [
      "1 project",
      "Basic AI agent",
      "Community support",
      "Arabic & English UI",
    ],
    highlight: false,
    label: null,
  },
  {
    id: "pro",
    name: "Pro",
    label: "MOST POPULAR",
    price: "$29",
    period: "per month",
    features: [
      "Unlimited projects",
      "Advanced AI agent",
      "Priority support",
      "GitHub integration",
      "Live coding sessions",
    ],
    highlight: true,
  },
  {
    id: "ultimate",
    name: "Ultimate",
    price: "$99",
    period: "per month",
    features: [
      "Everything in Pro",
      "Team collaboration",
      "Custom integrations",
      "Dedicated support",
      "Advanced analytics",
    ],
    highlight: false,
    label: null,
  },
];

export default function PricingPage() {
  const params = useParams();
  const locale = params?.locale as string || 'en';

  return (
    <main className="min-h-screen f0-neon-shell flex items-center justify-center px-6 py-12">
      <div className="relative z-10 max-w-6xl w-full text-center text-white">

        <h1 className="text-4xl md:text-5xl font-bold mb-4 drop-shadow-lg">
          Choose the perfect plan
        </h1>

        <p className="text-lg md:text-xl mb-12 text-slate-200/80">
          Pick a plan that fits your workflow and scale with F0.
        </p>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`bg-slate-900/60 backdrop-blur-lg rounded-2xl p-8 shadow-xl border ${
                plan.highlight
                  ? "border-2 border-purple-400/60 hover:border-purple-400/80 transform hover:scale-105"
                  : "border-white/10 hover:border-white/20"
              } transition-all`}
            >
              {plan.label && (
                <div className="inline-block bg-purple-500/20 text-purple-300 text-xs font-bold px-3 py-1 rounded-full mb-4">
                  {plan.label}
                </div>
              )}

              <h2 className="text-2xl font-semibold mb-3 text-slate-100">
                {plan.name}
              </h2>
              <p className="text-5xl font-bold mb-2">{plan.price}</p>
              <p className="text-sm mb-6 text-slate-300">{plan.period}</p>

              <ul className="text-left text-sm text-slate-300 mb-8 space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature}>✓ {feature}</li>
                ))}
              </ul>

              {/* CTA → يروح Stripe Checkout مباشرة */}
              <a
                href={CHECKOUT_PRO_URL}
                className={`block w-full text-center py-3 rounded-xl shadow-lg font-semibold transition-all ${
                  plan.highlight
                    ? "bg-gradient-to-r from-purple-500 via-pink-500 to-purple-600 hover:from-purple-400 hover:via-pink-400 hover:to-purple-500"
                    : plan.id === "starter"
                    ? "bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600"
                    : "bg-gradient-to-r from-blue-500 to-sky-500 hover:from-blue-400 hover:to-sky-400"
                }`}
              >
                {plan.id === "starter" ? "Get Started" : "Subscribe"}
              </a>
            </div>
          ))}
        </div>

        <p className="text-sm text-slate-400">
          * No credit card required for Starter • Cancel anytime • Arabic & English support
        </p>
      </div>
    </main>
  );
}
