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
  'AI_AGENT',
  'CLAUDE_CODE',
  'REPL_ID',
  'OPENCODE',
  'AUGMENT_AGENT',
  'GOOSE_PROVIDER',
  'JUNIE_DATA',
  'JUNIE_SHIM_PATH'
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

  test('detects Pi from a POSIX agent path', () => {
    expect(isCodingAgentEnvironment({ PATH: '/home/user/.pi/agent/bin' })).toBe(true)
  })

  test('detects Pi from a Windows agent path', () => {
    expect(isCodingAgentEnvironment({ PATH: String.raw`C:\Users\user\.pi\agent\bin` })).toBe(true)
  })

  test('does not detect Pi from an unrelated path', () => {
    expect(isCodingAgentEnvironment({ PATH: '/home/user/.pilot/bin' })).toBe(false)
  })

  test('detects Devin from the editor name case-insensitively', () => {
    expect(isCodingAgentEnvironment({ EDITOR: '/usr/local/bin/DeViN' })).toBe(true)
  })

  test('does not detect Devin from an unrelated editor', () => {
    expect(isCodingAgentEnvironment({ EDITOR: '/usr/bin/code' })).toBe(false)
  })

  test('detects Kiro only when stdout is not a TTY', () => {
    const env = { TERM_PROGRAM: 'Kiro' }

    expect(isCodingAgentEnvironment(env, { stdoutIsTTY: false })).toBe(true)
    expect(isCodingAgentEnvironment(env, { stdoutIsTTY: true })).toBe(false)
  })

  test('does not detect Kiro from an unrelated terminal program', () => {
    expect(isCodingAgentEnvironment({ TERM_PROGRAM: 'vscode' }, { stdoutIsTTY: false })).toBe(false)
  })
})
