'use client';

// src/app/[locale]/marketplace/page.tsx
// Phase 98.1: Public Marketplace Page

import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebaseClient';
import F0Shell from '@/components/f0/F0Shell';
import { MarketplaceCard } from '@/components/marketplace/MarketplaceCard';
import type {
  MarketplaceApp,
  MarketplaceCategory,
} from '@/types/marketplace';
import { MARKETPLACE_CATEGORIES } from '@/types/marketplace';

export default function MarketplacePage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'en';
  const isArabic = locale === 'ar';

  const [apps, setApps] = useState<MarketplaceApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<MarketplaceCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch marketplace apps
  useEffect(() => {
    async function fetchApps() {
      try {
        console.log('[Marketplace] Fetching apps from Firestore...');
        const ref = collection(db, 'ops_marketplace_apps');
        // Simple query without orderBy to avoid index requirements
        const snapshot = await getDocs(ref);

        console.log('[Marketplace] Snapshot size:', snapshot.size);

        const results: MarketplaceApp[] = [];
        snapshot.forEach((doc) => {
          console.log('[Marketplace] Found doc:', doc.id);
          results.push({ slug: doc.id, ...doc.data() } as MarketplaceApp);
        });

        // Sort client-side by order
        results.sort((a, b) => (a.order || 0) - (b.order || 0));

        console.log('[Marketplace] Total apps loaded:', results.length);
        setApps(results);
      } catch (err) {
        console.error('[Marketplace] Error fetching apps:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchApps();
  }, []);

  // Filter apps by category and search
  const filteredApps = useMemo(() => {
    let result = apps;

    // Category filter
    if (selectedCategory !== 'all') {
      result = result.filter((app) => app.category === selectedCategory);
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (app) =>
          app.title.toLowerCase().includes(q) ||
          app.titleAr.toLowerCase().includes(q) ||
          app.shortDescription.toLowerCase().includes(q) ||
          app.shortDescriptionAr.toLowerCase().includes(q) ||
          app.techStack.some((tech) => tech.toLowerCase().includes(q))
      );
    }

    return result;
  }, [apps, selectedCategory, searchQuery]);

  // Featured apps
  const featuredApps = useMemo(
    () => apps.filter((app) => app.featured),
    [apps]
  );

  // Categories with app counts
  const categoryOptions = useMemo(() => {
    const counts: Record<string, number> = { all: apps.length };
    apps.forEach((app) => {
      counts[app.category] = (counts[app.category] || 0) + 1;
    });

    return [
      { key: 'all' as const, label: isArabic ? 'الكل' : 'All', count: counts.all },
      ...Object.entries(MARKETPLACE_CATEGORIES).map(([key, val]) => ({
        key: key as MarketplaceCategory,
        label: isArabic ? val.labelAr : val.label,
        icon: val.icon,
        count: counts[key] || 0,
      })),
    ].filter((cat) => cat.count > 0);
  }, [apps, isArabic]);

  return (
    <F0Shell>
      <div className={`marketplace-page ${isArabic ? 'rtl' : ''}`}>
        {/* Hero Section */}
        <section className="marketplace-hero">
          <div className="marketplace-hero-content">
            <h1 className="marketplace-hero-title">
              {isArabic ? '🚀 سوق المشاريع' : '🚀 Project Marketplace'}
            </h1>
            <p className="marketplace-hero-subtitle">
              {isArabic
                ? 'اختر فكرتك وخلّي F0 يبنيها لك من الصفر'
                : 'Pick your idea and let F0 build it from scratch'}
            </p>
          </div>
        </section>

        {/* Search and Filters */}
        <section className="marketplace-filters">
          <div className="marketplace-search">
            <input
              type="text"
              placeholder={isArabic ? 'ابحث عن مشروع...' : 'Search projects...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="marketplace-search-input"
            />
          </div>

          <div className="marketplace-categories">
            {categoryOptions.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setSelectedCategory(cat.key)}
                className={`marketplace-category-btn ${
                  selectedCategory === cat.key ? 'active' : ''
                }`}
              >
                {'icon' in cat && <span>{cat.icon}</span>}
                <span>{cat.label}</span>
                <span className="marketplace-category-count">{cat.count}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Loading State */}
        {loading && (
          <div className="marketplace-loading">
            <div className="marketplace-loading-spinner" />
            <p>{isArabic ? 'جاري التحميل...' : 'Loading...'}</p>
          </div>
        )}

        {/* Featured Section */}
        {!loading && selectedCategory === 'all' && !searchQuery && featuredApps.length > 0 && (
          <section className="marketplace-featured">
            <h2 className="marketplace-section-title">
              {isArabic ? '⭐ مشاريع مميزة' : '⭐ Featured Projects'}
            </h2>
            <div className="marketplace-grid featured">
              {featuredApps.map((app) => (
                <MarketplaceCard key={app.slug} app={app} locale={locale} />
              ))}
            </div>
          </section>
        )}

        {/* All Apps Grid */}
        {!loading && (
          <section className="marketplace-all">
            <h2 className="marketplace-section-title">
              {selectedCategory === 'all'
                ? isArabic
                  ? '📦 كل المشاريع'
                  : '📦 All Projects'
                : isArabic
                  ? `${MARKETPLACE_CATEGORIES[selectedCategory as MarketplaceCategory]?.icon} ${MARKETPLACE_CATEGORIES[selectedCategory as MarketplaceCategory]?.labelAr}`
                  : `${MARKETPLACE_CATEGORIES[selectedCategory as MarketplaceCategory]?.icon} ${MARKETPLACE_CATEGORIES[selectedCategory as MarketplaceCategory]?.label}`}
            </h2>

            {filteredApps.length === 0 ? (
              <div className="marketplace-empty">
                <p>
                  {isArabic
                    ? 'لا توجد مشاريع مطابقة للبحث'
                    : 'No projects match your search'}
                </p>
              </div>
            ) : (
              <div className="marketplace-grid">
                {filteredApps
                  .filter((app) => !app.featured || selectedCategory !== 'all' || searchQuery)
                  .map((app) => (
                    <MarketplaceCard key={app.slug} app={app} locale={locale} />
                  ))}
              </div>
            )}
          </section>
        )}

        {/* CTA Section */}
        <section className="marketplace-cta">
          <h2>
            {isArabic
              ? '🎯 عندك فكرة مختلفة؟'
              : '🎯 Have a Different Idea?'}
          </h2>
          <p>
            {isArabic
              ? 'ابدأ مشروع جديد من الصفر مع F0'
              : 'Start a new project from scratch with F0'}
          </p>
          <a href={`/${locale}/f0`} className="marketplace-cta-btn">
            {isArabic ? 'ابدأ مشروع حر →' : 'Start Custom Project →'}
          </a>
        </section>
      </div>
    </F0Shell>
  );
}
