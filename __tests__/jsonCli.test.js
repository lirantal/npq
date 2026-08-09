'use strict'

const { EventEmitter } = require('node:events')
const { createJsonOutput } = require('../lib/helpers/jsonOutput')
const { buildJsonReport } = require('../lib/helpers/jsonReport')
const { AUDIT_FAILURE_CODES } = require('../lib/helpers/auditFailure')
const { runJsonCli, writeInvalidJsonInvocation } = require('../lib/jsonCli')

function createProcessTarget() {
  const processTarget = new EventEmitter()
  processTarget.exit = jest.fn()
  return processTarget
}

describe('runJsonCli', () => {
  test('writes one report, assigns its exit code, and removes the SIGINT listener', async () => {
    const write = jest.fn()
    const output = createJsonOutput(write)
    const processTarget = createProcessTarget()
    const report = buildJsonReport({ packages: ['express@latest'] })
    const runJsonAudit = jest.fn().mockResolvedValue(report)
    const exitCodeForJsonReport = jest.fn().mockReturnValue(7)

    await expect(
      runJsonCli(
        { packages: ['express@latest'] },
        { output, processTarget, runJsonAudit, exitCodeForJsonReport }
      )
    ).resolves.toBe(report)

    expect(write).toHaveBeenCalledTimes(1)
    expect(write).toHaveBeenCalledWith(`${JSON.stringify(report)}\n`)
    expect(processTarget.exitCode).toBe(7)
    expect(processTarget.listenerCount('SIGINT')).toBe(0)
  })

  test('maps a rejected injected audit to a safe internal failure', async () => {
    const write = jest.fn()
    const output = createJsonOutput(write)
    const processTarget = createProcessTarget()
    const runJsonAudit = jest
      .fn()
      .mockRejectedValue(new Error('credential leaked from /secret/path'))

    const report = await runJsonCli(
      { packages: ['express@latest'] },
      { output, processTarget, runJsonAudit }
    )

    expect(report.failures).toEqual([
      {
        code: AUDIT_FAILURE_CODES.INTERNAL_ERROR,
        message: 'JSON audit could not complete'
      }
    ])
    expect(write).toHaveBeenCalledTimes(1)
    expect(write.mock.calls[0][0]).not.toContain('credential')
    expect(write.mock.calls[0][0]).not.toContain('/secret/path')
    expect(processTarget.exitCode).toBe(2)
    expect(processTarget.listenerCount('SIGINT')).toBe(0)
  })

  test('writes interruption once and does not let later audit completion overwrite it', async () => {
    const write = jest.fn()
    const output = createJsonOutput(write)
    const processTarget = createProcessTarget()
    let finishAudit
    const runJsonAudit = jest.fn().mockReturnValue(
      new Promise((resolve) => {
        finishAudit = resolve
      })
    )

    const run = runJsonCli(
      { packages: ['express@latest'] },
      { output, processTarget, runJsonAudit }
    )
    processTarget.emit('SIGINT')
    const cleanReport = buildJsonReport({ packages: ['express@latest'] })
    finishAudit(cleanReport)
    const report = await run

    expect(report.failures).toEqual([
      { code: AUDIT_FAILURE_CODES.INTERRUPTED, message: 'Audit interrupted' }
    ])
    expect(write).toHaveBeenCalledTimes(1)
    expect(JSON.parse(write.mock.calls[0][0]).failures).toEqual(report.failures)
    expect(processTarget.exit).toHaveBeenCalledTimes(1)
    expect(processTarget.exit).toHaveBeenCalledWith(2)
    expect(processTarget.exitCode).toBeUndefined()
    expect(processTarget.listenerCount('SIGINT')).toBe(0)
  })
})

describe('writeInvalidJsonInvocation', () => {
  test('writes an invalid input report once', () => {
    const write = jest.fn()
    const output = createJsonOutput(write)

    const report = writeInvalidJsonInvocation(output)

    expect(report.failures).toEqual([
      {
        code: AUDIT_FAILURE_CODES.INVALID_INPUT,
        message: 'Invalid package or option argument'
      }
    ])
    expect(write).toHaveBeenCalledTimes(1)
    expect(write).toHaveBeenCalledWith(`${JSON.stringify(report)}\n`)
  })
})
