// Mock for next-intl to avoid ESM transform issues in Jest
// Translation values sourced from messages/en.json
const translations = {
  'common.appName': 'VibeCode',
  'common.appFullName': 'VibeCode WebGUI',
  'navigation.dashboard': 'Dashboard',
  'navigation.vm': 'VM',
  'navigation.vmDashboard': 'Dashboard',
  'navigation.vmSnapshots': 'Snapshots',
  'navigation.ai': 'AI',
  'navigation.aiChat': 'Chat',
  'navigation.aiModels': 'Models',
  'navigation.aiCosts': 'Costs',
  'navigation.aiPrompts': 'Prompts',
  'navigation.health': 'Health',
  'navigation.monitoring': 'Monitoring',
  'navigation.workspaces': 'Workspaces',
  'navigation.experiments': 'Experiments',
  'navigation.tutorials': 'Tutorials',
  'navigation.settings': 'Settings',
  'navigation.signOut': 'Sign Out',
  'navigation.openMenu': 'Open menu',
  'navigation.closeMenu': 'Close menu',
  'navigation.showKeyboardShortcuts': 'Show keyboard shortcuts',
  'navigation.keyboardShortcutsHint': 'Keyboard shortcuts (⌘/)',
  'navigation.ariaLabel.vmMenu': 'VM menu',
  'navigation.ariaLabel.aiMenu': 'AI menu',
};

const useTranslations = (namespace) => (key, ...args) => {
  const fullKey = namespace ? `${namespace}.${key}` : key;
  return translations[fullKey] ?? translations[key] ?? key;
};

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
