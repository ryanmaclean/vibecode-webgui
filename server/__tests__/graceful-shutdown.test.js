const { createGracefulShutdown } = require('../graceful-shutdown');

describe('createGracefulShutdown', () => {
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
  });
});
