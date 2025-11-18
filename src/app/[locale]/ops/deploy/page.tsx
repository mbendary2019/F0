import {getTranslations} from 'next-intl/server';
import {DeployDashboard} from '@/components/deploy/DeployDashboard';

export default async function DeployPage() {
  const t = await getTranslations('ops.deploy');

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t('title')}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{t('subtitle')}</p>
          </div>
        </div>
      </div>

      {/* Dashboard */}
      <div className="container mx-auto px-6 py-8">
        <DeployDashboard />
      </div>
    </div>
  );
}
