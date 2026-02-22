/**
 * Audit Log Export Module
 *
 * Provides export functionality for compliance tool integration.
 * Supports CSV and JSON formats with streaming capabilities for large exports.
 *
 * Compliance Features:
 * - SOC2: Full audit trail export with timestamps and user attribution
 * - HIPAA: Complete metadata export with integrity verification
 * - Export includes hash chain information for tamper evidence verification
 */

import { z } from 'zod';
import { auditService, type QueryAuditLogsResult } from './service';
import {
  type AuditLogEntry,
  type AuditLogFilter,
  auditLogFilterSchema,
} from './types';
import { createServiceLogger, type ServiceLogger } from '@/lib/logging/service-logger';
import { metrics } from '@/lib/server-monitoring';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Maximum records per export batch (for streaming)
 */
const DEFAULT_BATCH_SIZE = 1000;

/**
 * Maximum total records for a single export
 */
const MAX_EXPORT_RECORDS = 100000;

// Check if we're in build mode
const isBuilding =
  process.env.NEXT_PHASE === 'phase-production-build' ||
  process.argv.includes('build') ||
  process.env.BUILDING === 'true';

// ============================================================================
// Types
// ============================================================================

/**
 * Supported export formats
 */
export enum ExportFormat {
  CSV = 'csv',
  JSON = 'json',
}

/**
 * Export options configuration
 */
export interface ExportOptions {
  /** Export format (CSV or JSON) */
  format: ExportFormat;
  /** Filter for audit log query */
  filter?: AuditLogFilter;
  /** Include hash chain information for integrity verification */
  includeHashes?: boolean;
  /** Include metadata field (can be large) */
  includeMetadata?: boolean;
  /** Maximum records to export */
  maxRecords?: number;
  /** Batch size for processing (internal) */
  batchSize?: number;
  /** Include BOM for Excel CSV compatibility */
  includeBom?: boolean;
  /** Custom field delimiter for CSV (defaults to comma) */
  delimiter?: string;
}

/**
 * Export result with content and metadata
 */
export interface ExportResult {
  /** Whether the export completed successfully */
  success: boolean;
  /** Exported content as string */
  content?: string;
  /** Export format used */
  format?: ExportFormat;
  /** Number of records exported */
  recordCount?: number;
  /** Total records matching filter (may be higher than recordCount if limited) */
  totalCount?: number;
  /** Whether export was truncated due to limits */
  truncated?: boolean;
  /** Export timestamp */
  exportedAt?: Date;
  /** Filter applied to export */
  filter?: AuditLogFilter;
  /** Error message if failed */
  error?: string;
  /** Content type for HTTP response */
  contentType?: string;
  /** Suggested filename for download */
  filename?: string;
}

/**
 * Export metadata included in JSON exports
 */
export interface ExportMetadata {
  /** Export timestamp */
  exportedAt: string;
  /** Filter criteria applied */
  filter: AuditLogFilter | null;
  /** Number of records included */
  recordCount: number;
  /** Total records matching filter */
  totalCount: number;
  /** Whether export was truncated */
  truncated: boolean;
  /** Export format */
  format: ExportFormat;
  /** Schema version for forward compatibility */
  schemaVersion: string;
  /** Include hashes flag */
  includesHashes: boolean;
  /** Include metadata flag */
  includesMetadata: boolean;
}

/**
 * Streaming export handler for large exports
 */
export interface StreamingExportHandler {
  /** Write a chunk of data */
  write(chunk: string): Promise<void>;
  /** Finalize the export */
  end(): Promise<void>;
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const exportFormatSchema = z.nativeEnum(ExportFormat);

export const exportOptionsSchema = z.object({
  format: exportFormatSchema,
  filter: auditLogFilterSchema.optional(),
  includeHashes: z.boolean().optional().default(true),
  includeMetadata: z.boolean().optional().default(true),
  maxRecords: z.number().int().min(1).max(MAX_EXPORT_RECORDS).optional().default(MAX_EXPORT_RECORDS),
  batchSize: z.number().int().min(1).max(10000).optional().default(DEFAULT_BATCH_SIZE),
  includeBom: z.boolean().optional().default(true),
  delimiter: z.string().length(1).optional().default(','),
});

export type ValidatedExportOptions = z.infer<typeof exportOptionsSchema>;

// ============================================================================
// Logger
// ============================================================================

const logger: ServiceLogger = createServiceLogger({
  service: process.env.DD_SERVICE || 'vibecode-webgui',
  component: 'audit-export',
});

// ============================================================================
// CSV Formatting
// ============================================================================

/**
 * CSV column definitions for audit log exports
 */
const CSV_COLUMNS = {
  base: [
    'id',
    'timestamp',
    'userId',
    'action',
    'resource',
    'category',
    'severity',
    'outcome',
    'ipAddress',
    'userAgent',
    'sessionId',
  ] as const,
  hashes: ['hash', 'previousHash'] as const,
  metadata: ['metadata'] as const,
};

/**
 * Escape a value for CSV output
 * @param value The value to escape
 * @param delimiter The field delimiter
 */
function escapeCSVValue(value: unknown, delimiter: string): string {
  if (value === null || value === undefined) {
    return '';
  }

  let stringValue: string;

  if (value instanceof Date) {
    stringValue = value.toISOString();
  } else if (typeof value === 'object') {
    stringValue = JSON.stringify(value);
  } else {
    stringValue = String(value);
  }

  // If value contains delimiter, quotes, or newlines, wrap in quotes and escape internal quotes
  if (
    stringValue.includes(delimiter) ||
    stringValue.includes('"') ||
    stringValue.includes('\n') ||
    stringValue.includes('\r')
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Get CSV column headers based on options
 */
function getCSVHeaders(options: ValidatedExportOptions): string[] {
  const headers: string[] = [...CSV_COLUMNS.base];

  if (options.includeHashes) {
    headers.push(...CSV_COLUMNS.hashes);
  }

  if (options.includeMetadata) {
    headers.push(...CSV_COLUMNS.metadata);
  }

  return headers;
}

/**
 * Convert an audit log entry to a CSV row
 */
function entryToCSVRow(entry: AuditLogEntry, options: ValidatedExportOptions): string {
  const delimiter = options.delimiter ?? ',';
  const values: string[] = [];

  // Base columns
  values.push(escapeCSVValue(entry.id, delimiter));
  values.push(escapeCSVValue(entry.timestamp, delimiter));
  values.push(escapeCSVValue(entry.userId, delimiter));
  values.push(escapeCSVValue(entry.action, delimiter));
  values.push(escapeCSVValue(entry.resource, delimiter));
  values.push(escapeCSVValue(entry.category, delimiter));
  values.push(escapeCSVValue(entry.severity, delimiter));
  values.push(escapeCSVValue(entry.outcome, delimiter));
  values.push(escapeCSVValue(entry.ipAddress, delimiter));
  values.push(escapeCSVValue(entry.userAgent, delimiter));
  values.push(escapeCSVValue(entry.sessionId, delimiter));

  // Hash columns
  if (options.includeHashes) {
    values.push(escapeCSVValue(entry.hash, delimiter));
    values.push(escapeCSVValue(entry.previousHash, delimiter));
  }

  // Metadata column
  if (options.includeMetadata) {
    values.push(escapeCSVValue(entry.metadata, delimiter));
  }

  return values.join(delimiter);
}

/**
 * Generate CSV content from audit log entries
 */
function generateCSV(
  entries: AuditLogEntry[],
  options: ValidatedExportOptions
): string {
  const delimiter = options.delimiter ?? ',';
  const headers = getCSVHeaders(options);
  const lines: string[] = [];

  // Add BOM for Excel compatibility if requested
  const bom = options.includeBom ? '\ufeff' : '';

  // Add header row
  lines.push(headers.join(delimiter));

  // Add data rows
  for (const entry of entries) {
    lines.push(entryToCSVRow(entry, options));
  }

  return bom + lines.join('\n');
}

// ============================================================================
// JSON Formatting
// ============================================================================

/**
 * Transform an audit log entry for JSON export
 */
function transformEntryForJSON(
  entry: AuditLogEntry,
  options: ValidatedExportOptions
): Record<string, unknown> {
  const result: Record<string, unknown> = {
    id: entry.id,
    timestamp: entry.timestamp.toISOString(),
    userId: entry.userId,
    action: entry.action,
    resource: entry.resource,
    category: entry.category,
    severity: entry.severity,
    outcome: entry.outcome,
    ipAddress: entry.ipAddress,
    userAgent: entry.userAgent,
    sessionId: entry.sessionId,
  };

  if (options.includeHashes) {
    result.hash = entry.hash;
    result.previousHash = entry.previousHash;
  }

  if (options.includeMetadata) {
    result.metadata = entry.metadata;
  }

  return result;
}

/**
 * Generate JSON content from audit log entries with metadata
 */
function generateJSON(
  entries: AuditLogEntry[],
  metadata: ExportMetadata,
  options: ValidatedExportOptions
): string {
  const transformedEntries = entries.map((entry) =>
    transformEntryForJSON(entry, options)
  );

  const exportData = {
    metadata,
    entries: transformedEntries,
  };

  return JSON.stringify(exportData, null, 2);
}

// ============================================================================
// Export Service
// ============================================================================

/**
 * Export audit logs in the specified format
 * @param options Export options including format and filter
 * @returns Export result with content and metadata
 */
export async function exportAuditLogs(
  options: ExportOptions
): Promise<ExportResult> {
  if (isBuilding) {
    return {
      success: true,
      content: '',
      format: options.format,
      recordCount: 0,
      totalCount: 0,
      truncated: false,
      exportedAt: new Date(),
    };
  }

  const startTime = Date.now();

  try {
    // Validate options
    const validated = exportOptionsSchema.parse(options);
    const exportedAt = new Date();

    logger.info('Starting audit log export', {
      format: validated.format,
      maxRecords: validated.maxRecords,
      includeHashes: validated.includeHashes,
      includeMetadata: validated.includeMetadata,
    });

    // Query audit logs with pagination
    const filter: AuditLogFilter = {
      ...validated.filter,
      limit: validated.maxRecords,
      offset: 0,
    };

    const queryResult: QueryAuditLogsResult = await auditService.query(filter);
    const truncated = queryResult.totalCount > (validated.maxRecords ?? MAX_EXPORT_RECORDS);

    // Create export metadata
    const metadata: ExportMetadata = {
      exportedAt: exportedAt.toISOString(),
      filter: validated.filter ?? null,
      recordCount: queryResult.entries.length,
      totalCount: queryResult.totalCount,
      truncated,
      format: validated.format,
      schemaVersion: '1.0.0',
      includesHashes: validated.includeHashes ?? true,
      includesMetadata: validated.includeMetadata ?? true,
    };

    // Generate content based on format
    let content: string;
    let contentType: string;
    let filename: string;

    const timestamp = exportedAt.toISOString().replace(/[:.]/g, '-').slice(0, 19);

    switch (validated.format) {
      case ExportFormat.CSV:
        content = generateCSV(queryResult.entries, validated);
        contentType = 'text/csv; charset=utf-8';
        filename = `audit-logs-${timestamp}.csv`;
        break;

      case ExportFormat.JSON:
        content = generateJSON(queryResult.entries, metadata, validated);
        contentType = 'application/json; charset=utf-8';
        filename = `audit-logs-${timestamp}.json`;
        break;

      default:
        throw new Error(`Unsupported export format: ${validated.format}`);
    }

    const durationMs = Date.now() - startTime;

    // Record metrics
    metrics.histogram('audit.export.duration', durationMs);
    metrics.increment('audit.export.completed', {
      format: validated.format,
      records: String(queryResult.entries.length),
    });

    logger.info('Audit log export completed', {
      format: validated.format,
      recordCount: queryResult.entries.length,
      totalCount: queryResult.totalCount,
      truncated,
      durationMs,
    });

    return {
      success: true,
      content,
      format: validated.format,
      recordCount: queryResult.entries.length,
      totalCount: queryResult.totalCount,
      truncated,
      exportedAt,
      filter: validated.filter,
      contentType,
      filename,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const durationMs = Date.now() - startTime;

    logger.error('Audit log export failed', {
      error: errorMessage,
      format: options.format,
      durationMs,
    });

    metrics.increment('audit.export.error', { format: options.format });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Export audit logs in CSV format (convenience function)
 * @param filter Optional filter for audit logs
 * @param options Additional export options
 */
export async function exportToCSV(
  filter?: AuditLogFilter,
  options?: Partial<Omit<ExportOptions, 'format' | 'filter'>>
): Promise<ExportResult> {
  return exportAuditLogs({
    format: ExportFormat.CSV,
    filter,
    ...options,
  });
}

/**
 * Export audit logs in JSON format (convenience function)
 * @param filter Optional filter for audit logs
 * @param options Additional export options
 */
export async function exportToJSON(
  filter?: AuditLogFilter,
  options?: Partial<Omit<ExportOptions, 'format' | 'filter'>>
): Promise<ExportResult> {
  return exportAuditLogs({
    format: ExportFormat.JSON,
    filter,
    ...options,
  });
}

// ============================================================================
// Streaming Export
// ============================================================================

/**
 * Stream audit logs in the specified format for large exports
 * @param handler Streaming handler for writing chunks
 * @param options Export options
 * @returns Export result metadata (content is streamed via handler)
 */
export async function streamAuditLogs(
  handler: StreamingExportHandler,
  options: ExportOptions
): Promise<Omit<ExportResult, 'content'>> {
  if (isBuilding) {
    return {
      success: true,
      format: options.format,
      recordCount: 0,
      totalCount: 0,
      truncated: false,
      exportedAt: new Date(),
    };
  }

  const startTime = Date.now();

  try {
    // Validate options
    const validated = exportOptionsSchema.parse(options);
    const exportedAt = new Date();
    const batchSize = validated.batchSize ?? DEFAULT_BATCH_SIZE;
    const maxRecords = validated.maxRecords ?? MAX_EXPORT_RECORDS;

    logger.info('Starting streaming audit log export', {
      format: validated.format,
      maxRecords,
      batchSize,
    });

    // Get total count first
    const countFilter: AuditLogFilter = { ...validated.filter, limit: 1, offset: 0 };
    const countResult = await auditService.query(countFilter);
    const totalCount = countResult.totalCount;
    const truncated = totalCount > maxRecords;

    let recordCount = 0;
    let offset = 0;
    let isFirstBatch = true;

    // For JSON, write opening structure
    if (validated.format === ExportFormat.JSON) {
      const metadata: ExportMetadata = {
        exportedAt: exportedAt.toISOString(),
        filter: validated.filter ?? null,
        recordCount: Math.min(totalCount, maxRecords),
        totalCount,
        truncated,
        format: validated.format,
        schemaVersion: '1.0.0',
        includesHashes: validated.includeHashes ?? true,
        includesMetadata: validated.includeMetadata ?? true,
      };

      await handler.write(`{\n  "metadata": ${JSON.stringify(metadata, null, 2).replace(/\n/g, '\n  ')},\n  "entries": [\n`);
    }

    // For CSV, write headers
    if (validated.format === ExportFormat.CSV) {
      const bom = validated.includeBom ? '\ufeff' : '';
      const headers = getCSVHeaders(validated);
      await handler.write(bom + headers.join(validated.delimiter ?? ',') + '\n');
    }

    // Stream in batches
    while (recordCount < maxRecords) {
      const remaining = maxRecords - recordCount;
      const currentBatchSize = Math.min(batchSize, remaining);

      const batchFilter: AuditLogFilter = {
        ...validated.filter,
        limit: currentBatchSize,
        offset,
      };

      const batchResult = await auditService.query(batchFilter);

      if (batchResult.entries.length === 0) {
        break;
      }

      // Write batch
      for (let i = 0; i < batchResult.entries.length; i++) {
        const entry = batchResult.entries[i];
        const isLast = !batchResult.hasMore && i === batchResult.entries.length - 1;

        if (validated.format === ExportFormat.CSV) {
          await handler.write(entryToCSVRow(entry, validated) + '\n');
        } else {
          const entryJson = JSON.stringify(transformEntryForJSON(entry, validated), null, 4);
          const indented = entryJson.replace(/\n/g, '\n    ');
          const prefix = isFirstBatch && i === 0 ? '    ' : ',\n    ';
          await handler.write(prefix + indented);

          if (isLast) {
            await handler.write('\n');
          }
        }
      }

      recordCount += batchResult.entries.length;
      offset += currentBatchSize;
      isFirstBatch = false;

      if (!batchResult.hasMore) {
        break;
      }
    }

    // For JSON, write closing structure
    if (validated.format === ExportFormat.JSON) {
      await handler.write('  ]\n}\n');
    }

    await handler.end();

    const durationMs = Date.now() - startTime;
    const timestamp = exportedAt.toISOString().replace(/[:.]/g, '-').slice(0, 19);

    // Record metrics
    metrics.histogram('audit.export.streaming.duration', durationMs);
    metrics.increment('audit.export.streaming.completed', {
      format: validated.format,
      records: String(recordCount),
    });

    logger.info('Streaming audit log export completed', {
      format: validated.format,
      recordCount,
      totalCount,
      truncated,
      durationMs,
    });

    return {
      success: true,
      format: validated.format,
      recordCount,
      totalCount,
      truncated,
      exportedAt,
      filter: validated.filter,
      contentType:
        validated.format === ExportFormat.CSV
          ? 'text/csv; charset=utf-8'
          : 'application/json; charset=utf-8',
      filename: `audit-logs-${timestamp}.${validated.format}`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const durationMs = Date.now() - startTime;

    logger.error('Streaming audit log export failed', {
      error: errorMessage,
      format: options.format,
      durationMs,
    });

    metrics.increment('audit.export.streaming.error', { format: options.format });

    try {
      await handler.end();
    } catch {
      // Ignore cleanup errors
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get the file extension for an export format
 */
export function getExportExtension(format: ExportFormat): string {
  switch (format) {
    case ExportFormat.CSV:
      return 'csv';
    case ExportFormat.JSON:
      return 'json';
    default:
      return 'txt';
  }
}

/**
 * Get the content type for an export format
 */
export function getExportContentType(format: ExportFormat): string {
  switch (format) {
    case ExportFormat.CSV:
      return 'text/csv; charset=utf-8';
    case ExportFormat.JSON:
      return 'application/json; charset=utf-8';
    default:
      return 'text/plain; charset=utf-8';
  }
}

/**
 * Generate a filename for an export
 * @param format Export format
 * @param prefix Optional filename prefix
 */
export function generateExportFilename(
  format: ExportFormat,
  prefix: string = 'audit-logs'
): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const extension = getExportExtension(format);
  return `${prefix}-${timestamp}.${extension}`;
}

/**
 * Parse export format from string
 * @param formatStr Format string (case-insensitive)
 * @returns ExportFormat or null if invalid
 */
export function parseExportFormat(formatStr: string): ExportFormat | null {
  const normalized = formatStr.toLowerCase().trim();
  switch (normalized) {
    case 'csv':
      return ExportFormat.CSV;
    case 'json':
      return ExportFormat.JSON;
    default:
      return null;
  }
}
