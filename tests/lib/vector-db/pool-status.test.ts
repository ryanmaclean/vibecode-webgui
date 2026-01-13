/**
 * Tests for Vector Database Pool Status
 */
import { PoolStatus, PoolStatusInfo, isPoolHealthy } from '@/lib/vector-db/pool-status';

describe('vector-db/pool-status', () => {
  describe('PoolStatus enum', () => {
    it('should have INITIALIZING status', () => {
      expect(PoolStatus.INITIALIZING).toBe('initializing');
    });

    it('should have ACTIVE status', () => {
      expect(PoolStatus.ACTIVE).toBe('active');
    });

    it('should have DRAINING status', () => {
      expect(PoolStatus.DRAINING).toBe('draining');
    });

    it('should have CLOSED status', () => {
      expect(PoolStatus.CLOSED).toBe('closed');
    });

    it('should have ERROR status', () => {
      expect(PoolStatus.ERROR).toBe('error');
    });

    it('should have all status values defined', () => {
      const statuses = Object.values(PoolStatus);
      expect(statuses).toHaveLength(5);
      expect(statuses).toContain('initializing');
      expect(statuses).toContain('active');
      expect(statuses).toContain('draining');
      expect(statuses).toContain('closed');
      expect(statuses).toContain('error');
    });
  });

  describe('PoolStatusInfo interface', () => {
    it('should create valid status info object', () => {
      const statusInfo: PoolStatusInfo = {
        status: PoolStatus.ACTIVE,
        activeConnections: 5,
        idleConnections: 3,
        totalConnections: 8,
        errors: 0,
      };

      expect(statusInfo.status).toBe(PoolStatus.ACTIVE);
      expect(statusInfo.activeConnections).toBe(5);
      expect(statusInfo.idleConnections).toBe(3);
      expect(statusInfo.totalConnections).toBe(8);
      expect(statusInfo.errors).toBe(0);
    });

    it('should allow optional lastHealthCheck', () => {
      const statusInfo: PoolStatusInfo = {
        status: PoolStatus.ACTIVE,
        activeConnections: 1,
        idleConnections: 2,
        totalConnections: 3,
        errors: 0,
        lastHealthCheck: new Date(),
      };

      expect(statusInfo.lastHealthCheck).toBeInstanceOf(Date);
    });

    it('should work without lastHealthCheck', () => {
      const statusInfo: PoolStatusInfo = {
        status: PoolStatus.INITIALIZING,
        activeConnections: 0,
        idleConnections: 0,
        totalConnections: 0,
        errors: 0,
      };

      expect(statusInfo.lastHealthCheck).toBeUndefined();
    });
  });

  describe('isPoolHealthy', () => {
    it('should return true for healthy pool', () => {
      const status: PoolStatusInfo = {
        status: PoolStatus.ACTIVE,
        activeConnections: 2,
        idleConnections: 3,
        totalConnections: 5,
        errors: 0,
      };

      expect(isPoolHealthy(status)).toBe(true);
    });

    it('should return false for pool with errors', () => {
      const status: PoolStatusInfo = {
        status: PoolStatus.ACTIVE,
        activeConnections: 2,
        idleConnections: 3,
        totalConnections: 5,
        errors: 1,
      };

      expect(isPoolHealthy(status)).toBe(false);
    });

    it('should return false for non-active pool', () => {
      const status: PoolStatusInfo = {
        status: PoolStatus.INITIALIZING,
        activeConnections: 0,
        idleConnections: 0,
        totalConnections: 0,
        errors: 0,
      };

      expect(isPoolHealthy(status)).toBe(false);
    });

    it('should return false for draining pool', () => {
      const status: PoolStatusInfo = {
        status: PoolStatus.DRAINING,
        activeConnections: 1,
        idleConnections: 2,
        totalConnections: 3,
        errors: 0,
      };

      expect(isPoolHealthy(status)).toBe(false);
    });

    it('should return false for closed pool', () => {
      const status: PoolStatusInfo = {
        status: PoolStatus.CLOSED,
        activeConnections: 0,
        idleConnections: 0,
        totalConnections: 0,
        errors: 0,
      };

      expect(isPoolHealthy(status)).toBe(false);
    });

    it('should return false for error pool', () => {
      const status: PoolStatusInfo = {
        status: PoolStatus.ERROR,
        activeConnections: 0,
        idleConnections: 0,
        totalConnections: 0,
        errors: 5,
      };

      expect(isPoolHealthy(status)).toBe(false);
    });

    it('should return false for active pool with many errors', () => {
      const status: PoolStatusInfo = {
        status: PoolStatus.ACTIVE,
        activeConnections: 2,
        idleConnections: 3,
        totalConnections: 5,
        errors: 10,
      };

      expect(isPoolHealthy(status)).toBe(false);
    });

    it('should handle pool with zero connections', () => {
      const status: PoolStatusInfo = {
        status: PoolStatus.ACTIVE,
        activeConnections: 0,
        idleConnections: 0,
        totalConnections: 0,
        errors: 0,
      };

      expect(isPoolHealthy(status)).toBe(true);
    });

    it('should check both conditions', () => {
      // Active but has errors
      const status1: PoolStatusInfo = {
        status: PoolStatus.ACTIVE,
        activeConnections: 1,
        idleConnections: 1,
        totalConnections: 2,
        errors: 1,
      };
      expect(isPoolHealthy(status1)).toBe(false);

      // No errors but not active
      const status2: PoolStatusInfo = {
        status: PoolStatus.CLOSED,
        activeConnections: 0,
        idleConnections: 0,
        totalConnections: 0,
        errors: 0,
      };
      expect(isPoolHealthy(status2)).toBe(false);

      // Both conditions met
      const status3: PoolStatusInfo = {
        status: PoolStatus.ACTIVE,
        activeConnections: 2,
        idleConnections: 3,
        totalConnections: 5,
        errors: 0,
      };
      expect(isPoolHealthy(status3)).toBe(true);
    });
  });
});
