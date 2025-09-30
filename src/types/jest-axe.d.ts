declare module 'jest-axe' {
  import type { ReactElement } from 'react';
  import type { Result as AxeResult, RunOptions } from 'axe-core';

  export interface AxeResults {
    violations: AxeResult[];
    passes: AxeResult[];
    incomplete: AxeResult[];
    inapplicable: AxeResult[];
  }

  export type AxeConfigOptions = RunOptions;

  export type AxeRun = (
    element: Element | ReactElement | Document,
    options?: AxeConfigOptions,
  ) => Promise<AxeResults>;

  export function configureAxe(options?: AxeConfigOptions): AxeRun;

  export const toHaveNoViolations: {
    (results: AxeResults): { pass: boolean; message(): string };
  };

  interface AxeMatcherResult {
    pass: boolean;
    message: () => string;
  }

  function axe(
    element: Element | ReactElement | Document,
    options?: AxeConfigOptions,
  ): Promise<AxeResults>;

  namespace axe {
    function toHaveNoViolations(results: AxeResults): AxeMatcherResult;
  }

  export default axe;
}
