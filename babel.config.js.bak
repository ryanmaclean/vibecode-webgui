module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    ['@babel/preset-react', { runtime: 'automatic' }],
    ['@babel/preset-typescript', {
      allowNamespaces: true,
      allowDeclareFields: true,
      isTSX: true,
      allExtensions: true
    }]
  ],
  env: {
    test: {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        ['@babel/preset-react', { runtime: 'automatic' }],
        ['@babel/preset-typescript', {
          allowNamespaces: true,
          allowDeclareFields: true,
          isTSX: true,
          allExtensions: true
        }]
      ]
    }
  }
}