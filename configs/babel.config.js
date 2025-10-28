module.exports = (api) => {
  api.cache.using(() => process.env.NODE_ENV);

  const isTest = process.env.NODE_ENV === 'test';

  // For builds, use Next.js built-in Babel config
  if (!isTest) {
    return {
      presets: ['next/babel']
    };
  }

  // For Jest testing, use comprehensive config
  return {
    presets: [
      ['@babel/preset-env', { 
        targets: { node: 'current' },
        modules: 'commonjs'
      }],
      ['@babel/preset-typescript', { 
        allowNamespaces: true,
        allExtensions: true,
        isTSX: true
      }],
      ['@babel/preset-react', { 
        runtime: 'automatic'
      }]
    ],
    plugins: [
      '@babel/plugin-transform-modules-commonjs'
      // Removed 'babel-plugin-dynamic-import-node' - not installed
    ]
  };
};