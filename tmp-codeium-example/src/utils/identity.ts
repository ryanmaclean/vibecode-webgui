declare global {
  interface Window {
    CODEIUM_REACT_CODE_VERSION?: string;
  }
}

/**
 * Get the current URL of the window. If this fails, a null string is returned.
 * @returns The current URL
 */
export const getCurrentURL = () => {
  try {
    return window.location.href;
  } catch {
    return null;
  }
};

export const getBrowserVersion = () => {
  try {
    return window.navigator.userAgent;
  } catch {
    return null;
  }
};

/**
 * Get the current package version. If this fails, a null string is returned.
 */
export const getPackageVersion = () => {
  try {
    return window.CODEIUM_REACT_CODE_VERSION ? window.CODEIUM_REACT_CODE_VERSION : null;
  } catch {
    return null;
  }
};
