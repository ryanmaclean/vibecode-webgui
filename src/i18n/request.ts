import {getRequestConfig} from 'next-intl/server';
import {cookies, headers} from 'next/headers';
import {defaultLocale, locales, type Locale} from './config';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const headerStore = await headers();

  let locale: string = cookieStore.get('NEXT_LOCALE')?.value ?? '';

  if (!locales.includes(locale as Locale)) {
    const acceptLang = headerStore.get('accept-language') ?? '';
    const preferred = acceptLang.split(',').map(l => (l.split(';')[0] ?? '').trim().split('-')[0]);
    locale = preferred.find(l => locales.includes(l as Locale)) ?? defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
