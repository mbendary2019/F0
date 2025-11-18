// src/app/[locale]/ops/page.tsx
import {redirect} from 'next/navigation';

export default function OpsRoot({
  params: {locale}
}: {
  params: {locale: 'ar' | 'en'};
}) {
  redirect(`/${locale}/ops/analytics`);
}
