// src/app/[locale]/(app)/integrations/page.tsx
import Link from "next/link";

type IntegrationsPageProps = { params: { locale: string } };

export default function IntegrationsPage({ params }: IntegrationsPageProps) {
  const { locale } = params;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Integrations
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-400">
        Connect GitHub, Vercel and GoDaddy so F0 can auto-push your code and
        deploy your projects (Phases 70.2 + 74).
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {/* GitHub */}
        <IntegrationCard
          title="GitHub"
          status="Not connected"
          description="Use device code flow to connect your GitHub account."
          ctaLabel="Connect GitHub"
        />

        {/* Vercel */}
        <IntegrationCard
          title="Vercel"
          status="Ready"
          description="Create Vercel projects linked to your GitHub repos."
          ctaLabel="Open Vercel settings"
        />

        {/* GoDaddy */}
        <IntegrationCard
          title="GoDaddy DNS"
          status="Ready"
          description="Update A records to point your custom domain to Vercel."
          ctaLabel="Manage domains"
        />
      </div>

      <div className="mt-6 text-xs text-slate-500">
        Project-specific integrations are also available from{" "}
        <Link
          href={`/${locale}/projects`}
          className="text-[#9FA7FF] hover:text-[#c5cbff]"
        >
          each project overview →
        </Link>
      </div>
    </div>
  );
}

function IntegrationCard({
  title,
  status,
  description,
  ctaLabel,
}: {
  title: string;
  status: string;
  description: string;
  ctaLabel: string;
}) {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#050519] p-4 text-sm text-slate-200">
      <div>
        <h2 className="text-base font-semibold text-slate-50">{title}</h2>
        <p className="mt-1 text-[11px] text-slate-400">Status: {status}</p>
        <p className="mt-2 text-xs text-slate-400">{description}</p>
      </div>
      <button className="mt-4 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-100 hover:border-[#7F5CFF]/60 hover:bg-[#090921]">
        {ctaLabel}
      </button>
    </div>
  );
}
