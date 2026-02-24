const { createGracefulShutdown } = require('../graceful-shutdown');

describe('createGracefulShutdown', () => {
  // Mock logger compatible with Pino interface
  // Pino logger methods accept (message, metadata) similar to Winston
  const createLogger = () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  });

  const createWatcher = () => ({
    close: jest.fn().mockResolvedValue(undefined),
  });

  const createTerminal = () => ({
    destroy: jest.fn(),
  });

  const buildOptions = () => ({
    server: {
      listening: true,
      close: jest.fn((cb) => cb()),
    },
    io: {
      close: jest.fn((cb) => cb()),
    },
    redisClient: {
      isOpen: true,
      isReady: true,
      quit: jest.fn().mockResolvedValue(undefined),
    },
    terminals: new Map([
      ['term1', createTerminal()],
    ]),
    fileWatchers: new Map([
      ['watch1', createWatcher()],
    ]),
    logger: createLogger(),
    timeoutMs: 50,
  });

  test('shuts down server resources without exiting process when exit=false', async () => {
    const options = buildOptions();
    const { shutdown } = createGracefulShutdown(options);

    await shutdown('SIGTERM', { exit: false });

    expect(options.terminals.size).toBe(0);
    expect(options.fileWatchers.size).toBe(0);
    expect(options.io.close).toHaveBeenCalledTimes(1);
    expect(options.server.close).toHaveBeenCalledTimes(1);
    expect(options.redisClient.quit).toHaveBeenCalledTimes(1);

    // Verify Pino logger was called
    expect(options.logger.info).toHaveBeenCalledWith(
      'Initiating graceful shutdown',
      expect.objectContaining({
        signal: 'SIGTERM',
        activeTerminals: 1,
        activeWatchers: 1,
      })
    );
    expect(options.logger.info).toHaveBeenCalledWith(
      'Graceful shutdown complete',
      expect.objectContaining({ signal: 'SIGTERM' })
    );
  });

  test('prevents duplicate shutdown work when already in progress', async () => {
    const options = buildOptions();
    const { shutdown } = createGracefulShutdown(options);

    await Promise.all([
      shutdown('SIGTERM', { exit: false }),
      shutdown('SIGTERM', { exit: false }),
    ]);

    expect(options.io.close).toHaveBeenCalledTimes(1);
    expect(options.server.close).toHaveBeenCalledTimes(1);
    expect(options.redisClient.quit).toHaveBeenCalledTimes(1);

    // Verify logger warned about duplicate shutdown
    expect(options.logger.warn).toHaveBeenCalledWith(
      'Shutdown already in progress',
      expect.objectContaining({ signal: 'SIGTERM' })
    );
  });
});
