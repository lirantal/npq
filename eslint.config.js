const eslint = require('eslint')
const { defineConfig, globalIgnores } = require('eslint/config')

const pluginSecurity = require('eslint-plugin-security')

module.exports = [
  globalIgnores(['__tests__']),
  pluginSecurity.configs.recommended,
  {
    rules: {
      semi: 'off',
      'no-process-exit': 'off',
      'node/no-unsupported-features': 'off',
      'node/no-unpublished-require': 'off',
      'security/detect-non-literal-fs-filename': 'warn',
      'security/detect-unsafe-regex': 'warn',
      'security/detect-buffer-noassert': 'error',
      'security/detect-child-process': 'error',
      'security/detect-disable-mustache-escape': 'error',
      'security/detect-eval-with-expression': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-non-literal-regexp': 'error',
      'security/detect-object-injection': 'warn',
      'security/detect-possible-timing-attacks': 'error',
      'security/detect-pseudoRandomBytes': 'error'
    },
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module'
    }
  }
]
