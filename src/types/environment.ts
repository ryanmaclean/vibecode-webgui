/**
 * Environment Indicator Type Definitions for UI
 *
 * Comprehensive type definitions for environment indicators including:
 * - Environment display settings (colors, labels, icons)
 * - UI component props for environment badges and indicators
 * - Environment notification and alert types
 * - Visual indicator configuration
 *
 * @module types/environment
 */

// Re-export core environment types from library
export type {
  EnvironmentType,
  DetectionConfidence,
  DetectionSignalType,
  DetectionSignal,
  EnvironmentDetectionResult,
  EnvironmentDetectorConfig,
  DetectionRule,
  OperationRiskLevel,
  AgentOperationType,
  OperationMetadata,
  EnvironmentContext,
  EnvironmentGuardResult,
  PermissionDecision,
  PermissionAction,
  PermissionRule,
  EnvironmentPermissions,
  PermissionConfig,
  PermissionCheckResult
} from '../lib/environment/types'

// Re-export utility functions
export {
  isProductionEnvironment,
  isDevelopmentEnvironment,
  requiresExtraSafety,
  getEnvironmentColor,
  getEnvironmentLabel
} from '../lib/environment/types'

// ============================================================================
// Environment Display Types
// ============================================================================

/**
 * Visual variant for environment badges
 */
export type EnvironmentBadgeVariant =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline'

/**
 * Display size for environment indicators
 */
export type IndicatorSize = 'xs' | 'sm' | 'md' | 'lg'

/**
 * Position for environment indicator in UI
 */
export type IndicatorPosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'header'
  | 'footer'

/**
 * Environment display configuration
 */
export interface EnvironmentDisplayConfig {
  /** Whether to show environment indicator */
  showIndicator: boolean
  /** Position of indicator in UI */
  position: IndicatorPosition
  /** Size of indicator */
  size: IndicatorSize
  /** Whether to show icon in indicator */
  showIcon: boolean
  /** Whether to show detailed info (confidence, signals) */
  showDetails: boolean
  /** Auto-refresh interval in milliseconds (0 = disabled) */
  refreshInterval: number
  /** Whether to show in compact mode */
  compact: boolean
}

// ============================================================================
// Component Prop Types
// ============================================================================

/**
 * Props for EnvironmentBadge component
 */
export interface EnvironmentBadgeProps {
  /** Whether to show detailed information (confidence, signals) */
  detailed?: boolean
  /** Refresh interval in milliseconds (0 = no auto-refresh) */
  refreshInterval?: number
  /** Custom className for styling */
  className?: string
  /** Show icon in badge */
  showIcon?: boolean
  /** Compact mode (smaller badge) */
  compact?: boolean
  /** Override environment type for testing */
  environmentOverride?: import('../lib/environment/types').EnvironmentType
}

/**
 * Props for EnvironmentIndicator component
 */
export interface EnvironmentIndicatorProps {
  /** Display configuration */
  config?: Partial<EnvironmentDisplayConfig>
  /** Custom className */
  className?: string
  /** Callback when environment changes */
  onEnvironmentChange?: (env: import('../lib/environment/types').EnvironmentType) => void
  /** Whether to show warnings */
  showWarnings?: boolean
}

/**
 * Props for EnvironmentStatusBar component
 */
export interface EnvironmentStatusBarProps {
  /** Whether to show full status bar or minimal indicator */
  minimal?: boolean
  /** Custom className */
  className?: string
  /** Show confidence meter */
  showConfidence?: boolean
  /** Show signal count */
  showSignalCount?: boolean
  /** Interactive mode (clickable for details) */
  interactive?: boolean
}

// ============================================================================
// Environment Alert Types
// ============================================================================

/**
 * Alert severity levels
 */
export type EnvironmentAlertSeverity =
  | 'info'
  | 'warning'
  | 'error'
  | 'critical'

/**
 * Environment alert type
 */
export interface EnvironmentAlert {
  /** Unique alert ID */
  id: string
  /** Alert severity */
  severity: EnvironmentAlertSeverity
  /** Alert title */
  title: string
  /** Alert message */
  message: string
  /** Environment this alert is for */
  environment: import('../lib/environment/types').EnvironmentType
  /** Timestamp when alert was created */
  createdAt: Date
  /** Whether alert has been acknowledged */
  acknowledged: boolean
  /** Optional action to take */
  action?: {
    label: string
    onClick: () => void
  }
}

/**
 * Environment warning configuration
 */
export interface EnvironmentWarningConfig {
  /** Show warnings for low confidence detection */
  showLowConfidenceWarnings: boolean
  /** Show warnings for conflicting signals */
  showConflictWarnings: boolean
  /** Show warnings for unknown environment */
  showUnknownEnvironmentWarnings: boolean
  /** Show production environment warnings */
  showProductionWarnings: boolean
  /** Minimum confidence level before showing warnings */
  minConfidenceThreshold: import('../lib/environment/types').DetectionConfidence
}

// ============================================================================
// Environment Notification Types
// ============================================================================

/**
 * Environment change notification
 */
export interface EnvironmentChangeNotification {
  /** Previous environment */
  from: import('../lib/environment/types').EnvironmentType
  /** New environment */
  to: import('../lib/environment/types').EnvironmentType
  /** Timestamp of change */
  changedAt: Date
  /** Reason for change (if known) */
  reason?: string
  /** Whether change requires user attention */
  requiresAttention: boolean
}

/**
 * Notification preferences for environment changes
 */
export interface EnvironmentNotificationPreferences {
  /** Enable desktop notifications for environment changes */
  enableDesktopNotifications: boolean
  /** Enable in-app notifications */
  enableInAppNotifications: boolean
  /** Only notify for specific environment transitions */
  notifyOnTransitions?: {
    from: import('../lib/environment/types').EnvironmentType[]
    to: import('../lib/environment/types').EnvironmentType[]
  }[]
  /** Enable sound notifications */
  enableSound: boolean
  /** Notification display duration in milliseconds */
  displayDuration: number
}

// ============================================================================
// Environment Color & Icon Types
// ============================================================================

/**
 * Color scheme for environment indicators
 */
export interface EnvironmentColorScheme {
  /** Color for development environment */
  development: string
  /** Color for staging environment */
  staging: string
  /** Color for production environment */
  production: string
  /** Color for test environment */
  test: string
  /** Color for unknown environment */
  unknown: string
}

/**
 * Icon configuration for environments
 */
export interface EnvironmentIconConfig {
  /** Icon name/identifier for development */
  development: string
  /** Icon name/identifier for staging */
  staging: string
  /** Icon name/identifier for production */
  production: string
  /** Icon name/identifier for test */
  test: string
  /** Icon name/identifier for unknown */
  unknown: string
}

// ============================================================================
// Default Configurations
// ============================================================================

/**
 * Default environment display configuration
 */
export const DEFAULT_DISPLAY_CONFIG: EnvironmentDisplayConfig = {
  showIndicator: true,
  position: 'top-right',
  size: 'md',
  showIcon: true,
  showDetails: false,
  refreshInterval: 0, // No auto-refresh by default
  compact: false,
}

/**
 * Default color scheme (Tailwind CSS classes)
 */
export const DEFAULT_COLOR_SCHEME: EnvironmentColorScheme = {
  development: 'green',
  staging: 'yellow',
  production: 'red',
  test: 'green',
  unknown: 'gray',
}

/**
 * Default icon configuration (Lucide icon names)
 */
export const DEFAULT_ICON_CONFIG: EnvironmentIconConfig = {
  development: 'Shield',
  staging: 'AlertCircle',
  production: 'AlertTriangle',
  test: 'Shield',
  unknown: 'Info',
}

/**
 * Default warning configuration
 */
export const DEFAULT_WARNING_CONFIG: EnvironmentWarningConfig = {
  showLowConfidenceWarnings: true,
  showConflictWarnings: true,
  showUnknownEnvironmentWarnings: true,
  showProductionWarnings: true,
  minConfidenceThreshold: 'low',
}

/**
 * Default notification preferences
 */
export const DEFAULT_NOTIFICATION_PREFERENCES: EnvironmentNotificationPreferences = {
  enableDesktopNotifications: false,
  enableInAppNotifications: true,
  notifyOnTransitions: [
    {
      from: ['development', 'staging', 'test'],
      to: ['production'],
    },
  ],
  enableSound: false,
  displayDuration: 5000,
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Environment indicator state
 */
export interface EnvironmentIndicatorState {
  /** Current environment context */
  context: import('../lib/environment/types').EnvironmentContext | null
  /** Loading state */
  loading: boolean
  /** Error state */
  error: string | null
  /** Active alerts */
  alerts: EnvironmentAlert[]
  /** Last update timestamp */
  lastUpdated: Date | null
}

/**
 * Environment transition validator
 */
export interface EnvironmentTransitionValidator {
  /** Validate if transition is safe */
  validate: (
    from: import('../lib/environment/types').EnvironmentType,
    to: import('../lib/environment/types').EnvironmentType
  ) => {
    safe: boolean
    warnings: string[]
    requiresConfirmation: boolean
  }
}

/**
 * Environment display helpers
 */
export interface EnvironmentDisplayHelpers {
  /** Get badge variant for environment */
  getBadgeVariant: (env: import('../lib/environment/types').EnvironmentType) => EnvironmentBadgeVariant
  /** Get CSS color class for environment */
  getCSSColor: (env: import('../lib/environment/types').EnvironmentType) => string
  /** Get icon component for environment */
  getIcon: (env: import('../lib/environment/types').EnvironmentType) => string
  /** Get confidence color */
  getConfidenceColor: (confidence: import('../lib/environment/types').DetectionConfidence) => string
  /** Format environment label */
  formatLabel: (env: import('../lib/environment/types').EnvironmentType) => string
}
