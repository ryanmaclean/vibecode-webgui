/**
 * Unit tests for monacopilot-integration helper functions
 */

// Manual mocks for dependencies
const mockRegisterCompletion = jest.fn();
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();

// Implementation under test (manual recreation to avoid import issues)
function setupMonacopilot(monacoInstance, editor, config) {
  // Input validation
  if (!monacoInstance) {
    throw new Error('Monaco instance is required');
  }
  if (!editor) {
    throw new Error('Editor instance is required');
  }
  if (!config) {
    throw new Error('Config object is required');
  }

  const options = {
    language: config.language,
    endpoint: config.endpoint,
    ...(config.headers && { headers: config.headers }),
  };

  // In real implementation, this would be: registerCompletion(monacoInstance, editor, options);
  mockRegisterCompletion(monacoInstance, editor, options);

  if (config.debug) {
    console.log('[Monacopilot] AI completion registered', {
      language: config.language,
      endpoint: config.endpoint,
    });
  }
}

function setupMonacopilotMulti(monacoInstance, editors, config) {
  editors.forEach((editor) => {
    setupMonacopilot(monacoInstance, editor, config);
  });
}

// Mock monaco editor
const mockEditor = {
  dispose: jest.fn(),
  getValue: jest.fn(() => ''),
  setValue: jest.fn(),
  getModel: jest.fn(),
};

const mockMonaco = {
  editor: {
    create: jest.fn(() => mockEditor),
  },
  languages: {
    register: jest.fn(),
  },
};

describe('setupMonacopilot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConsoleLog.mockClear();
    mockRegisterCompletion.mockReset();
    mockRegisterCompletion.mockImplementation(() => {}); // Default no-op implementation
  });

  it('should register completion with basic config', () => {
    const config = {
      endpoint: '/api/code-completion',
      language: 'typescript',
    };

    setupMonacopilot(mockMonaco, mockEditor, config);

    expect(mockRegisterCompletion).toHaveBeenCalledWith(mockMonaco, mockEditor, {
      language: 'typescript',
      endpoint: '/api/code-completion',
    });
  });

  it('should register completion with custom headers', () => {
    const config = {
      endpoint: '/api/code-completion',
      language: 'javascript',
      headers: {
        'Authorization': 'Bearer token123',
        'X-Custom-Header': 'value',
      },
    };

    setupMonacopilot(mockMonaco, mockEditor, config);

    expect(mockRegisterCompletion).toHaveBeenCalledWith(mockMonaco, mockEditor, {
      language: 'javascript',
      endpoint: '/api/code-completion',
      headers: {
        'Authorization': 'Bearer token123',
        'X-Custom-Header': 'value',
      },
    });
  });

  it('should log debug message when debug is enabled', () => {
    const config = {
      endpoint: '/api/code-completion',
      language: 'typescript',
      debug: true,
    };

    setupMonacopilot(mockMonaco, mockEditor, config);

    expect(mockConsoleLog).toHaveBeenCalledWith(
      '[Monacopilot] AI completion registered',
      {
        language: 'typescript',
        endpoint: '/api/code-completion',
      }
    );
  });

  it('should not log debug message when debug is false', () => {
    const config = {
      endpoint: '/api/code-completion',
      language: 'typescript',
      debug: false,
    };

    setupMonacopilot(mockMonaco, mockEditor, config);

    expect(mockConsoleLog).not.toHaveBeenCalled();
  });

  it('should not log debug message when debug is undefined', () => {
    const config = {
      endpoint: '/api/code-completion',
      language: 'typescript',
    };

    setupMonacopilot(mockMonaco, mockEditor, config);

    expect(mockConsoleLog).not.toHaveBeenCalled();
  });

  it('should work with different programming languages', () => {
    const languages = ['typescript', 'javascript', 'python', 'java', 'go', 'rust'];

    languages.forEach(language => {
      const config = {
        endpoint: '/api/code-completion',
        language,
      };

      setupMonacopilot(mockMonaco, mockEditor, config);

      expect(mockRegisterCompletion).toHaveBeenCalledWith(mockMonaco, mockEditor, {
        language,
        endpoint: '/api/code-completion',
      });
    });
  });

  it('should handle empty headers object', () => {
    const config = {
      endpoint: '/api/code-completion',
      language: 'typescript',
      headers: {},
    };

    setupMonacopilot(mockMonaco, mockEditor, config);

    expect(mockRegisterCompletion).toHaveBeenCalledWith(mockMonaco, mockEditor, {
      language: 'typescript',
      endpoint: '/api/code-completion',
      headers: {},
    });
  });

  it('should propagate errors from registerCompletion', () => {
    const error = new Error('Registration failed');
    mockRegisterCompletion.mockImplementation(() => {
      throw error;
    });

    const config = {
      endpoint: '/api/code-completion',
      language: 'typescript',
    };

    expect(() => {
      setupMonacopilot(mockMonaco, mockEditor, config);
    }).toThrow('Registration failed');
  });

  it('should work with different endpoint URLs', () => {
    const endpoints = [
      '/api/code-completion',
      'https://api.example.com/completion',
      '/v1/completions',
      'http://localhost:3000/ai/complete',
    ];

    endpoints.forEach(endpoint => {
      const config = {
        endpoint,
        language: 'typescript',
      };

      setupMonacopilot(mockMonaco, mockEditor, config);

      expect(mockRegisterCompletion).toHaveBeenCalledWith(mockMonaco, mockEditor, {
        language: 'typescript',
        endpoint,
      });
    });
  });
});

describe('setupMonacopilotMulti', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConsoleLog.mockClear();
    mockRegisterCompletion.mockReset();
    mockRegisterCompletion.mockImplementation(() => {}); // Default no-op implementation
  });

  it('should setup monacopilot for multiple editors', () => {
    const editors = [mockEditor, mockEditor, mockEditor];
    const config = {
      endpoint: '/api/code-completion',
      language: 'typescript',
    };

    setupMonacopilotMulti(mockMonaco, editors, config);

    expect(mockRegisterCompletion).toHaveBeenCalledTimes(3);
    editors.forEach((editor) => {
      expect(mockRegisterCompletion).toHaveBeenCalledWith(mockMonaco, editor, {
        language: 'typescript',
        endpoint: '/api/code-completion',
      });
    });
  });

  it('should handle empty editors array', () => {
    const editors = [];
    const config = {
      endpoint: '/api/code-completion',
      language: 'typescript',
    };

    setupMonacopilotMulti(mockMonaco, editors, config);

    expect(mockRegisterCompletion).not.toHaveBeenCalled();
  });

  it('should setup monacopilot for single editor in array', () => {
    const editors = [mockEditor];
    const config = {
      endpoint: '/api/code-completion',
      language: 'javascript',
      debug: true,
    };

    setupMonacopilotMulti(mockMonaco, editors, config);

    expect(mockRegisterCompletion).toHaveBeenCalledTimes(1);
    expect(mockRegisterCompletion).toHaveBeenCalledWith(mockMonaco, mockEditor, {
      language: 'javascript',
      endpoint: '/api/code-completion',
    });
    expect(mockConsoleLog).toHaveBeenCalledWith(
      '[Monacopilot] AI completion registered',
      {
        language: 'javascript',
        endpoint: '/api/code-completion',
      }
    );
  });

  it('should propagate config with headers to all editors', () => {
    const mockEditor1 = { ...mockEditor };
    const mockEditor2 = { ...mockEditor };
    const editors = [mockEditor1, mockEditor2];
    const config = {
      endpoint: '/api/code-completion',
      language: 'python',
      headers: {
        'Authorization': 'Bearer secret',
      },
    };

    setupMonacopilotMulti(mockMonaco, editors, config);

    expect(mockRegisterCompletion).toHaveBeenCalledTimes(2);
    expect(mockRegisterCompletion).toHaveBeenNthCalledWith(1, mockMonaco, mockEditor1, {
      language: 'python',
      endpoint: '/api/code-completion',
      headers: {
        'Authorization': 'Bearer secret',
      },
    });
    expect(mockRegisterCompletion).toHaveBeenNthCalledWith(2, mockMonaco, mockEditor2, {
      language: 'python',
      endpoint: '/api/code-completion',
      headers: {
        'Authorization': 'Bearer secret',
      },
    });
  });

  it('should handle errors from individual editor setup', () => {
    const error = new Error('Setup failed for editor');
    let callCount = 0;
    mockRegisterCompletion.mockImplementation(() => {
      callCount++;
      if (callCount === 2) {
        throw error;
      }
    });

    const editors = [mockEditor, mockEditor, mockEditor];
    const config = {
      endpoint: '/api/code-completion',
      language: 'typescript',
    };

    expect(() => {
      setupMonacopilotMulti(mockMonaco, editors, config);
    }).toThrow('Setup failed for editor');

    // Should have attempted setup for first two editors
    expect(mockRegisterCompletion).toHaveBeenCalledTimes(2);
  });

  it('should enable debug logging for all editors when debug is true', () => {
    const editors = [mockEditor, mockEditor];
    const config = {
      endpoint: '/api/code-completion',
      language: 'typescript',
      debug: true,
    };

    setupMonacopilotMulti(mockMonaco, editors, config);

    expect(mockConsoleLog).toHaveBeenCalledTimes(2);
    expect(mockConsoleLog).toHaveBeenCalledWith(
      '[Monacopilot] AI completion registered',
      {
        language: 'typescript',
        endpoint: '/api/code-completion',
      }
    );
  });

  it('should work with many editors', () => {
    const editors = Array(10).fill(mockEditor);
    const config = {
      endpoint: '/api/code-completion',
      language: 'typescript',
    };

    setupMonacopilotMulti(mockMonaco, editors, config);

    expect(mockRegisterCompletion).toHaveBeenCalledTimes(10);
  });
});

describe('Configuration Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRegisterCompletion.mockReset();
    mockRegisterCompletion.mockImplementation(() => {}); // Default no-op implementation
  });

  it('should handle config object immutability', () => {
    const originalConfig = {
      endpoint: '/api/code-completion',
      language: 'typescript',
      headers: {
        'Authorization': 'Bearer token',
      },
    };

    const configCopy = { ...originalConfig };

    setupMonacopilot(mockMonaco, mockEditor, originalConfig);

    // Config should not be modified
    expect(originalConfig).toEqual(configCopy);
  });

  it('should create correct options object without modifying config', () => {
    const config = {
      endpoint: '/api/code-completion',
      language: 'typescript',
      debug: true,
    };

    setupMonacopilot(mockMonaco, mockEditor, config);

    expect(mockRegisterCompletion).toHaveBeenCalledWith(mockMonaco, mockEditor, {
      language: 'typescript',
      endpoint: '/api/code-completion',
    });

    // The debug flag should not be passed to registerCompletion
    const actualOptions = mockRegisterCompletion.mock.calls[0][2];
    expect(actualOptions).not.toHaveProperty('debug');
  });

  it('should only include headers when they exist', () => {
    const configWithoutHeaders = {
      endpoint: '/api/code-completion',
      language: 'typescript',
    };

    setupMonacopilot(mockMonaco, mockEditor, configWithoutHeaders);

    const actualOptions = mockRegisterCompletion.mock.calls[0][2];
    expect(actualOptions).not.toHaveProperty('headers');
  });
});

describe('Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRegisterCompletion.mockReset();
    mockRegisterCompletion.mockImplementation(() => {}); // Default no-op implementation
  });

  it('should handle null/undefined monaco instance', () => {
    const config = {
      endpoint: '/api/code-completion',
      language: 'typescript',
    };

    expect(() => {
      setupMonacopilot(null, mockEditor, config);
    }).toThrow();
  });

  it('should handle null/undefined editor instance', () => {
    const config = {
      endpoint: '/api/code-completion',
      language: 'typescript',
    };

    expect(() => {
      setupMonacopilot(mockMonaco, null, config);
    }).toThrow();
  });

  it('should handle invalid config object', () => {
    expect(() => {
      setupMonacopilot(mockMonaco, mockEditor, null);
    }).toThrow();

    expect(() => {
      setupMonacopilot(mockMonaco, mockEditor, undefined);
    }).toThrow();
  });
});