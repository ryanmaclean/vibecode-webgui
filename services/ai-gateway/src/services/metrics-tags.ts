import { config } from '../config/environment';

export function sanitizeTagValue(value: string | number | undefined | null): string {
  const raw = String(value ?? 'unknown');
  // Replace problematic characters and trim length to avoid cardinality explosions
  return raw
    .trim()
    .replace(/[\s]+/g, '_')
    .replace(/[:/|,=]/g, '_')
    .slice(0, 128);
}

export function kvTag(key: string, value: string | number | undefined | null): string {
  return `${key}:${sanitizeTagValue(value as any)}`;
}

function normalizeModel(input: string | undefined): { provider: string; family: string; full: string } {
  const model = input || config.models.defaultModel || 'unknown/unknown';
  const sanitized = model.replace(/[:/]/g, '_');
  const [providerRaw, modelRaw] = model.split('/', 2);
  const provider = (providerRaw || 'unknown').toLowerCase();
  const modelId = modelRaw || providerRaw || 'unknown';
  const parts = modelId.split('-');
  const family = (parts.length >= 2 ? `${parts[0]}-${parts[1]}` : parts[0]).toLowerCase();
  return { provider, family, full: sanitized };
}

/**
 * Build standardized tags for metrics emitted by controllers/services.
 * Note: env/service/version are automatically added by the Datadog client.
 */
export function buildMetricTags(
  base: { model?: string; operation?: string },
  extra: string[] = []
): string[] {
  const tags: string[] = [];
  if (base.operation) tags.push(kvTag('operation', base.operation));
  if (base.model) {
    const { provider, family } = normalizeModel(base.model);
    tags.push(kvTag('model_provider', provider));
    tags.push(kvTag('model_family', family));
  }
  if (extra.length) tags.push(...extra);
  return tags;
}
