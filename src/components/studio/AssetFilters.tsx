'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {AssetFilter} from '@/types/studio';

export function AssetFilters() {
  const t = useTranslations('studio.assets.filters');
  const [filters, setFilters] = useState<AssetFilter>({});
  const [searchQuery, setSearchQuery] = useState('');

  const handleFilterChange = (key: keyof AssetFilter, value: any) => {
    setFilters((prev) => ({...prev, [key]: value}));
  };

  const clearFilters = () => {
    setFilters({});
    setSearchQuery('');
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder={t('search')}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              handleFilterChange('searchQuery', e.target.value);
            }}
            className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Filter Options */}
      <div className="flex flex-wrap gap-4">
        {/* File Type Filter */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-foreground">{t('fileType')}:</label>
          <select
            value={filters.fileType || ''}
            onChange={(e) => handleFilterChange('fileType', e.target.value || undefined)}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">{t('all')}</option>
            <option value="image">{t('image')}</option>
            <option value="video">{t('video')}</option>
            <option value="audio">{t('audio')}</option>
          </select>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-foreground">{t('status')}:</label>
          <select
            value={filters.jobStatus || ''}
            onChange={(e) => handleFilterChange('jobStatus', e.target.value || undefined)}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">{t('all')}</option>
            <option value="queued">{t('queued')}</option>
            <option value="processing">{t('processing')}</option>
            <option value="done">{t('done')}</option>
            <option value="failed">{t('failed')}</option>
          </select>
        </div>

        {/* Date Range */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-foreground">{t('dateFrom')}:</label>
          <input
            type="date"
            onChange={(e) => handleFilterChange('startDate', e.target.value ? new Date(e.target.value) : undefined)}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-foreground">{t('dateTo')}:</label>
          <input
            type="date"
            onChange={(e) => handleFilterChange('endDate', e.target.value ? new Date(e.target.value) : undefined)}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Clear Filters */}
        <button
          onClick={clearFilters}
          className="rounded-lg border border-border bg-background px-4 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
        >
          {t('clear')}
        </button>
      </div>
    </div>
  );
}
