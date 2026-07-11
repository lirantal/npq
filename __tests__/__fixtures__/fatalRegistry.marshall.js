'use strict'

const BaseMarshall = require('../../lib/marshalls/baseMarshall')
const { RegistryError } = require('../../lib/helpers/registryErrors')

class FatalRegistryMarshall extends BaseMarshall {
  constructor(options) {
    super(options)
    this.name = 'fatal-registry'
  }

  title() {
    return 'Testing fatal registry propagation'
  }

  validate() {
    return Promise.reject(
      new RegistryError('Registry network request failed', {
        registry: 'https://artifactory.example.test/api/npm/npm/',
        code: 'EREGISTRYNETWORK'
      })
    )
  }
}

module.exports = FatalRegistryMarshall
