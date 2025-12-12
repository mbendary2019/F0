/** @type {import('next').NextConfig} */

const withNextIntl = require('next-intl/plugin')(
  // This is the default (also the `src` folder is supported out of the box)
  './src/i18n/request.ts'
);

// Check if we're in development mode
const isDev = process.env.NODE_ENV !== 'production';

// Phase 30 - Security Hardening: Strict CSP
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https: wss: http://localhost:* ws://localhost:*",
  "media-src 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests"
].join('; ');

const nextConfig = {
  // Disable StrictMode in dev to prevent double rendering issues with Firestore listeners
  reactStrictMode: !isDev,
  swcMinify: true,

  // لا تستخدم HTTPS محليًا - assetPrefix فارغ في dev
  assetPrefix: isDev ? '' : (process.env.NEXT_PUBLIC_ASSET_PREFIX || ''),

  // ESLint: Allow production builds even with ESLint errors
  eslint: {
    ignoreDuringBuilds: true,
  },

  // TypeScript: Allow production builds even with TypeScript errors
  typescript: {
    ignoreBuildErrors: true,
  },

  // i18n redirects for backward compatibility
  async redirects() {
    return [
      {
        source: '/login',
        destination: '/ar/login',
        permanent: false,
      },
      {
        source: '/f0',
        destination: '/ar/f0',
        permanent: false,
      },
      {
        source: '/ops/:path*',
        destination: '/ar/ops/:path*',
        permanent: false,
      },
      {
        source: '/developers/:path*',
        destination: '/ar/developers/:path*',
        permanent: false,
      },
    ];
  },

  // Phase 30: Security Headers (عطّلها في dev للتطوير السلس)
  async headers() {
    // لا security headers في dev mode
    if (isDev) return [];

    // Security headers للإنتاج فقط
    return [
      {
        source: '/:path*',
        headers: [
          // Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: csp
          },
          // Prevent clickjacking
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          // Prevent MIME type sniffing
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          // Referrer Policy
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          // Permissions Policy (formerly Feature-Policy)
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
          },
          // Strict Transport Security (HSTS)
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload'
          },
          // XSS Protection (legacy, but good to have)
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          }
        ]
      }
    ];
  },

  // Environment variables exposed to the browser
  env: {
    NEXT_PUBLIC_APP_NAME: 'F0 Agent',
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version || '1.0.0',
  },

  // Webpack config
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
};

module.exports = withNextIntl(nextConfig);
