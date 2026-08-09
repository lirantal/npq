'use strict'

const {
  isSimpleMaintainerDomain,
  normalizeMaintainerDomain
} = require('../lib/helpers/maintainerDomain')

describe('maintainer domain normalization', () => {
  test.each([
    ['multipart public suffix', 'user@mail.example.co.uk', 'mail.example.co.uk'],
    ['nested subdomain', 'user@deep.mail.public-domain.com', 'deep.mail.public-domain.com'],
    ['Unicode IDN', 'user@bücher.de', 'xn--bcher-kva.de'],
    ['casing and trailing dot', 'user@MAIL.Public-Domain.COM.', 'mail.public-domain.com']
  ])('normalizes a %s', (_case, email, expected) => {
    expect(normalizeMaintainerDomain(email)).toBe(expected)
  })

  test.each([
    ['two-label domain', 'public-domain.com', true],
    ['multipart suffix', 'example.co.uk', false],
    ['mail subdomain', 'mail.public-domain.com', false]
  ])('classifies a %s conservatively', (_case, domain, expected) => {
    expect(isSimpleMaintainerDomain(domain)).toBe(expected)
  })

  test.each([
    ['IPv4 literal', 'user@192.0.2.1'],
    ['IPv6 literal', 'user@[2001:db8::1]'],
    ['Unicode IPv4 literal', 'user@１２７.０.０.１'],
    ['hexadecimal IPv4 literal', 'user@0x7f000001'],
    ['multiple at signs', 'user@alias@public-domain.com'],
    ['single-label name', 'user@localhost'],
    ['internal name', 'user@packages.corp'],
    ['reserved delegated domain', 'user@example.com'],
    ['reserved top-level domain', 'user@example.test'],
    ['empty label', 'user@bad..public-domain.com'],
    ['leading hyphen', 'user@-bad.com'],
    ['trailing hyphen', 'user@bad-.com'],
    ['multiple trailing dots', 'user@public-domain.com..']
  ])('rejects a %s', (_case, email) => {
    expect(normalizeMaintainerDomain(email)).toBeNull()
  })
})
