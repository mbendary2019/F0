'use client';

import {Asset} from '@/types/studio';
import {useTranslations} from 'next-intl';
import {formatDistanceToNow} from 'date-fns';
import {ar, enUS} from 'date-fns/locale';
import {useLocale} from 'next-intl';

interface AssetCardProps {
  asset: Asset;
}

export function AssetCard({asset}: AssetCardProps) {
  const t = useTranslations('studio.assets');
  const locale = useLocale();

  const dateLocale = locale === 'ar' ? ar : enUS;

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'queued':
        return 'bg-yellow-100 text-yellow-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'done':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  };

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'video':
        return (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        );
      case 'audio':
        return (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
        );
      case 'image':
      default:
        return (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
    }
  };

  return (
    <div className="group relative overflow-hidden rounded-lg border border-border bg-card shadow-sm transition-all hover:shadow-md">
      {/* Thumbnail */}
      <div className="aspect-video w-full overflow-hidden bg-muted">
        {asset.thumbnailUrl || asset.storageUrl ? (
          <img
            src={asset.thumbnailUrl || asset.storageUrl}
            alt={asset.fileName}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            {getFileIcon(asset.fileType)}
          </div>
        )}

        {/* Status Badge */}
        {asset.jobStatus && (
          <div className="absolute right-2 top-2">
            <span className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(asset.jobStatus)}`}>
              {t(`status.${asset.jobStatus}`)}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="truncate text-sm font-medium text-foreground" title={asset.fileName}>
          {asset.fileName}
        </h3>

        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span className="uppercase">{asset.fileType}</span>
          <span>{formatFileSize(asset.fileSize)}</span>
        </div>

        {asset.duration && (
          <div className="mt-1 text-xs text-muted-foreground">
            {t('duration')}: {Math.floor(asset.duration)}s
          </div>
        )}

        {asset.width && asset.height && (
          <div className="mt-1 text-xs text-muted-foreground">
            {asset.width} × {asset.height}
          </div>
        )}

        <div className="mt-3 text-xs text-muted-foreground">
          {formatDistanceToNow(asset.createdAt.toDate(), {
            addSuffix: true,
            locale: dateLocale,
          })}
        </div>

        {/* Tags */}
        {asset.tags && asset.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {asset.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                {tag}
              </span>
            ))}
            {asset.tags.length > 3 && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                +{asset.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Actions (shown on hover) */}
      <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
        <div className="flex gap-2">
          <button className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-gray-100">
            {t('actions.view')}
          </button>
          <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90">
            {t('actions.edit')}
          </button>
        </div>
      </div>
    </div>
  );
}
