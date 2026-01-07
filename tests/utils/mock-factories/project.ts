/**
 * Mock Project Factory
 *
 * Creates realistic mock project and file objects for testing project generation,
 * file synchronization, and workspace management features.
 *
 * @example
 * ```typescript
 * const project = createMockProject();
 * const reactProject = createMockProject({ framework: 'react', name: 'My React App' });
 * const fileTree = createMockFileTree({ depth: 3 });
 * ```
 */

export interface MockProject {
  id: string;
  name: string;
  description: string;
  framework: string;
  language: string;
  owner: string;
  workspaceId?: string;
  files?: MockFile[];
  createdAt: Date;
  updatedAt?: Date;
  status?: 'generating' | 'ready' | 'error';
}

export interface MockFile {
  id?: string;
  path: string;
  name: string;
  content: string;
  language?: string;
  size?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface MockFileTree {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: MockFileTree[];
  content?: string;
}

/**
 * Creates a mock project object with sensible defaults
 *
 * @param overrides - Partial project object to override defaults
 * @returns Complete mock project object
 */
export const createMockProject = (overrides: Partial<MockProject> = {}): MockProject => {
  const timestamp = new Date();

  return {
    id: 'project-mock-123',
    name: 'Test Project',
    description: 'A test project for unit tests',
    framework: 'next',
    language: 'typescript',
    owner: 'user-123',
    status: 'ready',
    createdAt: timestamp,
    updatedAt: timestamp,
    files: [],
    ...overrides,
  };
};

/**
 * Creates a mock React project
 *
 * @param overrides - Additional project overrides
 * @returns Mock React project
 */
export const createMockReactProject = (overrides: Partial<MockProject> = {}): MockProject => {
  return createMockProject({
    id: 'project-react-123',
    name: 'React App',
    framework: 'react',
    ...overrides,
  });
};

/**
 * Creates a mock Next.js project
 *
 * @param overrides - Additional project overrides
 * @returns Mock Next.js project
 */
export const createMockNextProject = (overrides: Partial<MockProject> = {}): MockProject => {
  return createMockProject({
    id: 'project-next-123',
    name: 'Next.js App',
    framework: 'next',
    ...overrides,
  });
};

/**
 * Creates a mock file object
 *
 * @param overrides - Partial file object to override defaults
 * @returns Complete mock file object
 */
export const createMockFile = (overrides: Partial<MockFile> = {}): MockFile => {
  const timestamp = new Date();

  return {
    id: 'file-mock-123',
    path: '/src/index.ts',
    name: 'index.ts',
    content: 'console.log("Hello, World!");',
    language: 'typescript',
    size: 32,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
};

/**
 * Creates a mock package.json file
 *
 * @param packageName - Name of the package
 * @param overrides - Additional file overrides
 * @returns Mock package.json file
 */
export const createMockPackageJson = (
  packageName: string = 'test-project',
  overrides: Partial<MockFile> = {}
): MockFile => {
  const content = JSON.stringify(
    {
      name: packageName,
      version: '1.0.0',
      scripts: {
        dev: 'next dev',
        build: 'next build',
        start: 'next start',
      },
      dependencies: {
        react: '^18.2.0',
        'react-dom': '^18.2.0',
        next: '^14.0.0',
      },
    },
    null,
    2
  );

  return createMockFile({
    id: 'file-package-json',
    path: '/package.json',
    name: 'package.json',
    content,
    language: 'json',
    size: content.length,
    ...overrides,
  });
};

/**
 * Creates a mock file tree structure
 *
 * @param overrides - File tree overrides
 * @returns Mock file tree
 */
export const createMockFileTree = (
  overrides: Partial<MockFileTree> = {}
): MockFileTree => {
  return {
    name: 'project-root',
    path: '/',
    type: 'directory',
    children: [
      {
        name: 'src',
        path: '/src',
        type: 'directory',
        children: [
          {
            name: 'index.ts',
            path: '/src/index.ts',
            type: 'file',
            content: 'console.log("Hello, World!");',
          },
          {
            name: 'components',
            path: '/src/components',
            type: 'directory',
            children: [],
          },
        ],
      },
      {
        name: 'package.json',
        path: '/package.json',
        type: 'file',
        content: '{"name": "test-project"}',
      },
    ],
    ...overrides,
  };
};

/**
 * Creates multiple mock files at once
 *
 * @param count - Number of files to create
 * @param baseOverrides - Base overrides to apply to all files
 * @returns Array of mock files
 */
export const createMockFiles = (
  count: number,
  baseOverrides: Partial<MockFile> = {}
): MockFile[] => {
  return Array.from({ length: count }, (_, index) =>
    createMockFile({
      id: `file-${index + 1}`,
      path: `/src/file${index + 1}.ts`,
      name: `file${index + 1}.ts`,
      ...baseOverrides,
    })
  );
};

/**
 * Creates a mock project with a complete file structure
 *
 * @param overrides - Project overrides
 * @returns Mock project with files
 */
export const createMockProjectWithFiles = (
  overrides: Partial<MockProject> = {}
): MockProject => {
  const files = [
    createMockPackageJson(),
    createMockFile({
      id: 'file-readme',
      path: '/README.md',
      name: 'README.md',
      content: '# Test Project\n\nA test project.',
      language: 'markdown',
    }),
    createMockFile({
      id: 'file-index',
      path: '/src/index.ts',
      name: 'index.ts',
      content: 'export default function main() {}',
      language: 'typescript',
    }),
  ];

  return createMockProject({
    files,
    ...overrides,
  });
};
