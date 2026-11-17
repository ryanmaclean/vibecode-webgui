import {getRequestConfig} from 'next-intl/server';
import {defaultLocale} from './config';

// Request config for the Tauri static export (next.config.tauri.js).
// The web config in request.ts reads cookies()/headers(), which cannot be used
// when prerendering with output: 'export', so the desktop build uses the default locale.
export default getRequestConfig(async () => ({
  locale: defaultLocale,
  messages: (await import(`../../messages/${defaultLocale}.json`)).default,
}));
