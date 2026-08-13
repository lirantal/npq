'use strict'

const CODING_AGENT_ENVIRONMENT_VARIABLES = Object.freeze([
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
])

function hasNonEmptyValue(env, name) {
  return typeof env[name] === 'string' && env[name].length > 0
}

function isCodingAgentEnvironment(env = process.env, { stdoutIsTTY = process.stdout?.isTTY } = {}) {
  if (CODING_AGENT_ENVIRONMENT_VARIABLES.some((name) => hasNonEmptyValue(env, name))) {
    return true
  }

  if (typeof env.PATH === 'string' && /\.pi[\\/]agent/.test(env.PATH)) {
    return true
  }

  if (typeof env.EDITOR === 'string' && /devin/i.test(env.EDITOR)) {
    return true
  }

  return !stdoutIsTTY && typeof env.TERM_PROGRAM === 'string' && /kiro/i.test(env.TERM_PROGRAM)
}

module.exports = { CODING_AGENT_ENVIRONMENT_VARIABLES, isCodingAgentEnvironment }
