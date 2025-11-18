// src/app/[locale]/layout.tsx
import '../globals.css';
import {NextIntlClientProvider} from 'next-intl';
import {getMessages} from 'next-intl/server';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import dynamic from 'next/dynamic';

// Import ToastProvider with dynamic() and ssr: false to prevent sonner from being loaded on server
const ToastProvider = dynamic(() => import('@/components/ToastProvider'), { ssr: false });

export function generateStaticParams() {
  return [{locale: 'ar'}, {locale: 'en'}];
}

export default async function LocaleLayout({
  children,
  params: {locale}
}: {
  children: React.ReactNode;
  params: {locale: 'ar' | 'en'};
}) {
  // Read messages from config in src/i18n/request.ts
  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <div lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
        <header className="w-full flex justify-end p-4 border-b">
          <LanguageSwitcher />
        </header>
        {children}
        <ToastProvider />
      </div>
    </NextIntlClientProvider>
  );
}
