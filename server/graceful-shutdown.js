'use strict';

const DEFAULT_TIMEOUT_MS = 10000;

function destroyTerminalSessions(terminals, logger) {
  if (!terminals || terminals.size === 0) {
    return;
  }

  for (const [terminalId, terminal] of terminals.entries()) {
    try {
      if (typeof terminal.destroy === 'function') {
        terminal.destroy();
      } else if (typeof terminal.kill === 'function') {
        terminal.kill();
      }
    } catch (error) {
      logger?.warn?.('Failed to destroy terminal session', {
        terminalId,
        error: error.message,
      });
    } finally {
      terminals.delete(terminalId);
    }
  }
}

async function closeFileWatchers(fileWatchers, logger) {
  if (!fileWatchers || fileWatchers.size === 0) {
    return;
  }

  const closeOperations = [];
  for (const [watchKey, watcher] of fileWatchers.entries()) {
    const closePromise = Promise.resolve()
      .then(() => watcher.close())
      .catch((error) => {
        logger?.warn?.('Failed to close file watcher', {
          watchKey,
          error: error.message,
        });
      })
      .finally(() => {
        fileWatchers.delete(watchKey);
      });
    closeOperations.push(closePromise);
  }

  await Promise.all(closeOperations);
}

function closeSocketServer(io, logger) {
  if (!io) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    try {
      io.close(() => resolve());
    } catch (error) {
      logger?.error?.('Failed to close Socket.IO server', {
        error: error.message,
      });
      reject(error);
    }
  });
}

function closeHttpServer(server, logger) {
  if (!server) {
    return Promise.resolve();
  }

  if (Object.prototype.hasOwnProperty.call(server, 'listening') && !server.listening) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    try {
      server.close((error) => {
        if (error) {
          logger?.error?.('Failed to close HTTP server', {
            error: error.message,
          });
          reject(error);
          return;
        }
        resolve();
      });
    } catch (error) {
      logger?.error?.('Failed to close HTTP server', {
        error: error.message,
      });
      reject(error);
    }
  });
}

async function closeRedis(redisClient, logger) {
  if (!redisClient) {
    return;
  }

  if (!redisClient.isOpen && !redisClient.isReady) {
    logger?.debug?.('Redis client not connected; skipping shutdown');
    return;
  }

  try {
    await redisClient.quit();
  } catch (error) {
    logger?.warn?.('Failed to close Redis client', {
      error: error.message,
    });
  }
}

function createGracefulShutdown({
  server,
  io,
  redisClient,
  terminals,
  fileWatchers,
  logger,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  let shuttingDown = false;

  async function shutdown(signal = 'SIGTERM', options = {}) {
    const { exit = true, exitCode = 0 } = options;

    if (shuttingDown) {
      logger?.warn?.('Shutdown already in progress', { signal });
      return;
    }
    shuttingDown = true;

    logger?.info?.('Initiating graceful shutdown', {
      signal,
      activeTerminals: terminals?.size ?? 0,
      activeWatchers: fileWatchers?.size ?? 0,
    });

    const timeoutId = setTimeout(() => {
      logger?.error?.('Graceful shutdown timed out; forcing exit', {
        signal,
        timeoutMs,
      });
      if (exit) {
        process.exit(1);
      }
    }, timeoutMs);

    if (typeof timeoutId.unref === 'function') {
      timeoutId.unref();
    }

    try {
      destroyTerminalSessions(terminals, logger);
      await closeFileWatchers(fileWatchers, logger);
      await closeSocketServer(io, logger);
      await Promise.all([
        closeRedis(redisClient, logger),
        closeHttpServer(server, logger),
      ]);

      logger?.info?.('Graceful shutdown complete', { signal });
      if (exit) {
        process.exit(exitCode);
      }
    } catch (error) {
      logger?.error?.('Error during graceful shutdown', {
        signal,
        error: error.message,
        stack: error.stack,
      });
      if (exit) {
        process.exit(1);
      } else {
        throw error;
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return { shutdown };
}

module.exports = {
  DEFAULT_TIMEOUT_MS,
  createGracefulShutdown,
};
