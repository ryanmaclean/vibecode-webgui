declare module 'jest-axe' {
  import { ReactElement } from 'react';
  import { AxeResults } from 'axe-core';
  
  interface AxeMatcherResult {
    pass: boolean;
    message: () => string;
  }
  
  interface AxeMatcher {
    toHaveNoViolations: () => AxeMatcherResult;
  }
  
  function axe(element: ReactElement): Promise<AxeResults>;
  
  namespace axe {
    function toHaveNoViolations(results: AxeResults): AxeMatcherResult;
  }
  
  export = axe;
}
