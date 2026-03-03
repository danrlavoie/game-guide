var js = require('@eslint/js');
var esX = require('eslint-plugin-es-x');
var globals = require('globals');

// Frontend IIFE globals — each file defines one of these via `var X = (function() { ... })();`
var frontendGlobals = {
  API: 'writable',
  Router: 'writable',
  HomePage: 'writable',
  BrowsePage: 'writable',
  SearchPage: 'writable',
  ViewerPage: 'writable',
  TextViewerPage: 'writable',
  SettingsPage: 'writable',
  DocumentCard: 'writable',
  Toolbar: 'writable',
  TouchHandler: 'writable',
  ProgressBar: 'writable',
  BookmarkPanel: 'writable',
};

module.exports = [
  // Ignore data directory
  {
    ignores: ['data/**'],
  },

  // Backend: Node.js CommonJS
  {
    files: ['server/**/*.js'],
    languageOptions: {
      ecmaVersion: 2017,
      sourceType: 'commonjs',
      globals: globals.node,
    },
    rules: Object.assign({}, js.configs.recommended.rules, {
      'no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    }),
  },

  // Frontend: browser IIFEs
  {
    files: ['public/**/*.js'],
    plugins: {
      'es-x': esX,
    },
    languageOptions: {
      ecmaVersion: 2017,
      sourceType: 'script',
      globals: Object.assign({}, globals.browser, frontendGlobals),
    },
    rules: Object.assign({}, js.configs.recommended.rules, {
      'no-redeclare': ['error', { builtinGlobals: false }],
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern:
            '^(API|Router|HomePage|BrowsePage|SearchPage|ViewerPage|TextViewerPage|SettingsPage|DocumentCard|Toolbar|TouchHandler|ProgressBar|BookmarkPanel)$',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // Safari 10 compatibility — ban post-ES6 syntax
      'es-x/no-optional-chaining': 'error',
      'es-x/no-nullish-coalescing-operators': 'error',
      'es-x/no-array-prototype-at': 'error',
      'es-x/no-object-fromentries': 'error',
      'es-x/no-string-prototype-replaceall': 'error',
      'es-x/no-dynamic-import': 'error',
      'es-x/no-optional-catch-binding': 'error',
      'es-x/no-async-iteration': 'error',
      'es-x/no-promise-prototype-finally': 'error',
    }),
  },
];
