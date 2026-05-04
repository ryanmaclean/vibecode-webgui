// Mock for next-intl to avoid ESM transform issues in Jest
const useTranslations = () => (key) => key;
const useLocale = () => 'en';
const useMessages = () => ({});
const useNow = () => new Date();
const useTimeZone = () => 'UTC';
const useFormatter = () => ({
  dateTime: () => '',
  number: () => '',
  list: () => '',
  relativeTime: () => '',
});

module.exports = {
  useTranslations,
  useLocale,
  useMessages,
  useNow,
  useTimeZone,
  useFormatter,
  NextIntlClientProvider: ({ children }) => children,
};
