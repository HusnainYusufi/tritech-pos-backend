module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'prettier'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended'
  ],
  env: { node: true, es2020: true },
  rules: {
    'prettier/prettier': 'error',
    // JS files shouldn’t require explicit types:
    '@typescript-eslint/explicit-module-boundary-types': 'off'
  },
  overrides: [
    {
      files: ['**/*.js'],
      rules: {
        // relax a few TS‑only rules in plain JS for now
        '@typescript-eslint/no-var-requires': 'off'
      }
    }
  ]
};
