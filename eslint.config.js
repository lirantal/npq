'use strict'

const js = require('@eslint/js')
const { defineConfig } = require('eslint/config')
const nodePlugin = require('eslint-plugin-n')
const securityPlugin = require('eslint-plugin-security')
const globals = require('globals')

module.exports = defineConfig([
  {
    ignores: [
      '.idea/**',
      '.nyc_output/**',
      'coverage/**',
      'docs/**',
      'lib-cov/**',
      'node_modules/**'
    ]
  },
  {
    files: ['**/*.js'],
    extends: ['js/recommended'],
    plugins: {
      js,
      n: nodePlugin,
      security: securityPlugin
    },
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest
      },
      ecmaVersion: 2022,
      sourceType: 'commonjs'
    },
    rules: {
      semi: 'off',
      strict: 'error',
      'no-process-exit': 'off',
      'n/no-unsupported-features': 'off',
      'n/no-unpublished-require': 'off',
      'security/detect-non-literal-fs-filename': 'warn',
      'security/detect-unsafe-regex': 'warn',
      'security/detect-buffer-noassert': 'error',
      'security/detect-child-process': 'error',
      'security/detect-disable-mustache-escape': 'error',
      'security/detect-eval-with-expression': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-non-literal-regexp': 'error',
      'security/detect-object-injection': 'off',
      'security/detect-possible-timing-attacks': 'error',
      'security/detect-pseudoRandomBytes': 'error',
      'n/no-unsupported-features/node-builtins': [
        'off',
        {
          version: '>=20.13.0',
          ignores: []
        }
      ],
      'n/no-unsupported-features/es-syntax': [
        'error',
        {
          version: '>=20.13.0',
          ignores: []
        }
      ]
    }
  },
  {
    files: ['__tests__/*'],
    rules: {
      'n/no-unsupported-features/es-syntax': 'off',
      'n/no-unsupported-features/node-builtins': 'off'
    }
  }
])
