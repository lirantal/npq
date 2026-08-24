'use strict'

const {
  getInstallAction,
  createNonInteractiveInstallError
} = require('../lib/helpers/installPolicy')

describe('install policy', () => {
  test.each([
    ['clean interactive', { isInteractive: true }, 'install'],
    ['clean non-interactive', { isInteractive: false }, 'install'],
    [
      'interactive warning countdown',
      { countWarnings: 1, isInteractive: true, disableAutoContinue: false },
      'countdown'
    ],
    [
      'interactive warning prompt when disabled',
      { countWarnings: 1, isInteractive: true, disableAutoContinue: true },
      'prompt'
    ],
    ['interactive errors prompt', { countErrors: 1, isInteractive: true }, 'prompt'],
    [
      'ordinary non-interactive warning rejects',
      { countWarnings: 1, isInteractive: false, allowNonInteractiveInstall: false },
      'reject'
    ],
    [
      'authorized non-interactive warning installs',
      { countWarnings: 1, isInteractive: false, allowNonInteractiveInstall: true },
      'install'
    ],
    [
      'disabled non-interactive warning rejects even when authorized',
      {
        countWarnings: 1,
        isInteractive: false,
        disableAutoContinue: true,
        allowNonInteractiveInstall: true
      },
      'reject'
    ],
    [
      'ordinary non-interactive errors reject',
      { countErrors: 1, isInteractive: false, allowNonInteractiveInstall: true },
      'reject'
    ]
  ])('%s', (_name, options, expected) => {
    expect(getInstallAction(options)).toBe(expected)
  })

  test('creates an exit-code-one non-interactive rejection', () => {
    expect(createNonInteractiveInstallError()).toMatchObject({
      code: 'NON_INTERACTIVE_INSTALL',
      exitCode: 1
    })
  })
})
