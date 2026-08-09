'use strict'

const {
  CODING_AGENT_ENVIRONMENT_VARIABLES,
  isCodingAgentEnvironment
} = require('../lib/helpers/codingAgentEnvironment')

const expectedSignals = [
  'CLAUDECODE',
  'CLAUDE_CODE_CHILD_SESSION',
  'CURSOR_AGENT',
  'PI_CODING_AGENT',
  'CODEX_SANDBOX',
  'CODEX_THREAD_ID',
  'GEMINI_CLI',
  'WINDSURF_AGENT',
  'CODEIUM_AGENT',
  'AGENT',
  'AI_AGENT'
]

describe('coding-agent environment detection', () => {
  test('exports the complete supported signal list', () => {
    expect(CODING_AGENT_ENVIRONMENT_VARIABLES).toEqual(expectedSignals)
  })

  test.each(expectedSignals)('detects %s when it is non-empty', (name) => {
    expect(isCodingAgentEnvironment({ [name]: '1' })).toBe(true)
  })

  test('accepts names, paths, and identifiers as signal values', () => {
    expect(isCodingAgentEnvironment({ AGENT: 'amp' })).toBe(true)
    expect(isCodingAgentEnvironment({ CODEX_SANDBOX: '/sandbox/workspace' })).toBe(true)
    expect(isCodingAgentEnvironment({ CODEX_THREAD_ID: 'thread-123' })).toBe(true)
  })

  test.each(expectedSignals)('ignores an empty %s value', (name) => {
    expect(isCodingAgentEnvironment({ [name]: '' })).toBe(false)
  })

  test('ignores missing and unrelated variables', () => {
    expect(isCodingAgentEnvironment({})).toBe(false)
    expect(isCodingAgentEnvironment({ CI: 'true', TERM_PROGRAM: 'vscode' })).toBe(false)
  })
})
