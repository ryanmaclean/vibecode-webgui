module.exports = {
  presets: [
    ['next/babel'],
    ['@babel/preset-typescript', {
      allowDeclareFields: true,
    }]
  ],
  plugins: [
    // Add any additional plugins if needed
  ],
  env: {
    test: {
      presets: [
        ['next/babel'],
        ['@babel/preset-typescript', {
          allowDeclareFields: true,
        }]
      ]
    }
  }
};