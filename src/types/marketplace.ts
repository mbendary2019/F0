// src/types/marketplace.ts
// Phase 98.1: Marketplace types

export type MarketplaceCategory =
  | 'crypto'
  | 'ecommerce'
  | 'saas'
  | 'logistics'
  | 'ai'
  | 'social'
  | 'fintech'
  | 'healthcare'
  | 'education'
  | 'other';

export type MarketplacePlatform = 'web' | 'mobile' | 'desktop' | 'api';

export type MarketplaceDifficulty = 'beginner' | 'intermediate' | 'pro';

export type MarketplaceStatus = 'coming_soon' | 'live' | 'beta';

export interface MarketplaceApp {
  slug: string;
  title: string;
  titleAr: string;
  shortDescription: string;
  shortDescriptionAr: string;
  heroTagline: string;
  heroTaglineAr: string;
  category: MarketplaceCategory;
  platforms: MarketplacePlatform[];
  techStack: string[];
  estimatedMvpDays: number;
  difficulty: MarketplaceDifficulty;
  status: MarketplaceStatus;
  icon: string; // Emoji or icon name
  featured?: boolean;
  order?: number;
  createdAt?: Date;
  updatedAt?: Date;
  // Phase 98.2: Optional full description for templates
  fullDescription?: string;
  fullDescriptionAr?: string;
}

// Category metadata for display
export const MARKETPLACE_CATEGORIES: Record<
  MarketplaceCategory,
  { label: string; labelAr: string; icon: string }
> = {
  crypto: { label: 'Crypto & Trading', labelAr: 'كريبتو وتداول', icon: '📈' },
  ecommerce: { label: 'E-Commerce', labelAr: 'تجارة إلكترونية', icon: '🛒' },
  saas: { label: 'SaaS', labelAr: 'برمجيات كخدمة', icon: '☁️' },
  logistics: { label: 'Logistics', labelAr: 'لوجستيات', icon: '🚚' },
  ai: { label: 'AI & ML', labelAr: 'ذكاء اصطناعي', icon: '🧠' },
  social: { label: 'Social', labelAr: 'شبكات اجتماعية', icon: '👥' },
  fintech: { label: 'Fintech', labelAr: 'تقنية مالية', icon: '💳' },
  healthcare: { label: 'Healthcare', labelAr: 'رعاية صحية', icon: '🏥' },
  education: { label: 'Education', labelAr: 'تعليم', icon: '📚' },
  other: { label: 'Other', labelAr: 'أخرى', icon: '📦' },
};

// Platform badges
export const PLATFORM_BADGES: Record<
  MarketplacePlatform,
  { label: string; labelAr: string; color: string }
> = {
  web: { label: 'Web', labelAr: 'ويب', color: '#3b82f6' },
  mobile: { label: 'Mobile', labelAr: 'موبايل', color: '#10b981' },
  desktop: { label: 'Desktop', labelAr: 'ديسكتوب', color: '#8b5cf6' },
  api: { label: 'API', labelAr: 'API', color: '#f59e0b' },
};

// Difficulty badges
export const DIFFICULTY_BADGES: Record<
  MarketplaceDifficulty,
  { label: string; labelAr: string; color: string }
> = {
  beginner: { label: 'Beginner', labelAr: 'مبتدئ', color: '#22c55e' },
  intermediate: { label: 'Intermediate', labelAr: 'متوسط', color: '#eab308' },
  pro: { label: 'Pro', labelAr: 'متقدم', color: '#ef4444' },
};
