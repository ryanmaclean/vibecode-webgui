// Operation Interceptor - Detects and classifies destructive operations
// Provides interception, risk assessment, and pattern matching for agent actions

import { EventEmitter } from 'events';
import type { ActionType } from '../../../types/agent-confirmation';
import type { ToolCall } from '../core';

// Event types
export enum InterceptorEvent {
  OperationDetected = 'operation_detected',
  HighRiskOperation = 'high_risk_operation',
  MediumRiskOperation = 'medium_risk_operation',
  LowRiskOperation = 'low_risk_operation',
}

/**
 * Risk level for operations
 */
export type RiskLevel = 'low' | 'medium' | 'high';

/**
 * Detected operation with metadata
 */
export interface DetectedOperation {
  /** Unique identifier for this detection */
  detection_id: string;

  /** Type of action detected */
  action_type: ActionType;

  /** Tool name that triggered this operation */
  tool_name: string;

  /** Risk level assessment */
  risk_level: RiskLevel;

  /** File path affected (if applicable) */
  file_path?: string;

  /** Additional metadata about the operation */
  metadata: Record<string, unknown>;

  /** When this operation was detected (ISO 8601) */
  detected_at: string;

  /** Reason for the risk assessment */
  risk_reason: string;

  /** Whether this operation requires confirmation */
  requires_confirmation: boolean;
}

/**
 * Event emitted when operation is detected
 */
export interface OperationDetectedEvent {
  /** Event type identifier */
  type: 'operation_detected';

  /** The detected operation */
  operation: DetectedOperation;

  /** Timestamp when event was emitted (ISO 8601) */
  timestamp: string;
}

/**
 * Pattern for matching critical file paths
 */
export interface CriticalPathPattern {
  /** Regular expression pattern to match file paths */
  pattern: RegExp;

  /** Description of why this path is critical */
  reason: string;

  /** Risk level override for matching paths */
  risk_level?: RiskLevel;
}

/**
 * Configuration options for OperationInterceptor
 */
export interface OperationInterceptorOptions {
  /** Critical file path patterns */
  criticalPaths?: CriticalPathPattern[];

  /** Whether to intercept file deletions */
  interceptFileDeletion?: boolean;

  /** Whether to intercept file writes */
  interceptFileWrite?: boolean;

  /** Whether to intercept file edits */
  interceptFileEdit?: boolean;

  /** Whether to intercept command execution */
  interceptCommandExecution?: boolean;

  /** Whether to intercept database changes */
  interceptDatabaseChanges?: boolean;

  /** Whether to intercept deployments */
  interceptDeployments?: boolean;

  /** Custom operation patterns to detect */
  customPatterns?: OperationPattern[];

  /** Default risk level for unknown operations */
  defaultRiskLevel?: RiskLevel;
}

/**
 * Custom operation pattern for detection
 */
export interface OperationPattern {
  /** Name of the tool to match */
  toolName: string | RegExp;

  /** Action type for this pattern */
  actionType: ActionType;

  /** Risk level for this pattern */
  riskLevel: RiskLevel;

  /** Reason for risk assessment */
  reason: string;

  /** Additional conditions to check */
  condition?: (params: Record<string, any>) => boolean;
}

/**
 * Default critical path patterns
 */
const DEFAULT_CRITICAL_PATHS: CriticalPathPattern[] = [
  {
    pattern: /^\.env(\.|$)/i,
    reason: 'Environment configuration files contain sensitive credentials',
    risk_level: 'high',
  },
  {
    pattern: /^package\.json$/i,
    reason: 'Package configuration affects project dependencies',
    risk_level: 'high',
  },
  {
    pattern: /^prisma\/schema\.prisma$/i,
    reason: 'Database schema changes are critical and irreversible',
    risk_level: 'high',
  },
  {
    pattern: /^prisma\/migrations\//i,
    reason: 'Database migration files are critical for schema versioning',
    risk_level: 'high',
  },
  {
    pattern: /^\.github\/workflows\//i,
    reason: 'CI/CD workflow changes affect deployment pipeline',
    risk_level: 'high',
  },
  {
    pattern: /^(src|lib)\/.*\.test\.(ts|tsx|js|jsx)$/i,
    reason: 'Test files ensure code quality',
    risk_level: 'medium',
  },
  {
    pattern: /^(docker|Docker)/i,
    reason: 'Docker configuration affects container deployment',
    risk_level: 'high',
  },
  {
    pattern: /^\.git\//i,
    reason: 'Git internal files should not be modified directly',
    risk_level: 'high',
  },
  {
    pattern: /^(next|tsconfig|tailwind)\.config\.(ts|js)$/i,
    reason: 'Framework configuration files affect build and runtime behavior',
    risk_level: 'medium',
  },
];

/**
 * Default operation patterns for detection
 */
const DEFAULT_OPERATION_PATTERNS: OperationPattern[] = [
  {
    toolName: /delete|remove|rm/i,
    actionType: 'file_delete',
    riskLevel: 'high',
    reason: 'File deletion is irreversible without backups',
  },
  {
    toolName: /write|create/i,
    actionType: 'file_write',
    riskLevel: 'medium',
    reason: 'File creation may overwrite existing files',
  },
  {
    toolName: /edit|modify|update/i,
    actionType: 'file_edit',
    riskLevel: 'medium',
    reason: 'File modification changes existing code',
  },
  {
    toolName: /execute|exec|run|command|shell|bash/i,
    actionType: 'command_execute',
    riskLevel: 'high',
    reason: 'Command execution can affect system state',
    condition: (params) => {
      // Check for destructive commands
      const command = params.command || params.cmd || params.script || '';
      const destructiveCommands = ['rm', 'delete', 'drop', 'truncate', 'kill', 'sudo'];
      return destructiveCommands.some(cmd =>
        String(command).toLowerCase().includes(cmd)
      );
    },
  },
  {
    toolName: /database|db|prisma|sql/i,
    actionType: 'command_execute',
    riskLevel: 'high',
    reason: 'Database operations can cause data loss',
  },
  {
    toolName: /deploy|publish|release/i,
    actionType: 'command_execute',
    riskLevel: 'high',
    reason: 'Deployment affects production systems',
  },
];

/**
 * Operation Interceptor for detecting destructive operations
 *
 * Analyzes tool calls to detect potentially destructive operations,
 * assesses risk levels, and emits events for confirmation workflow.
 */
export class OperationInterceptor extends EventEmitter {
  private criticalPaths: CriticalPathPattern[];
  private operationPatterns: OperationPattern[];
  private interceptFileDeletion: boolean;
  private interceptFileWrite: boolean;
  private interceptFileEdit: boolean;
  private interceptCommandExecution: boolean;
  private interceptDatabaseChanges: boolean;
  private interceptDeployments: boolean;
  private defaultRiskLevel: RiskLevel;
  private detectionCount: number;

  constructor(options: OperationInterceptorOptions = {}) {
    super();

    this.criticalPaths = options.criticalPaths ?? DEFAULT_CRITICAL_PATHS;
    this.operationPatterns = [
      ...DEFAULT_OPERATION_PATTERNS,
      ...(options.customPatterns ?? []),
    ];

    this.interceptFileDeletion = options.interceptFileDeletion ?? true;
    this.interceptFileWrite = options.interceptFileWrite ?? true;
    this.interceptFileEdit = options.interceptFileEdit ?? true;
    this.interceptCommandExecution = options.interceptCommandExecution ?? true;
    this.interceptDatabaseChanges = options.interceptDatabaseChanges ?? true;
    this.interceptDeployments = options.interceptDeployments ?? true;
    this.defaultRiskLevel = options.defaultRiskLevel ?? 'medium';
    this.detectionCount = 0;
  }

  /**
   * Analyze a tool call to detect destructive operations
   *
   * Checks tool name, parameters, and affected files to determine
   * if the operation is destructive and assess its risk level.
   *
   * @param toolCall - The tool call to analyze
   * @param params - Parsed parameters for the tool call
   * @returns Detected operation if destructive, null otherwise
   */
  analyzeToolCall(
    toolCall: ToolCall,
    params: Record<string, any>
  ): DetectedOperation | null {
    const toolName = toolCall.function.name;

    // Find matching operation pattern
    const matchingPattern = this.operationPatterns.find(pattern => {
      const nameMatches = pattern.toolName instanceof RegExp
        ? pattern.toolName.test(toolName)
        : pattern.toolName === toolName;

      if (!nameMatches) {
        return false;
      }

      // Check additional conditions if specified
      if (pattern.condition) {
        return pattern.condition(params);
      }

      return true;
    });

    if (!matchingPattern) {
      return null;
    }

    // Check if this action type should be intercepted
    if (!this.shouldInterceptAction(matchingPattern.actionType)) {
      return null;
    }

    // Extract file path from parameters
    const filePath = this.extractFilePath(params);

    // Assess risk level
    const riskAssessment = this.assessRisk(
      matchingPattern.actionType,
      filePath,
      params,
      matchingPattern.riskLevel
    );

    // Create detected operation
    const detection: DetectedOperation = {
      detection_id: this.generateDetectionId(),
      action_type: matchingPattern.actionType,
      tool_name: toolName,
      risk_level: riskAssessment.level,
      file_path: filePath,
      metadata: {
        ...params,
        tool_call_id: toolCall.id,
        pattern_matched: matchingPattern.toolName,
      },
      detected_at: new Date().toISOString(),
      risk_reason: riskAssessment.reason,
      requires_confirmation: true,
    };

    // Emit event
    this.emitDetectionEvent(detection);

    return detection;
  }

  /**
   * Check if an action type should be intercepted
   *
   * @param actionType - The action type to check
   * @returns true if action should be intercepted
   */
  private shouldInterceptAction(actionType: ActionType): boolean {
    switch (actionType) {
      case 'file_delete':
        return this.interceptFileDeletion;
      case 'file_write':
        return this.interceptFileWrite;
      case 'file_edit':
        return this.interceptFileEdit;
      case 'command_execute':
        return this.interceptCommandExecution;
      default:
        return true;
    }
  }

  /**
   * Extract file path from tool parameters
   *
   * @param params - Tool parameters
   * @returns Extracted file path or undefined
   */
  private extractFilePath(params: Record<string, any>): string | undefined {
    // Common parameter names for file paths
    const pathParams = ['file_path', 'path', 'file', 'filename', 'filepath'];

    for (const param of pathParams) {
      if (params[param] && typeof params[param] === 'string') {
        return params[param];
      }
    }

    return undefined;
  }

  /**
   * Assess risk level for an operation
   *
   * @param actionType - Type of action
   * @param filePath - File path affected (if any)
   * @param params - Tool parameters
   * @param baseRiskLevel - Base risk level from pattern
   * @returns Risk assessment with level and reason
   */
  private assessRisk(
    actionType: ActionType,
    filePath: string | undefined,
    params: Record<string, any>,
    baseRiskLevel: RiskLevel
  ): { level: RiskLevel; reason: string } {
    // Check if file path matches critical patterns
    if (filePath) {
      for (const criticalPath of this.criticalPaths) {
        if (criticalPath.pattern.test(filePath)) {
          return {
            level: criticalPath.risk_level ?? 'high',
            reason: criticalPath.reason,
          };
        }
      }
    }

    // Check for specific high-risk indicators
    if (actionType === 'file_delete') {
      return {
        level: 'high',
        reason: 'File deletion is irreversible and may cause data loss',
      };
    }

    if (actionType === 'command_execute') {
      const command = String(params.command || params.cmd || params.script || '').toLowerCase();

      // Check for database operations
      if (command.includes('prisma') || command.includes('migrate')) {
        return {
          level: 'high',
          reason: 'Database operations can cause irreversible data changes',
        };
      }

      // Check for deployment commands
      if (command.includes('deploy') || command.includes('publish')) {
        return {
          level: 'high',
          reason: 'Deployment commands affect production systems',
        };
      }

      // Check for destructive shell commands
      const destructive = ['rm -rf', 'truncate', 'drop', 'kill -9'];
      if (destructive.some(d => command.includes(d))) {
        return {
          level: 'high',
          reason: 'Destructive command detected that may cause data loss',
        };
      }
    }

    // Return base risk level
    const reasons: Record<ActionType, string> = {
      file_write: 'File write may overwrite existing content',
      file_edit: 'File edit modifies existing code',
      file_delete: 'File deletion is irreversible',
      code_replace: 'Code replacement changes program behavior',
      command_execute: 'Command execution can modify system state',
    };

    return {
      level: baseRiskLevel,
      reason: reasons[actionType] ?? 'Operation requires confirmation',
    };
  }

  /**
   * Emit detection event
   *
   * @param detection - The detected operation
   */
  private emitDetectionEvent(detection: DetectedOperation): void {
    const timestamp = new Date().toISOString();

    // Emit general operation detected event
    const event: OperationDetectedEvent = {
      type: 'operation_detected',
      operation: detection,
      timestamp,
    };
    this.emit(InterceptorEvent.OperationDetected, event);

    // Emit risk-specific events
    switch (detection.risk_level) {
      case 'high':
        this.emit(InterceptorEvent.HighRiskOperation, event);
        break;
      case 'medium':
        this.emit(InterceptorEvent.MediumRiskOperation, event);
        break;
      case 'low':
        this.emit(InterceptorEvent.LowRiskOperation, event);
        break;
    }
  }

  /**
   * Generate unique detection ID
   *
   * @returns Unique detection ID
   */
  private generateDetectionId(): string {
    this.detectionCount++;
    return `det_${Date.now()}_${this.detectionCount}`;
  }

  /**
   * Add a custom critical path pattern
   *
   * @param pattern - The critical path pattern to add
   */
  addCriticalPath(pattern: CriticalPathPattern): void {
    this.criticalPaths.push(pattern);
  }

  /**
   * Add a custom operation pattern
   *
   * @param pattern - The operation pattern to add
   */
  addOperationPattern(pattern: OperationPattern): void {
    this.operationPatterns.push(pattern);
  }

  /**
   * Get all critical path patterns
   *
   * @returns Array of critical path patterns
   */
  getCriticalPaths(): CriticalPathPattern[] {
    return [...this.criticalPaths];
  }

  /**
   * Get all operation patterns
   *
   * @returns Array of operation patterns
   */
  getOperationPatterns(): OperationPattern[] {
    return [...this.operationPatterns];
  }

  /**
   * Get detection statistics
   *
   * @returns Detection statistics
   */
  getStatistics(): {
    total_detections: number;
  } {
    return {
      total_detections: this.detectionCount,
    };
  }

  /**
   * Reset detection statistics
   */
  resetStatistics(): void {
    this.detectionCount = 0;
  }
}
