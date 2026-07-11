'use strict'

class NotEvaluated extends Error {
  constructor(message, { capability = null } = {}) {
    super(message)
    this.name = 'NotEvaluated'
    this.capability = capability
  }
}

module.exports = NotEvaluated
