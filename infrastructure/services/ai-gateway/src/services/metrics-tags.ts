export function sanitizeTagValue(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return 'unknown';
  const s = String(value);
  // Replace characters that often break tag cardinality or query semantics
  return s.replace(/[^a-zA-Z0-9_.-]/g, '_');
}

export function kvTag(key: string, value: string | number | undefined | null): string {
  return `${key}:${sanitizeTagValue(value)}`;
}

export function buildMetricTags(opts: {
  model?: string;
  task?: string;
  user?: string | number;
  component?: string;
  operation?: string;
} = {}, extra: string[] = []): string[] {
  const tags: string[] = [];
  if (opts.model) tags.push(kvTag('model', opts.model));
  if (opts.task) tags.push(kvTag('task', opts.task));
  if (opts.user) tags.push(kvTag('user', opts.user));
  if (opts.component) tags.push(kvTag('component', opts.component));
  if (opts.operation) tags.push(kvTag('operation', opts.operation));
  return [...tags, ...extra];
}
