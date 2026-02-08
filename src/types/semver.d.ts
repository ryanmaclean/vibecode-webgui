declare module 'semver' {
  export function valid(version: string | null): string | null;
  export function gt(v1: string, v2: string): boolean;
  export function gte(v1: string, v2: string): boolean;
  export function lt(v1: string, v2: string): boolean;
  export function lte(v1: string, v2: string): boolean;
  export function eq(v1: string, v2: string): boolean;
  export function satisfies(version: string, range: string): boolean;
  export function compare(v1: string, v2: string): -1 | 0 | 1;
  export function clean(version: string): string | null;
  export function coerce(version: string | number): { version: string } | null;
  export function diff(v1: string, v2: string): string | null;
  export function major(version: string): number;
  export function minor(version: string): number;
  export function patch(version: string): number;
  export function parse(version: string): { version: string; major: number; minor: number; patch: number } | null;
  export function prerelease(version: string): ReadonlyArray<string | number> | null;
  export function inc(version: string, release: string): string | null;
  export function maxSatisfying(versions: string[], range: string): string | null;
  export function minSatisfying(versions: string[], range: string): string | null;
  export function validRange(range: string): string | null;
}
