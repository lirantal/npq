'use strict'

function createJsonOutput(write = (value) => process.stdout.write(value)) {
  let written = false

  return {
    write(report) {
      if (written) return false
      written = true
      write(`${JSON.stringify(report)}\n`)
      return true
    },
    hasWritten() {
      return written
    }
  }
}

module.exports = { createJsonOutput }
