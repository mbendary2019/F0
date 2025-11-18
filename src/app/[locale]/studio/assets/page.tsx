import {getTranslations} from 'next-intl/server';
import {AssetsGrid} from '@/components/studio/AssetsGrid';
import {AssetUploader} from '@/components/studio/AssetUploader';
import {AssetFilters} from '@/components/studio/AssetFilters';

export default async function AssetsPage() {
  const t = await getTranslations('studio.assets');

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">{t('title')}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{t('subtitle')}</p>
            </div>
            <AssetUploader />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4">
          <AssetFilters />
        </div>
      </div>

      {/* Assets Grid */}
      <div className="container mx-auto px-6 py-8">
        <AssetsGrid />
      </div>
    </div>
  );
}
