import ConnectionPoolAlertService, { AlertSeverity, AlertType, AlertConfig, ThresholdConfig } from '@/lib/db/connection-pool-alerts'

describe('ConnectionPoolAlertService', () => {
  let service: ConnectionPoolAlertService

  beforeEach(() => {
    service = ConnectionPoolAlertService.getInstance()
    // Ensure monitoring is off for deterministic tests
    if (service.isMonitoring()) {
      service.stopMonitoring()
    }
    // Clear any active alerts by acknowledging and clearing
    for (const alert of service.getActiveAlerts()) {
      service.acknowledgeAlert(alert.id)
      service.clearAlert(alert.id)
    }
  })

  it('exposes default threshold getters with expected shape', () => {
    const util = service.getPoolUtilizationConfig()
    const acq = service.getAcquireFailuresConfig()
    const val = service.getValidationFailuresConfig()
    const idle = service.getIdleConnectionsConfig()

    const assertThreshold = (t: ThresholdConfig) => {
      expect(typeof t.enabled).toBe('boolean')
      expect(typeof t.warningThreshold).toBe('number')
      expect(typeof t.criticalThreshold).toBe('number')
    }

    assertThreshold(util)
    assertThreshold(acq)
    assertThreshold(val)
    assertThreshold(idle)
  })

  it('updates config via updateConfig()', () => {
    const original = service.getPoolUtilizationConfig()

    const newConfig: AlertConfig = {
      poolUtilization: { enabled: true, warningThreshold: original.warningThreshold + 1, criticalThreshold: original.criticalThreshold + 1 },
      acquireFailures: { enabled: true, warningThreshold: 7, criticalThreshold: 21 },
      validationFailures: { enabled: true, warningThreshold: 3, criticalThreshold: 10 },
      idleConnections: { enabled: true, warningThreshold: 81, criticalThreshold: 91 },
    }

    service.updateConfig(newConfig)

    expect(service.getPoolUtilizationConfig()).toEqual({
      enabled: true,
      warningThreshold: newConfig.poolUtilization.warningThreshold,
      criticalThreshold: newConfig.poolUtilization.criticalThreshold,
    })
    expect(service.getAcquireFailuresConfig()).toEqual({
      enabled: true,
      warningThreshold: 7,
      criticalThreshold: 21,
    })
    expect(service.getValidationFailuresConfig()).toEqual({
      enabled: true,
      warningThreshold: 3,
      criticalThreshold: 10,
    })
    expect(service.getIdleConnectionsConfig()).toEqual({
      enabled: true,
      warningThreshold: 81,
      criticalThreshold: 91,
    })
  })

  it('adds alerts and notifies listeners', () => {
    const received: string[] = []
    const listener = (alert: any) => {
      received.push(alert.id)
    }

    service.addAlertListener(listener)

    service.addAlert({
      severity: AlertSeverity.WARNING,
      type: AlertType.POOL_UTILIZATION,
      message: 'Test Utilization',
      details: { currentUtilization: 75 },
    })

    expect(received.length).toBe(1)
    // active alerts should include the newly added alert
    const active = service.getActiveAlerts()
    expect(active.length).toBeGreaterThanOrEqual(1)

    // Clean up listener
    service.removeAlertListener(listener)
  })

  it('acknowledges and clears alerts', () => {
    // Add an alert
    service.addAlert({
      severity: AlertSeverity.CRITICAL,
      type: AlertType.ACQUIRE_FAILURES,
      message: 'Acquire failures detected',
      details: { recentFailures: 10 },
    })

    const [alert] = service.getActiveAlerts()
    expect(alert).toBeDefined()

    const ack = service.acknowledgeAlert(alert.id)
    expect(ack).toBe(true)

    const cleared = service.clearAlert(alert.id)
    expect(cleared).toBe(true)

    // no longer active
    expect(service.getActiveAlerts().find(a => a.id === alert.id)).toBeUndefined()
  })
})
