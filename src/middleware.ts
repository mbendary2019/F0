// src/middleware.ts
import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  locales: ['ar', 'en'],
  defaultLocale: 'ar',
  localePrefix: 'always'
});

export const config = {
  matcher: [
    // Exclude internal resources and API routes
    '/((?!api|_next|.*\\..*).*)'
  ]
};
