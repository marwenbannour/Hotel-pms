'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Lang } from '@/lib/i18n';
import { LangProvider } from '@/lib/lang-context';

export function Providers({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 15_000, retry: (count, err) => count < 2 && (err as { status?: number })?.status !== 403 },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <LangProvider lang={lang}>{children}</LangProvider>
    </QueryClientProvider>
  );
}
