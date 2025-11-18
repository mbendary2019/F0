// src/app/[locale]/developers/page.tsx
import {redirect} from 'next/navigation';

export default function DevRoot({
  params: {locale}
}: {
  params: {locale: 'ar' | 'en'};
}) {
  redirect(`/${locale}/developers/billing`);
}
