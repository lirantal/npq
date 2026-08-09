'use strict'

function createJsonOutput(write = (value, callback) => process.stdout.write(value, callback)) {
  let written = false

  return {
    write(report, onComplete) {
      if (written) return false
      written = true
      const serialized = `${JSON.stringify(report)}\n`
      if (typeof onComplete === 'function') {
        write(serialized, onComplete)
      } else {
        write(serialized)
      }
      return true
    },
    hasWritten() {
      return written
    }
  }
}

module.exports = { createJsonOutput }
