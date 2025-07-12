module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    ['@babel/preset-typescript', { 
      onlyRemoveTypeImports: true,
      allowDeclareFields: true 
    }],
    ['@babel/preset-react', { runtime: 'automatic' }]
  ],
  env: {
    test: {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        ['@babel/preset-typescript', { 
          onlyRemoveTypeImports: true,
          allowDeclareFields: true 
        }],
        ['@babel/preset-react', { runtime: 'automatic' }]
      ]
    }
  }
}