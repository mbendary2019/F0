// src/i18n/request.ts
import {getRequestConfig} from 'next-intl/server';

// next-intl will discover this file automatically
export default getRequestConfig(async ({requestLocale}) => {
  // Get the locale from the request
  let locale = await requestLocale;

  // Fallback to 'ar' if locale is undefined
  if (!locale) {
    locale = 'ar';
  }

  return {
    locale,
    // Use relative path for messages (safer with dynamic imports)
    messages: (await import(`../messages/${locale}.json`)).default
  };
});
