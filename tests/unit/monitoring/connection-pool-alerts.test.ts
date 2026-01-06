import ConnectionPoolAlertService, {
  AlertSeverity,
  AlertType,
  __loadVectorConnectionPoolModuleForTest,
  __resetVectorConnectionPoolModule,
  __setBrowserEnvironmentForTest,
  __setVectorConnectionPoolModule,
  __forceVectorModuleUnavailableForTest,
} from '../../../src/lib/db/connection-pool-alerts';

type VectorModule = typeof import('../../../src/lib/db/vector-connection-pool');

describe('ConnectionPoolAlertService dynamic module loading', () => {
  const service = ConnectionPoolAlertService.getInstance();

  const resetServiceState = () => {
    (service as unknown as { stopMonitoring: () => void }).stopMonitoring();
    (service as unknown as { activeAlerts: unknown[] }).activeAlerts = [];
    (service as unknown as { alertHistory: unknown[] }).alertHistory = [];
    const lastAlertTimes = (service as unknown as { lastAlertTimes?: Map<string, number> }).lastAlertTimes;
    if (lastAlertTimes) {
      lastAlertTimes.clear();
    }
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
    __forceVectorModuleUnavailableForTest();
    const addAlertSpy = jest.spyOn(service, 'addAlert');

    (service as unknown as { simulateMetricsSweep: () => void }).simulateMetricsSweep();

    expect(addAlertSpy).not.toHaveBeenCalled();
    expect(service.getActiveAlerts()).toHaveLength(0);
  });

  it('emits alerts when monitoring is enabled with simulated metrics', () => {
    __setBrowserEnvironmentForTest(false);
    const addAlertSpy = jest.spyOn(service, 'addAlert');

    // Start monitoring to enable simulateMetricsSweep
    service.startMonitoring();

    // Run multiple sweeps to increase chance of hitting thresholds with random metrics
    for (let i = 0; i < 10; i++) {
      (service as unknown as { simulateMetricsSweep: () => void }).simulateMetricsSweep();
    }

    // Should have emitted at least one alert due to random metrics exceeding thresholds
    expect(addAlertSpy.mock.calls.length).toBeGreaterThan(0);

    // Clean up
    service.stopMonitoring();
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
