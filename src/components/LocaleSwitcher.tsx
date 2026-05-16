'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { locales, type Locale } from '@/i18n/config';

const localeLabels: Record<Locale, string> = {
  en: 'English',
  fr: 'Français',
  ja: '日本語',
  de: 'Deutsch',
  es: 'Español',
};

export function LocaleSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const t = useTranslations('common');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function onChange(newLocale: string) {
    await fetch('/api/locale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: newLocale }),
    });

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <select
      value={locale}
      onChange={(e) => onChange(e.target.value)}
      disabled={isPending}
      className={className}
      aria-label={t('switchLanguage')}
    >
      {locales.map((loc) => (
        <option key={loc} value={loc}>
          {localeLabels[loc]}
        </option>
      ))}
    </select>
  );
}
