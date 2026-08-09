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
  'AI_AGENT'
])

function isCodingAgentEnvironment(env = process.env) {
  return CODING_AGENT_ENVIRONMENT_VARIABLES.some(
    (name) => typeof env[name] === 'string' && env[name].length > 0
  )
}

module.exports = { CODING_AGENT_ENVIRONMENT_VARIABLES, isCodingAgentEnvironment }
