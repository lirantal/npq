'use strict'

const BaseMarshall = require('../../lib/marshalls/baseMarshall')

class JsonDebugMarshall extends BaseMarshall {
  constructor(options) {
    super(options)
    this.name = 'json-debug'
  }

  title() {
    return 'JSON debug output test'
  }

  validate() {
    this.debug('credential=https://user:secret@example.test /private/project')
    return Promise.resolve()
  }
}

module.exports = JsonDebugMarshall
