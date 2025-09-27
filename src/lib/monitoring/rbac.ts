/**
 * Role-based Access Control for Monitoring Dashboard
 * Manages user permissions for monitoring features
 */

export type MonitoringRole = 'viewer' | 'operator' | 'admin'

export interface MonitoringPermissions {
  viewMetrics: boolean
  viewAlerts: boolean
  acknowledgeAlerts: boolean
  configureAlerts: boolean
  manageNotifications: boolean
  exportData: boolean
  viewSensitiveDetails: boolean
}

export interface UserContext {
  id: string
  email: string
  roles: string[]
  permissions?: string[]
}

/**
 * Role-based permissions mapping
 */
const ROLE_PERMISSIONS: Record<MonitoringRole, MonitoringPermissions> = {
  viewer: {
    viewMetrics: true,
    viewAlerts: true,
    acknowledgeAlerts: false,
    configureAlerts: false,
    manageNotifications: false,
    exportData: false,
    viewSensitiveDetails: false
  },
  operator: {
    viewMetrics: true,
    viewAlerts: true,
    acknowledgeAlerts: true,
    configureAlerts: false,
    manageNotifications: false,
    exportData: true,
    viewSensitiveDetails: false
  },
  admin: {
    viewMetrics: true,
    viewAlerts: true,
    acknowledgeAlerts: true,
    configureAlerts: true,
    manageNotifications: true,
    exportData: true,
    viewSensitiveDetails: true
  }
}

/**
 * Monitoring RBAC Service
 */
export class MonitoringRBAC {
  private static instance: MonitoringRBAC

  private constructor() {}

  public static getInstance(): MonitoringRBAC {
    if (!MonitoringRBAC.instance) {
      MonitoringRBAC.instance = new MonitoringRBAC()
    }
    return MonitoringRBAC.instance
  }

  /**
   * Determine monitoring role from user context
   */
  public getUserMonitoringRole(user: UserContext): MonitoringRole {
    if (!user.roles || user.roles.length === 0) {
      return 'viewer' // Default role
    }

    // Check for admin privileges
    if (user.roles.includes('admin') || 
        user.roles.includes('super_admin') || 
        user.roles.includes('system_admin')) {
      return 'admin'
    }

    // Check for operator privileges
    if (user.roles.includes('operator') || 
        user.roles.includes('devops') || 
        user.roles.includes('monitor_operator') ||
        user.roles.includes('site_reliability')) {
      return 'operator'
    }

    // Check for specific monitoring permissions
    if (user.permissions) {
      if (user.permissions.includes('monitoring:admin')) {
        return 'admin'
      }
      if (user.permissions.includes('monitoring:operator')) {
        return 'operator'
      }
    }

    return 'viewer'
  }

  /**
   * Get permissions for a user
   */
  public getUserPermissions(user: UserContext): MonitoringPermissions {
    const role = this.getUserMonitoringRole(user)
    return ROLE_PERMISSIONS[role]
  }

  /**
   * Check if user has specific permission
   */
  public hasPermission(user: UserContext, permission: keyof MonitoringPermissions): boolean {
    const permissions = this.getUserPermissions(user)
    return permissions[permission]
  }

  /**
   * Check if user can access monitoring dashboard
   */
  public canAccessDashboard(user: UserContext): boolean {
    return this.hasPermission(user, 'viewMetrics')
  }

  /**
   * Check if user can view specific alert details
   */
  public canViewAlertDetails(user: UserContext, alertSeverity: 'info' | 'warning' | 'critical'): boolean {
    if (!this.hasPermission(user, 'viewAlerts')) {
      return false
    }

    // Sensitive alerts require higher permissions
    if (alertSeverity === 'critical' && !this.hasPermission(user, 'viewSensitiveDetails')) {
      return false
    }

    return true
  }

  /**
   * Get filtered dashboard configuration based on user permissions
   */
  public getFilteredDashboardConfig(user: UserContext) {
    const permissions = this.getUserPermissions(user)
    
    return {
      showMetrics: permissions.viewMetrics,
      showAlerts: permissions.viewAlerts,
      showAlertActions: permissions.acknowledgeAlerts,
      showThresholdConfig: permissions.configureAlerts,
      showNotificationSettings: permissions.manageNotifications,
      showExportOptions: permissions.exportData,
      showSensitiveData: permissions.viewSensitiveDetails,
      canModifySettings: permissions.configureAlerts || permissions.manageNotifications
    }
  }

  /**
   * Validate API access for monitoring endpoints
   */
  public validateAPIAccess(user: UserContext, endpoint: string, method: string): {
    allowed: boolean
    reason?: string
  } {
    const permissions = this.getUserPermissions(user)

    // Metrics endpoints
    if (endpoint.includes('/metrics')) {
      if (!permissions.viewMetrics) {
        return { allowed: false, reason: 'Insufficient permissions to view metrics' }
      }
    }

    // Alert endpoints
    if (endpoint.includes('/alerts')) {
      if (!permissions.viewAlerts) {
        return { allowed: false, reason: 'Insufficient permissions to view alerts' }
      }

      if (method === 'POST' || method === 'PUT') {
        if (!permissions.acknowledgeAlerts && !permissions.configureAlerts) {
          return { allowed: false, reason: 'Insufficient permissions to modify alerts' }
        }
      }
    }

    // Notification endpoints
    if (endpoint.includes('/notifications')) {
      if (!permissions.manageNotifications) {
        return { allowed: false, reason: 'Insufficient permissions to manage notifications' }
      }
    }

    // WebSocket monitoring
    if (endpoint.includes('/ws')) {
      if (!permissions.viewMetrics) {
        return { allowed: false, reason: 'Insufficient permissions for real-time monitoring' }
      }
    }

    return { allowed: true }
  }

  /**
   * Generate audit log entry for access
   */
  public logAccess(user: UserContext, action: string, resource: string, allowed: boolean) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      userId: user.id,
      userEmail: user.email,
      action,
      resource,
      allowed,
      role: this.getUserMonitoringRole(user),
      ip: process.env.NODE_ENV === 'test' ? 'test-ip' : 'unknown' // In real implementation, get from request
    }

    // In production, this would go to a proper audit log
    console.log(`[MONITORING_AUDIT] ${JSON.stringify(logEntry)}`)
  }
}

// Export singleton instance
export const monitoringRBAC = MonitoringRBAC.getInstance()

/**
 * HOC for protecting monitoring components
 */
export function withMonitoringAuth<P extends object>(
  Component: React.ComponentType<P>,
  requiredPermission: keyof MonitoringPermissions
) {
  return function AuthenticatedMonitoringComponent(props: P) {
    const { data: session } = require('next-auth/react').useSession()
    
    if (!session?.user) {
      return (
        <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-800">Please sign in to access monitoring dashboard.</p>
        </div>
      )
    }

    const userContext: UserContext = {
      id: session.user.id || session.user.email || 'unknown',
      email: session.user.email || 'unknown',
      roles: (session.user as any).roles || [],
      permissions: (session.user as any).permissions || []
    }

    const hasPermission = monitoringRBAC.hasPermission(userContext, requiredPermission)

    if (!hasPermission) {
      return (
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">
            Insufficient permissions to access this monitoring feature. 
            Required: {requiredPermission}
          </p>
          <p className="text-sm text-red-600 mt-2">
            Your role: {monitoringRBAC.getUserMonitoringRole(userContext)}
          </p>
        </div>
      )
    }

    // Log successful access
    monitoringRBAC.logAccess(userContext, 'view_component', Component.name, true)

    return <Component {...props} />
  }
}

/**
 * Hook for monitoring permissions
 */
export function useMonitoringPermissions() {
  const { data: session } = require('next-auth/react').useSession()

  if (!session?.user) {
    return {
      permissions: ROLE_PERMISSIONS.viewer,
      role: 'viewer' as MonitoringRole,
      hasPermission: () => false,
      canAccess: () => false
    }
  }

  const userContext: UserContext = {
    id: session.user.id || session.user.email || 'unknown',
    email: session.user.email || 'unknown',
    roles: (session.user as any).roles || [],
    permissions: (session.user as any).permissions || []
  }

  const role = monitoringRBAC.getUserMonitoringRole(userContext)
  const permissions = monitoringRBAC.getUserPermissions(userContext)

  return {
    permissions,
    role,
    hasPermission: (permission: keyof MonitoringPermissions) => 
      monitoringRBAC.hasPermission(userContext, permission),
    canAccess: (endpoint: string, method = 'GET') => 
      monitoringRBAC.validateAPIAccess(userContext, endpoint, method),
    dashboardConfig: monitoringRBAC.getFilteredDashboardConfig(userContext)
  }
}