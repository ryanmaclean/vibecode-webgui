import ConnectionPoolAlertService, {
  AlertSeverity,
  AlertType,
  __loadVectorConnectionPoolModuleForTest,
  __resetVectorConnectionPoolModule,
  __setBrowserEnvironmentForTest,
  __setVectorConnectionPoolModule,
} from '../../../src/lib/db/connection-pool-alerts';

type VectorModule = typeof import('../../../src/lib/db/vector-connection-pool');

describe('ConnectionPoolAlertService dynamic module loading', () => {
  const service = ConnectionPoolAlertService.getInstance();

  const resetServiceState = () => {
    (service as unknown as { stopMonitoring: () => void }).stopMonitoring();
    (service as unknown as { activeAlerts: Map<string, unknown> }).activeAlerts.clear();
    (service as unknown as { alertHistory: unknown[] }).alertHistory = [];
    (service as unknown as { lastAlertTimes: Map<string, number> }).lastAlertTimes.clear();
    (service as unknown as { lastTimeoutCount: number }).lastTimeoutCount = 0;
  };

  beforeEach(() => {
    resetServiceState();
    __resetVectorConnectionPoolModule();
    __setBrowserEnvironmentForTest(null);
  });

  afterEach(() => {
    resetServiceState();
    __resetVectorConnectionPoolModule();
    __setBrowserEnvironmentForTest(null);
  });

  it('gracefully skips monitoring work when the vector module is unavailable', () => {
    __setBrowserEnvironmentForTest(false);
    const addAlertSpy = jest.spyOn(service, 'addAlert');

    (service as unknown as { checkConnectionPool: () => void }).checkConnectionPool();

    expect(addAlertSpy).not.toHaveBeenCalled();
    expect(service.getActiveAlerts()).toHaveLength(0);
  });

  it('emits alerts when the vector module provides critical metrics', () => {
    __setBrowserEnvironmentForTest(false);
    const getMetrics = jest.fn(() => ({
      poolSize: 10,
      activeConnections: 9,
      availableConnections: 1,
      waitingClients: 3,
      avgAcquireTime: 2500,
      totalTimeouts: 25,
    }));

    const pool = { getMetrics };
    const mockModule: VectorModule = {
      VectorConnectionPoolFactory: {
        getPool: jest.fn(() => pool),
        createPool: jest.fn(() => pool),
      },
    } as unknown as VectorModule;

    __setVectorConnectionPoolModule(mockModule);

    (service as unknown as { checkConnectionPool: () => void }).checkConnectionPool();

    const alerts = service.getActiveAlerts();
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts.some((alert) => alert.type === AlertType.POOL_UTILIZATION && alert.severity === AlertSeverity.CRITICAL)).toBe(
      true,
    );
    expect(getMetrics).toHaveBeenCalled();
  });

  it('returns null from dynamic import loader in browser mode', async () => {
    __resetVectorConnectionPoolModule();
    __setBrowserEnvironmentForTest(true);

    await expect(__loadVectorConnectionPoolModuleForTest()).resolves.toBeNull();
  });

  it('returns cached module when running on the server', async () => {
    const mockModule: VectorModule = {
      VectorConnectionPoolFactory: {
        getPool: jest.fn(),
        createPool: jest.fn(),
      },
    } as unknown as VectorModule;

    __resetVectorConnectionPoolModule();
    __setBrowserEnvironmentForTest(false);
    __setVectorConnectionPoolModule(mockModule);

    await expect(__loadVectorConnectionPoolModuleForTest()).resolves.toBe(mockModule);
  });
});
