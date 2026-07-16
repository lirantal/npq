'use strict'

const normalizeMaintainerDomain = require('../lib/helpers/maintainerDomain')

describe('maintainer domain normalization', () => {
  test.each([
    ['multipart public suffix', 'user@mail.example.co.uk', 'example.co.uk'],
    ['nested subdomain', 'user@deep.mail.public-domain.com', 'public-domain.com'],
    ['Unicode IDN', 'user@bücher.de', 'xn--bcher-kva.de'],
    ['casing and trailing dot', 'user@MAIL.Public-Domain.COM.', 'public-domain.com']
  ])('normalizes a %s', (_case, email, expected) => {
    expect(normalizeMaintainerDomain(email)).toBe(expected)
  })

  test.each([
    ['IPv4 literal', 'user@192.0.2.1'],
    ['IPv6 literal', 'user@[2001:db8::1]'],
    ['single-label name', 'user@localhost'],
    ['internal name', 'user@packages.corp'],
    ['reserved delegated domain', 'user@example.com'],
    ['reserved top-level domain', 'user@example.test'],
    ['malformed domain', 'user@bad..example.com']
  ])('rejects a %s', (_case, email) => {
    expect(normalizeMaintainerDomain(email)).toBeNull()
  })
})
