module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        project: './tsconfig.json'
    },
    plugins: [
        '@typescript-eslint'
    ],
    extends: [
        '@typescript-eslint/recommended'
    ],
    env: {
        node: true,
        es2020: true
    },
    rules: {
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        '@typescript-eslint/no-explicit-any': 'warn',
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/ban-ts-comment': 'warn',
        'no-console': 'off'
    },
    overrides: [
        {
            files: ['src/test/**/*.ts'],
            env: {
                mocha: true,
                node: true
            },
            rules: {
                '@typescript-eslint/no-explicit-any': 'off'
            }
        }
    ],
    ignorePatterns: [
        'out/**',
        'node_modules/**',
        '.vscode-test/**'
    ]
};