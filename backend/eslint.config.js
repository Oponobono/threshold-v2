const js = require('@eslint/js');

module.exports = [
  js.configs.recommended,
  {
    // Security perimeter: controllers, routes, middlewares, server.js
    // services/ excluded — enters on per-domain incremental migration
    files: [
      'controllers/**/*.js',
      'routes/**/*.js',
      'middlewares/**/*.js',
      'server.js',
    ],
    rules: {
      // Correctness
      'eqeqeq': ['error', 'always'],
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-fallthrough': 'error',

      // Security-relevant patterns
      'no-eval': 'error',
      'no-implied-eval': 'error',

      // Disabled: too noisy for legacy CJS codebase in first pass
      'no-console': 'off',
    },
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        // Node 18+ native globals
        fetch: 'readonly',
        globalThis: 'readonly',
        structuredClone: 'readonly',
      },
    },
  },
  {
    ignores: [
      'node_modules/**',
      'tests/**',
      'scripts/**',
    ],
  },
];
