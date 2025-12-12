'use client';

// src/components/marketplace/MarketplaceCard.tsx
// Phase 98.1: Marketplace app card component

import React from 'react';
import Link from 'next/link';
import type {
  MarketplaceApp,
  MarketplacePlatform,
  MarketplaceDifficulty,
} from '@/types/marketplace';
import {
  PLATFORM_BADGES,
  DIFFICULTY_BADGES,
} from '@/types/marketplace';

interface MarketplaceCardProps {
  app: MarketplaceApp;
  locale: string;
}

export function MarketplaceCard({ app, locale }: MarketplaceCardProps) {
  const isArabic = locale === 'ar';

  const title = isArabic ? app.titleAr : app.title;
  const description = isArabic ? app.shortDescriptionAr : app.shortDescription;
  const tagline = isArabic ? app.heroTaglineAr : app.heroTagline;

  const difficultyBadge = DIFFICULTY_BADGES[app.difficulty];
  const difficultyLabel = isArabic ? difficultyBadge.labelAr : difficultyBadge.label;

  // Status badge
  const statusConfig = {
    live: { label: isArabic ? 'متاح' : 'Live', color: '#22c55e' },
    coming_soon: { label: isArabic ? 'قريباً' : 'Coming Soon', color: '#f59e0b' },
    beta: { label: isArabic ? 'تجريبي' : 'Beta', color: '#8b5cf6' },
  };
  const status = statusConfig[app.status];

  return (
    <div className="marketplace-card">
      {/* Header with icon and status */}
      <div className="marketplace-card-header">
        <span className="marketplace-card-icon">{app.icon}</span>
        <div className="marketplace-card-badges">
          {app.featured && (
            <span className="marketplace-badge featured">
              {isArabic ? '⭐ مميز' : '⭐ Featured'}
            </span>
          )}
          <span
            className="marketplace-badge status"
            style={{ borderColor: status.color, color: status.color }}
          >
            {status.label}
          </span>
        </div>
      </div>

      {/* Title and tagline */}
      <h3 className="marketplace-card-title">{title}</h3>
      <p className="marketplace-card-tagline">{tagline}</p>

      {/* Description */}
      <p className="marketplace-card-description">{description}</p>

      {/* Platform badges */}
      <div className="marketplace-card-platforms">
        {app.platforms.map((platform: MarketplacePlatform) => {
          const badge = PLATFORM_BADGES[platform];
          return (
            <span
              key={platform}
              className="marketplace-platform-badge"
              style={{ borderColor: badge.color, color: badge.color }}
            >
              {isArabic ? badge.labelAr : badge.label}
            </span>
          );
        })}
      </div>

      {/* Footer with difficulty and MVP days */}
      <div className="marketplace-card-footer">
        <span
          className="marketplace-difficulty"
          style={{ color: difficultyBadge.color }}
        >
          {difficultyLabel}
        </span>
        <span className="marketplace-mvp-days">
          {isArabic
            ? `⏱️ ${app.estimatedMvpDays} يوم MVP`
            : `⏱️ ${app.estimatedMvpDays} days MVP`}
        </span>
      </div>

      {/* Tech stack */}
      <div className="marketplace-card-tech">
        {app.techStack.slice(0, 4).map((tech) => (
          <span key={tech} className="marketplace-tech-tag">
            {tech}
          </span>
        ))}
        {app.techStack.length > 4 && (
          <span className="marketplace-tech-tag more">
            +{app.techStack.length - 4}
          </span>
        )}
      </div>

      {/* CTA Button - goes to /projects/new with template param */}
      <Link
        href={`/${locale}/projects/new?template=${app.slug}`}
        className={`marketplace-card-cta ${app.status !== 'live' ? 'disabled' : ''}`}
        aria-disabled={app.status !== 'live'}
        onClick={(e) => {
          if (app.status !== 'live') {
            e.preventDefault();
          }
        }}
      >
        {app.status === 'live'
          ? isArabic
            ? 'ابدأ هذا المشروع →'
            : 'Start This Project →'
          : isArabic
            ? 'قريباً...'
            : 'Coming Soon...'}
      </Link>
    </div>
  );
}

export default MarketplaceCard;
