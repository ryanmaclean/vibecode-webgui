/**
 * Protocol Negotiation and Capability Discovery
 * @module protocols/negotiation
 */

import type { MCPClient, MCPCapabilities, MCPServerInfo } from './mcp-client';
import type { AgentAPIClient } from './agentapi-client';
import type { AgentCapabilities } from './adapters/base-adapter';

// ============================================================================
// Protocol Types
// ============================================================================

export type ProtocolType = 'mcp' | 'agentapi' | 'unknown';

export interface ProtocolVersion {
  protocol: ProtocolType;
  version: string;
  compatible: boolean;
}

export interface ProtocolCapabilities {
  protocol: ProtocolType;
  mcp?: MCPCapabilities;
  agent?: AgentCapabilities;
  transport: string[];
  features: string[];
}

export interface NegotiationResult {
  protocol: ProtocolType;
  version: ProtocolVersion;
  capabilities: ProtocolCapabilities;
  fallbackAvailable: boolean;
}

// ============================================================================
// Protocol Detector
// ============================================================================

export class ProtocolDetector {
  private timeout: number;

  constructor(timeout: number = 5000) {
    this.timeout = timeout;
  }

  /**
   * Detect available protocols at given URL
   */
  async detect(url: string): Promise<ProtocolType[]> {
    const available: ProtocolType[] = [];

    // Try MCP WebSocket
    if (await this.probeMCP(`ws://${url}/mcp`)) {
      available.push('mcp');
    }

    // Try AgentAPI HTTP
    if (await this.probeAgentAPI(`http://${url}`)) {
      available.push('agentapi');
    }

    return available;
  }

  /**
   * Detect best protocol with preference order
   */
  async detectBest(
    url: string,
    preference: ProtocolType[] = ['mcp', 'agentapi']
  ): Promise<ProtocolType> {
    const available = await this.detect(url);

    for (const preferred of preference) {
      if (available.includes(preferred)) {
        return preferred;
      }
    }

    return 'unknown';
  }

  private async probeMCP(url: string): Promise<boolean> {
    try {
      const ws = new WebSocket(url);

      return await Promise.race([
        new Promise<boolean>((resolve) => {
          ws.onopen = () => {
            ws.close();
            resolve(true);
          };
          ws.onerror = () => resolve(false);
        }),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), this.timeout)),
      ]);
    } catch {
      return false;
    }
  }

  private async probeAgentAPI(url: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${url}/health`, {
        signal: controller.signal,
      });

      clearTimeout(timeout);
      return response.ok;
    } catch {
      return false;
    }
  }
}

// ============================================================================
// Protocol Negotiator
// ============================================================================

export class ProtocolNegotiator {
  private detector: ProtocolDetector;

  constructor(timeout?: number) {
    this.detector = new ProtocolDetector(timeout);
  }

  /**
   * Negotiate protocol with server
   */
  async negotiate(
    url: string,
    requestedVersion?: string,
    preferredProtocol?: ProtocolType[]
  ): Promise<NegotiationResult> {
    // Detect available protocols
    const protocol = await this.detector.detectBest(url, preferredProtocol);

    if (protocol === 'unknown') {
      throw new Error('No compatible protocol found');
    }

    // Version negotiation
    const version = await this.negotiateVersion(url, protocol, requestedVersion);

    // Capability discovery
    const capabilities = await this.discoverCapabilities(url, protocol);

    // Check for fallback options
    const available = await this.detector.detect(url);
    const fallbackAvailable = available.length > 1;

    return {
      protocol,
      version,
      capabilities,
      fallbackAvailable,
    };
  }

  private async negotiateVersion(
    url: string,
    protocol: ProtocolType,
    requestedVersion?: string
  ): Promise<ProtocolVersion> {
    if (protocol === 'mcp') {
      // MCP version negotiation handled during connection
      return {
        protocol: 'mcp',
        version: requestedVersion || '2024-11-05',
        compatible: true,
      };
    }

    if (protocol === 'agentapi') {
      try {
        const response = await fetch(`http://${url}/health`);
        const data = await response.json();
        return {
          protocol: 'agentapi',
          version: data.version || '1.0.0',
          compatible: true,
        };
      } catch {
        return {
          protocol: 'agentapi',
          version: '1.0.0',
          compatible: false,
        };
      }
    }

    return {
      protocol: 'unknown',
      version: '0.0.0',
      compatible: false,
    };
  }

  private async discoverCapabilities(
    url: string,
    protocol: ProtocolType
  ): Promise<ProtocolCapabilities> {
    if (protocol === 'mcp') {
      return {
        protocol: 'mcp',
        transport: ['websocket', 'http', 'stdio'],
        features: [
          'tool-invocation',
          'resource-access',
          'prompt-templates',
          'sampling-api',
          'notifications',
        ],
      };
    }

    if (protocol === 'agentapi') {
      try {
        const response = await fetch(`http://${url}/health`);
        const data = await response.json();

        return {
          protocol: 'agentapi',
          transport: ['http', 'websocket', 'sse'],
          features: [
            'agent-lifecycle',
            'messaging',
            'streaming',
            'terminal-emulation',
          ],
        };
      } catch {
        return {
          protocol: 'agentapi',
          transport: ['http'],
          features: ['agent-lifecycle'],
        };
      }
    }

    return {
      protocol: 'unknown',
      transport: [],
      features: [],
    };
  }

  /**
   * Suggest fallback strategy
   */
  suggestFallback(result: NegotiationResult): ProtocolType | null {
    if (!result.fallbackAvailable) {
      return null;
    }

    // If primary failed, suggest alternative
    if (result.protocol === 'mcp' && !result.version.compatible) {
      return 'agentapi';
    }

    if (result.protocol === 'agentapi' && !result.version.compatible) {
      return 'mcp';
    }

    return null;
  }
}

// ============================================================================
// Capability Matcher
// ============================================================================

export class CapabilityMatcher {
  /**
   * Match required capabilities against available
   */
  match(
    required: string[],
    available: ProtocolCapabilities
  ): { compatible: boolean; missing: string[] } {
    const missing = required.filter(
      (feature) => !available.features.includes(feature)
    );

    return {
      compatible: missing.length === 0,
      missing,
    };
  }

  /**
   * Find best protocol for required capabilities
   */
  findBest(
    required: string[],
    protocols: ProtocolCapabilities[]
  ): ProtocolCapabilities | null {
    // Score each protocol
    const scored = protocols.map((protocol) => {
      const match = this.match(required, protocol);
      const score = required.length - match.missing.length;
      return { protocol, score };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Return best if it satisfies all requirements
    const best = scored[0];
    if (best && best.score === required.length) {
      return best.protocol;
    }

    return null;
  }
}

// ============================================================================
// Version Compatibility
// ============================================================================

export class VersionChecker {
  /**
   * Check if two versions are compatible (same major version)
   */
  isCompatible(version1: string, version2: string): boolean {
    const [major1] = version1.split('.');
    const [major2] = version2.split('.');
    return major1 === major2;
  }

  /**
   * Compare two versions (returns -1, 0, or 1)
   */
  compare(version1: string, version2: string): number {
    const parts1 = version1.split('.').map(Number);
    const parts2 = version2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;

      if (part1 > part2) return 1;
      if (part1 < part2) return -1;
    }

    return 0;
  }

  /**
   * Find latest compatible version
   */
  findLatestCompatible(
    requested: string,
    available: string[]
  ): string | null {
    const compatible = available.filter((version) =>
      this.isCompatible(requested, version)
    );

    if (compatible.length === 0) {
      return null;
    }

    return compatible.sort((a, b) => this.compare(b, a))[0];
  }
}

// ============================================================================
// Exports
// ============================================================================

export function createProtocolDetector(timeout?: number): ProtocolDetector {
  return new ProtocolDetector(timeout);
}

export function createProtocolNegotiator(timeout?: number): ProtocolNegotiator {
  return new ProtocolNegotiator(timeout);
}

export function createCapabilityMatcher(): CapabilityMatcher {
  return new CapabilityMatcher();
}

export function createVersionChecker(): VersionChecker {
  return new VersionChecker();
}
