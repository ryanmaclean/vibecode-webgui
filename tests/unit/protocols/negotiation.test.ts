/**
 * Protocol Negotiation Tests
 */

import {
  ProtocolDetector,
  ProtocolNegotiator,
  CapabilityMatcher,
  VersionChecker,
  createProtocolDetector,
  createProtocolNegotiator,
  createCapabilityMatcher,
  createVersionChecker,
} from '@/lib/protocols/negotiation';

describe('Protocol Negotiation', () => {
  describe('ProtocolDetector', () => {
    let detector: ProtocolDetector;

    beforeEach(() => {
      detector = createProtocolDetector(1000);
    });

    it('should create detector with timeout', () => {
      expect(detector).toBeInstanceOf(ProtocolDetector);
    });

    it('should detect best protocol with preference', async () => {
      // Mock successful detection
      detector['probeMCP'] = jest.fn().mockResolvedValue(true);
      detector['probeAgentAPI'] = jest.fn().mockResolvedValue(false);

      const best = await detector.detectBest('localhost:3000', ['mcp', 'agentapi']);

      expect(best).toBe('mcp');
    });

    it('should return unknown when no protocol found', async () => {
      detector['probeMCP'] = jest.fn().mockResolvedValue(false);
      detector['probeAgentAPI'] = jest.fn().mockResolvedValue(false);

      const best = await detector.detectBest('localhost:3000');

      expect(best).toBe('unknown');
    });

    it('should follow preference order', async () => {
      detector['probeMCP'] = jest.fn().mockResolvedValue(true);
      detector['probeAgentAPI'] = jest.fn().mockResolvedValue(true);

      const best = await detector.detectBest('localhost:3000', ['agentapi', 'mcp']);

      expect(best).toBe('agentapi');
    });
  });

  describe('ProtocolNegotiator', () => {
    let negotiator: ProtocolNegotiator;

    beforeEach(() => {
      negotiator = createProtocolNegotiator(1000);
    });

    it('should create negotiator', () => {
      expect(negotiator).toBeInstanceOf(ProtocolNegotiator);
    });

    it('should suggest fallback when primary fails', () => {
      const result = {
        protocol: 'mcp' as const,
        version: {
          protocol: 'mcp' as const,
          version: '2024-11-05',
          compatible: false,
        },
        capabilities: {
          protocol: 'mcp' as const,
          transport: ['websocket'],
          features: [],
        },
        fallbackAvailable: true,
      };

      const fallback = negotiator.suggestFallback(result);
      expect(fallback).toBe('agentapi');
    });

    it('should return null when no fallback available', () => {
      const result = {
        protocol: 'mcp' as const,
        version: {
          protocol: 'mcp' as const,
          version: '2024-11-05',
          compatible: true,
        },
        capabilities: {
          protocol: 'mcp' as const,
          transport: ['websocket'],
          features: [],
        },
        fallbackAvailable: false,
      };

      const fallback = negotiator.suggestFallback(result);
      expect(fallback).toBeNull();
    });
  });

  describe('CapabilityMatcher', () => {
    let matcher: CapabilityMatcher;

    beforeEach(() => {
      matcher = createCapabilityMatcher();
    });

    it('should match compatible capabilities', () => {
      const required = ['tool-invocation', 'resource-access'];
      const available = {
        protocol: 'mcp' as const,
        transport: ['websocket'],
        features: ['tool-invocation', 'resource-access', 'prompts'],
      };

      const result = matcher.match(required, available);

      expect(result.compatible).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('should identify missing capabilities', () => {
      const required = ['tool-invocation', 'sampling-api'];
      const available = {
        protocol: 'mcp' as const,
        transport: ['websocket'],
        features: ['tool-invocation'],
      };

      const result = matcher.match(required, available);

      expect(result.compatible).toBe(false);
      expect(result.missing).toContain('sampling-api');
    });

    it('should find best protocol for requirements', () => {
      const required = ['tool-invocation', 'resource-access'];

      const protocols = [
        {
          protocol: 'agentapi' as const,
          transport: ['http'],
          features: ['agent-lifecycle'],
        },
        {
          protocol: 'mcp' as const,
          transport: ['websocket'],
          features: ['tool-invocation', 'resource-access', 'prompts'],
        },
      ];

      const best = matcher.findBest(required, protocols);

      expect(best?.protocol).toBe('mcp');
    });

    it('should return null when no protocol satisfies requirements', () => {
      const required = ['non-existent-feature'];

      const protocols = [
        {
          protocol: 'mcp' as const,
          transport: ['websocket'],
          features: ['tool-invocation'],
        },
      ];

      const best = matcher.findBest(required, protocols);

      expect(best).toBeNull();
    });
  });

  describe('VersionChecker', () => {
    let checker: VersionChecker;

    beforeEach(() => {
      checker = createVersionChecker();
    });

    it('should check version compatibility', () => {
      expect(checker.isCompatible('1.2.3', '1.5.0')).toBe(true);
      expect(checker.isCompatible('1.2.3', '2.0.0')).toBe(false);
      expect(checker.isCompatible('2.1.0', '2.5.3')).toBe(true);
    });

    it('should compare versions', () => {
      expect(checker.compare('1.2.3', '1.2.3')).toBe(0);
      expect(checker.compare('1.2.4', '1.2.3')).toBe(1);
      expect(checker.compare('1.2.2', '1.2.3')).toBe(-1);
      expect(checker.compare('2.0.0', '1.9.9')).toBe(1);
    });

    it('should find latest compatible version', () => {
      const requested = '1.2.3';
      const available = ['1.0.0', '1.5.0', '2.0.0', '1.8.0'];

      const latest = checker.findLatestCompatible(requested, available);

      expect(latest).toBe('1.8.0');
    });

    it('should return null when no compatible version', () => {
      const requested = '3.0.0';
      const available = ['1.0.0', '2.0.0'];

      const latest = checker.findLatestCompatible(requested, available);

      expect(latest).toBeNull();
    });

    it('should handle versions with different part lengths', () => {
      expect(checker.compare('1.2', '1.2.0')).toBe(0);
      expect(checker.compare('1.2.0.1', '1.2.0')).toBe(1);
    });
  });

  describe('Performance', () => {
    it('should have low negotiation overhead', async () => {
      const detector = createProtocolDetector(100);
      detector['probeMCP'] = jest.fn().mockResolvedValue(true);
      detector['probeAgentAPI'] = jest.fn().mockResolvedValue(false);

      const start = Date.now();
      await detector.detectBest('localhost:3000');
      const duration = Date.now() - start;

      // Negotiation should be <50ms with mocked probes
      expect(duration).toBeLessThan(50);
    });

    it('should handle capability matching efficiently', () => {
      const matcher = createCapabilityMatcher();

      const start = Date.now();

      const required = ['feature1', 'feature2', 'feature3'];
      const protocols = Array(10).fill(null).map((_, i) => ({
        protocol: 'mcp' as const,
        transport: ['websocket'],
        features: [`feature${i}`, 'feature1', 'feature2'],
      }));

      matcher.findBest(required, protocols);

      const duration = Date.now() - start;

      // Capability matching should be <50ms
      expect(duration).toBeLessThan(50);
    });
  });
});
