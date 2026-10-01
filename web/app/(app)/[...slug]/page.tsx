'use client';

import Link from 'next/link';
import { useI18n } from '@/lib/lang-context';

export default function ComingSoon() {
  const { t } = useI18n();
  return (
    <div className="max-w-md py-16">
      <p className="text-[17px]">{t.comingSoon}</p>
      <Link href="/" className="mt-4 inline-block font-medium text-brass underline underline-offset-4">
        {t.backToDashboard}
      </Link>
    </div>
  );
}
