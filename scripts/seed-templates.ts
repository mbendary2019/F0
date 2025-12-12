/**
 * Phase 78: Developer Mode Assembly - Template Seeding Script
 * Seeds initial project templates into Firestore
 *
 * Usage:
 * FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 pnpm tsx scripts/seed-templates.ts
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import type { F0Template, TemplateFile } from '../src/types/templates';

// Initialize Firebase Admin
const app = initializeApp({
  projectId: 'from-zero-84253',
});

const db = getFirestore(app);

// Template data
const templates: Omit<F0Template, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    slug: 'cashoutswap-starter',
    name: 'CashoutSwap Starter',
    description: 'Complete crypto exchange starter with wallet integration, swap functionality, and modern UI. Perfect for building DeFi applications.',
    category: 'crypto',
    complexity: 'advanced',
    techStack: ['Next.js 14', 'TypeScript', 'Tailwind CSS', 'Web3.js', 'Ethers.js'],
    visibility: 'public',
    recommendedPlan: 'pro',
    createdBy: 'system',
    tags: ['crypto', 'defi', 'exchange', 'web3', 'blockchain'],
    demoUrl: 'https://cashoutswap.vercel.app',
  },
  {
    slug: 'saas-app-starter',
    name: 'SaaS App Starter',
    description: 'Full-featured SaaS starter with authentication, billing, team management, and admin dashboard. Production-ready from day one.',
    category: 'saas',
    complexity: 'intermediate',
    techStack: ['Next.js 14', 'TypeScript', 'Firebase', 'Stripe', 'Tailwind CSS'],
    visibility: 'public',
    recommendedPlan: 'starter',
    createdBy: 'system',
    tags: ['saas', 'auth', 'billing', 'dashboard', 'teams'],
    demoUrl: 'https://saas-starter.f0.dev',
  },
  {
    slug: 'neon-landing-page',
    name: 'Neon Landing Page',
    description: 'Stunning landing page with neon effects, animations, and modern design. Perfect for showcasing your product or service.',
    category: 'landing',
    complexity: 'beginner',
    techStack: ['Next.js 14', 'TypeScript', 'Tailwind CSS', 'Framer Motion'],
    visibility: 'public',
    recommendedPlan: 'free',
    createdBy: 'system',
    tags: ['landing', 'marketing', 'animation', 'modern', 'responsive'],
    demoUrl: 'https://neon-landing.f0.dev',
  },
];

// Template files for each template
const templateFiles: Record<string, TemplateFile[]> = {
  'cashoutswap-starter': [
    {
      path: 'src/app/page.tsx',
      content: `'use client';

import { useState } from 'react';
import { WalletConnect } from '@/components/WalletConnect';
import { SwapInterface } from '@/components/SwapInterface';

export default function HomePage() {
  const [connected, setConnected] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-black">
      <header className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-white">CashoutSwap</h1>
          <WalletConnect onConnect={() => setConnected(true)} />
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        {connected ? (
          <SwapInterface />
        ) : (
          <div className="text-center text-white">
            <h2 className="text-4xl font-bold mb-4">Connect your wallet to start swapping</h2>
            <p className="text-xl text-gray-300">The fastest way to swap crypto tokens</p>
          </div>
        )}
      </main>
    </div>
  );
}`,
      isBinary: false,
    },
    {
      path: 'src/components/WalletConnect.tsx',
      content: `'use client';

export function WalletConnect({ onConnect }: { onConnect: () => void }) {
  return (
    <button
      onClick={onConnect}
      className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition"
    >
      Connect Wallet
    </button>
  );
}`,
      isBinary: false,
    },
    {
      path: 'package.json',
      content: `{
  "name": "cashoutswap-starter",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "typescript": "^5.4.0"
  }
}`,
      isBinary: false,
    },
  ],
  'saas-app-starter': [
    {
      path: 'src/app/page.tsx',
      content: `'use client';

import { Hero } from '@/components/Hero';
import { Features } from '@/components/Features';
import { Pricing } from '@/components/Pricing';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <Hero />
      <Features />
      <Pricing />
    </div>
  );
}`,
      isBinary: false,
    },
    {
      path: 'src/components/Hero.tsx',
      content: `export function Hero() {
  return (
    <section className="container mx-auto px-4 py-20">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-6">
          Build Your SaaS Product Faster
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Production-ready starter with authentication, billing, and more
        </p>
        <button className="px-8 py-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">
          Get Started
        </button>
      </div>
    </section>
  );
}`,
      isBinary: false,
    },
    {
      path: 'package.json',
      content: `{
  "name": "saas-app-starter",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "typescript": "^5.4.0",
    "firebase": "^10.11.0"
  }
}`,
      isBinary: false,
    },
  ],
  'neon-landing-page': [
    {
      path: 'src/app/page.tsx',
      content: `'use client';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      <div className="relative">
        {/* Neon glow effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 opacity-30 blur-3xl"></div>

        <div className="relative container mx-auto px-4 py-20">
          <h1 className="text-7xl font-bold text-center mb-6 neon-text">
            Welcome to the Future
          </h1>
          <p className="text-2xl text-center text-gray-300 mb-12">
            Experience the next generation of web design
          </p>

          <div className="flex justify-center gap-6">
            <button className="px-8 py-4 bg-gradient-to-r from-pink-500 to-purple-600 rounded-lg hover:shadow-2xl hover:shadow-purple-500/50 transition">
              Get Started
            </button>
            <button className="px-8 py-4 border-2 border-purple-500 rounded-lg hover:bg-purple-500/10 transition">
              Learn More
            </button>
          </div>
        </div>
      </div>

      <style jsx>{\`
        .neon-text {
          text-shadow:
            0 0 10px rgba(255, 255, 255, 0.8),
            0 0 20px rgba(255, 255, 255, 0.6),
            0 0 30px rgba(147, 51, 234, 0.8),
            0 0 40px rgba(147, 51, 234, 0.6),
            0 0 50px rgba(147, 51, 234, 0.4);
        }
      \`}</style>
    </div>
  );
}`,
      isBinary: false,
    },
    {
      path: 'src/app/globals.css',
      content: `@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-black text-white antialiased;
}

@keyframes glow {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.animate-glow {
  animation: glow 2s ease-in-out infinite;
}`,
      isBinary: false,
    },
    {
      path: 'package.json',
      content: `{
  "name": "neon-landing-page",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "typescript": "^5.4.0",
    "framer-motion": "^11.0.0"
  }
}`,
      isBinary: false,
    },
  ],
};

async function seedTemplates() {
  console.log('🌱 Starting template seeding...\n');

  const now = Timestamp.now();

  for (const tmpl of templates) {
    try {
      // Create template document
      const tmplRef = db.collection('templates').doc();

      const templateData: F0Template = {
        id: tmplRef.id,
        ...tmpl,
        createdAt: now.toDate().toISOString(),
        updatedAt: now.toDate().toISOString(),
      };

      // Build data object with only defined values
      const dataToWrite: any = {
        slug: templateData.slug,
        name: templateData.name,
        description: templateData.description,
        category: templateData.category,
        complexity: templateData.complexity,
        techStack: templateData.techStack,
        visibility: templateData.visibility,
        recommendedPlan: templateData.recommendedPlan,
        createdBy: templateData.createdBy,
        createdAt: now,
        updatedAt: now,
        tags: templateData.tags || [],
      };

      // Only add optional fields if they are defined
      if (templateData.demoUrl) {
        dataToWrite.demoUrl = templateData.demoUrl;
      }
      if (templateData.screenshotUrl) {
        dataToWrite.screenshotUrl = templateData.screenshotUrl;
      }

      await tmplRef.set(dataToWrite);

      console.log(`✅ Created template: ${templateData.name} (${tmplRef.id})`);

      // Add template files
      const files = templateFiles[tmpl.slug] || [];

      for (const file of files) {
        await tmplRef.collection('files').add({
          path: file.path,
          content: file.content,
          isBinary: file.isBinary ?? false,
          createdAt: now,
          updatedAt: now,
        });
      }

      console.log(`   📄 Added ${files.length} files to ${templateData.name}\n`);
    } catch (error: any) {
      console.error(`❌ Error seeding template ${tmpl.name}:`, error.message);
    }
  }

  console.log('✅ Template seeding complete!\n');
  console.log('📊 Summary:');
  console.log(`   - Templates created: ${templates.length}`);
  console.log(`   - Total files: ${Object.values(templateFiles).reduce((sum, files) => sum + files.length, 0)}\n`);
}

// Run seeding
seedTemplates()
  .then(() => {
    console.log('🎉 Seeding finished successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Seeding failed:', error);
    process.exit(1);
  });
