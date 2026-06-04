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
  'ai.models.switcherButton.ariaLabel': 'Switch AI model',
  'ai.models.switcherButton.selectModel': 'Select Model',
  'settings.pageTitle': 'Settings',
  'settings.pageDescription': 'Configure your VibeCode preferences and application settings',
  'settings.title': 'Settings',
  'settings.exportSettings': 'Export Settings',
  'settings.importSettings': 'Import Settings',
  'settings.importSettingsFileLabel': 'Import settings file',
  'settings.resetToDefaults': 'Reset to Defaults',
  'settings.setupWizard': 'Setup Wizard',
  'settings.exportSuccess': 'Settings exported successfully',
  'settings.exportFailed': 'Failed to export settings',
  'settings.importSelectJson': 'Please select a JSON file',
  'settings.importOverwriteConfirm': 'This will overwrite your current settings. Continue?',
  'settings.importInvalidFormat': 'Invalid settings file format',
  'settings.importInvalidSections': 'Settings file does not contain valid settings sections',
  'settings.importParseFailed': 'Failed to parse settings file. Ensure it contains valid JSON.',
  'settings.importSuccess': 'Settings imported successfully',
  'settings.resetConfirm': 'Reset all settings to defaults?',
  'settings.resetSuccess': 'Settings reset to defaults',
  'settings.resetFailed': 'Failed to reset settings',
  'settings.importLabel': 'Import settings file',
  'settings.closeSettingsLabel': 'Close settings',
  'settings.resetAllLabel': 'Reset all settings to defaults',
  'settings.saveSettingsLabel': 'Save settings',
  // AI Dashboard
  'ai.dashboard.title': 'AI Dashboard',
  'ai.dashboard.description': 'Access 340+ AI models, manage agents, track costs, and browse prompt templates -- all from one place.',
  'ai.dashboard.quickActions': 'Quick Actions',
  'ai.dashboard.newChat': 'New Chat',
  'ai.dashboard.compareModels': 'Compare Models',
  'ai.dashboard.browsePrompts': 'Browse Prompts',
  'ai.dashboard.recentActivity': 'Recent Activity',
  'ai.dashboard.cards.chat': 'Chat',
  'ai.dashboard.cards.chatStat': 'Active Conversations: 3',
  'ai.dashboard.cards.chatDescription': 'Start or continue AI conversations',
  'ai.dashboard.cards.agents': 'Agents',
  'ai.dashboard.cards.agentsStat': '6 Agents Available',
  'ai.dashboard.cards.agentsDescription': 'Multi-agent workspace',
  'ai.dashboard.cards.models': 'Models',
  'ai.dashboard.cards.modelsStat': '340+ Models',
  'ai.dashboard.cards.modelsDescription': 'Compare and select AI models',
  'ai.dashboard.cards.costs': 'Costs',
  'ai.dashboard.cards.costsStat': 'Today: $2.47',
  'ai.dashboard.cards.costsDescription': 'Track AI usage costs',
  'ai.dashboard.cards.prompts': 'Prompts',
  'ai.dashboard.cards.promptsStat': '33 Templates',
  'ai.dashboard.cards.promptsDescription': 'Browse prompt library',
  'ai.dashboard.cards.history': 'History',
  'ai.dashboard.cards.historyStat': '142 Conversations',
  'ai.dashboard.cards.historyDescription': 'View past conversations',
  'ai.dashboard.cards.vectorExplorer': 'Vector Explorer',
  'ai.dashboard.cards.vectorExplorerStat': 'Explore Embeddings',
  'ai.dashboard.cards.vectorExplorerDescription': 'Visualize vector similarities',
  'ai.dashboard.usageStats.requestsToday': 'Requests Today',
  'ai.dashboard.usageStats.avgResponseTime': 'Avg Response Time',
  'ai.dashboard.usageStats.topModel': 'Top Model',
  // AI Agents
  'ai.agents.pageTitle': 'AI Agents',
  'ai.agents.agentsList': 'Agents',
  'ai.agents.selectAgent': 'Select an agent',
  'ai.agents.sendButton': 'Send',
  'ai.agents.messagePlaceholder': 'Message {agentName}...',
  'ai.agents.availableAgents': 'Available Agents',
  // AI Models
  'ai.models.pageTitle': 'AI Models',
  'ai.models.pageDescription': 'Browse, compare, and get recommendations for AI models',
  'ai.models.refreshButton': 'Refresh',
  'ai.models.loadingModels': 'Loading models...',
  'ai.models.getRecommendation.title': 'Get Recommendation',
  'ai.models.getRecommendation.taskTypeLabel': 'Task Type',
  'ai.models.getRecommendation.getRecommendationButton': 'Get Recommendation',
  // AI Costs
  'ai.costs.pageTitle': 'AI Costs',
  'ai.costs.pageDescription': 'Monitor spending, set budgets, and estimate costs across AI models',
  'ai.costs.costEstimatorButton': 'Cost Estimator',
  'ai.costs.closeEstimatorButton': 'Close Estimator',
  'ai.costs.quickCostEstimate': 'Quick Cost Estimate',
  'ai.costs.modelLabel': 'Model',
  'ai.costs.sampleMessageLabel': 'Sample Message',
  // AI Prompts
  'ai.prompts.pageTitle': 'Prompt Library',
  'ai.prompts.pageDescription': '{count} reusable prompt templates for AI-powered code assistance across {categories} categories',
  'ai.prompts.searchPlaceholder': 'Search templates by name, description, or tag...',
  'ai.prompts.allTemplates': 'All Templates',
  'ai.prompts.noTemplatesFound': 'No templates found',
  'ai.prompts.categories.codeReview': 'Code Review',
  'ai.prompts.categories.explainCode': 'Explain Code',
  'ai.prompts.categories.refactor': 'Refactor',
  'ai.prompts.categories.generateTests': 'Generate Tests',
  'ai.prompts.categories.documentation': 'Documentation',
  // Common
  'common.clear': 'Clear',
};

const useTranslations = (namespace) => (key, params) => {
  const fullKey = namespace ? `${namespace}.${key}` : key;
  let result = translations[fullKey] ?? translations[key] ?? key;
  // Basic {param} substitution for parameterized translations
  if (params && typeof result === 'string') {
    Object.keys(params).forEach((p) => {
      result = result.replace(new RegExp(`\{${p}\}`, 'g'), String(params[p]));
    });
  }
  return result;
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
