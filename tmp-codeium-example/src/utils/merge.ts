/**
 * Merges a partial object with a fallback object, deeply combining the two.
 *
 * @param {Partial<T>} partial - the partial object to merge (can be undefined)
 * @param {T} fallback - the fallback object to merge with
 * @return {T} the merged object
 */
type MergeableRecord = Record<string, unknown>;

const isMergeableRecord = (value: unknown): value is MergeableRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function deepMerge<T extends MergeableRecord>(
  partial: Partial<T> | undefined,
  fallback: T,
): T {
  const merged: MergeableRecord = { ...fallback };

  if (!partial) {
    return merged as T;
  }

  (Object.keys(partial) as Array<keyof T>).forEach((key) => {
    const partialValue = partial[key];

    if (partialValue === undefined) {
      return;
    }

    const fallbackValue = fallback[key];

    if (isMergeableRecord(partialValue) && isMergeableRecord(fallbackValue)) {
      merged[key as string] = deepMerge(
        partialValue as Partial<MergeableRecord>,
        fallbackValue as MergeableRecord,
      );
    } else {
      merged[key as string] = partialValue as T[keyof T];
    }
  });

  return merged as T;
}
