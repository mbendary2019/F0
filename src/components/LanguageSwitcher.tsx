'use client';
import {usePathname, useRouter} from 'next/navigation';
import {useLocale} from 'next-intl';
import {locales, type Locale} from '@/i18n';

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const switchTo = (next: Locale) => {
    const seg = pathname.split('/');
    if (locales.includes(seg[1] as Locale)) {
      seg[1] = next;
    } else {
      seg.splice(1, 0, next);
    }
    router.push(seg.join('/'));
  };

  return (
    <div className="flex gap-2 items-center">
      <button
        disabled={locale === 'ar'}
        onClick={() => switchTo('ar')}
        className={`px-3 py-1 rounded border text-sm transition-colors ${
          locale === 'ar'
            ? 'bg-blue-600 text-white border-blue-600'
            : 'hover:bg-gray-100 border-gray-300'
        }`}
      >
        العربية
      </button>
      <button
        disabled={locale === 'en'}
        onClick={() => switchTo('en')}
        className={`px-3 py-1 rounded border text-sm transition-colors ${
          locale === 'en'
            ? 'bg-blue-600 text-white border-blue-600'
            : 'hover:bg-gray-100 border-gray-300'
        }`}
      >
        English
      </button>
    </div>
  );
}
