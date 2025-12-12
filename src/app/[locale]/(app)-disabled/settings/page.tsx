// src/app/[locale]/(app)/settings/page.tsx
export default function SettingsPage({ params }: { params: { locale: string } }) {
  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Settings
      </h1>
      <p className="mt-2 text-sm text-slate-400">
        Manage your account preferences, API keys, and notifications.
      </p>

      <div className="mt-6 space-y-4">
        <div className="rounded-2xl border border-white/10 bg-[#050519] p-4">
          <h2 className="text-base font-semibold text-slate-50">Account</h2>
          <p className="mt-2 text-xs text-slate-400">
            View your usage, manage billing, and update your profile.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#050519] p-4">
          <h2 className="text-base font-semibold text-slate-50">API Keys</h2>
          <p className="mt-2 text-xs text-slate-400">
            Generate and manage API keys for programmatic access to F0.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#050519] p-4">
          <h2 className="text-base font-semibold text-slate-50">Notifications</h2>
          <p className="mt-2 text-xs text-slate-400">
            Configure email and in-app notifications for deployments and errors.
          </p>
        </div>
      </div>
    </div>
  );
}
