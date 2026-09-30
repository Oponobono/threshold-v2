const js = require('@eslint/js');

/**
 * Globals de Node, aplicables a TODO el backend.
 *
 * Estaban declarados dentro del bloque de la "frontera de seguridad", asi que
 * solo los veian controllers/, routes/, middlewares/ y server.js. Todo lo demas
 * (utils/, services/, config/) reportaba `require is not defined` y
 * `console is not defined` sobre lo que es un backend CommonJS normal, y eso
 * era la practica totalidad de los errores del lint: ruido que oculta los
 * errores reales. Este bloque va primero y sin `files`, asi que aplica a todo.
 */
const nodeGlobals = {
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
};

module.exports = [
  js.configs.recommended,
  {
    // Base para todo el codigo del backend: es CommonJS sobre Node.
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'commonjs',
      globals: nodeGlobals,
    },
  },
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
      globals: nodeGlobals,
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
