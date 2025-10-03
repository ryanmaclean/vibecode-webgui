declare module 'jest-axe' {
  import { ReactElement } from 'react';
  
  export interface AxeResults {
    violations: any[];
    passes: any[];
    incomplete: any[];
    inapplicable: any[];
  }

  export interface ConfigOptions {
    rules?: Record<string, { enabled: boolean }>;
    tags?: string[];
    [key: string]: any;
  }

  export function configureAxe(options?: ConfigOptions): (element: Element | ReactElement | Document) => Promise<AxeResults>;
  
  export const toHaveNoViolations: {
    toHaveNoViolations(results: AxeResults): { pass: boolean; message(): string };
  };
  
  interface AxeMatcherResult {
    pass: boolean;
    message: () => string;
  }
  
  function axe(element: Element | ReactElement | Document, options?: ConfigOptions): Promise<AxeResults>;
  
  namespace axe {
    function toHaveNoViolations(results: AxeResults): AxeMatcherResult;
  }
  
  export default axe;
}
