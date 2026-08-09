'use strict'

const {
  DEFAULT_TIMEOUT_MS,
  IANA_DNS_BOOTSTRAP_URL,
  RdapClient,
  rdapStatuses
} = require('../lib/helpers/rdapClient')

function response(status, body, url) {
  return {
    ok: status >= 200 && status < 300,
    status,
    url,
    json: jest.fn().mockResolvedValue(body)
  }
}

function bootstrap(endpoint = 'https://rdap.registry.example/') {
  return {
    services: [[['com'], [endpoint]]]
  }
}

describe('RDAP client', () => {
  test('routes a domain through the official IANA DNS bootstrap registry', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(response(200, bootstrap()))
      .mockResolvedValueOnce(response(200, { objectClassName: 'domain' }))
    const client = new RdapClient({ fetcher })

    await expect(client.lookup('example.com')).resolves.toEqual({
      status: rdapStatuses.Registered
    })

    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      IANA_DNS_BOOTSTRAP_URL,
      expect.objectContaining({
        redirect: 'error',
        signal: expect.any(AbortSignal)
      })
    )
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      'https://rdap.registry.example/domain/example.com',
      expect.objectContaining({
        headers: { accept: 'application/rdap+json, application/json' }
      })
    )
  })

  test('classifies an authoritative 404 as no active registration found', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(response(200, bootstrap()))
      .mockResolvedValueOnce(response(404))
    const client = new RdapClient({ fetcher })

    await expect(client.lookup('example.com')).resolves.toEqual({
      status: rdapStatuses.NotFound
    })
  })

  test.each([
    ['missing bootstrap support', { services: [] }, undefined],
    ['non-HTTPS bootstrap target', bootstrap('http://rdap.registry.example/'), undefined],
    ['invalid bootstrap target', bootstrap('not a URL'), undefined],
    ['rate limiting', bootstrap(), response(429)],
    ['other HTTP failure', bootstrap(), response(503)],
    ['invalid domain object', bootstrap(), response(200, { objectClassName: 'entity' })],
    ['missing domain object', bootstrap(), response(200, null)]
  ])('classifies %s as inconclusive', async (_case, bootstrapBody, domainResponse) => {
    const fetcher = jest.fn().mockResolvedValueOnce(response(200, bootstrapBody))
    if (domainResponse) {
      fetcher.mockResolvedValueOnce(domainResponse)
    }
    const client = new RdapClient({ fetcher })

    await expect(client.lookup('example.com')).resolves.toEqual(
      expect.objectContaining({ status: rdapStatuses.Inconclusive })
    )
  })

  test('classifies malformed JSON as inconclusive', async () => {
    const malformedResponse = response(200)
    malformedResponse.json.mockRejectedValue(new SyntaxError('invalid JSON'))
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(response(200, bootstrap()))
      .mockResolvedValueOnce(malformedResponse)
    const client = new RdapClient({ fetcher })

    await expect(client.lookup('example.com')).resolves.toEqual(
      expect.objectContaining({ status: rdapStatuses.Inconclusive })
    )
  })

  test.each([
    ['HTTP failure', response(503)],
    ['invalid document', response(200, {})]
  ])('classifies a bootstrap %s as inconclusive', async (_case, bootstrapResponse) => {
    const fetcher = jest.fn().mockResolvedValueOnce(bootstrapResponse)
    const client = new RdapClient({ fetcher })

    await expect(client.lookup('example.com')).resolves.toEqual(
      expect.objectContaining({ status: rdapStatuses.Inconclusive })
    )
  })

  test('ignores malformed and unrelated bootstrap services', async () => {
    const fetcher = jest.fn().mockResolvedValueOnce(
      response(200, {
        services: [null, [['net'], ['https://rdap.registry.example/']]]
      })
    )
    const client = new RdapClient({ fetcher })

    await expect(client.lookup('example.com')).resolves.toEqual(
      expect.objectContaining({ status: rdapStatuses.Inconclusive })
    )
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  test('rejects direct non-HTTPS requests', () => {
    const client = new RdapClient({ fetcher: jest.fn() })

    expect(() => client.request('http://rdap.registry.example/domain/example.com')).toThrow(
      'RDAP requests must use HTTPS'
    )
  })

  test('enforces HTTPS for an injected bootstrap URL', async () => {
    const fetcher = jest.fn()
    const client = new RdapClient({
      fetcher,
      bootstrapUrl: 'http://data.iana.org/rdap/dns.json'
    })

    await expect(client.lookup('example.com')).resolves.toEqual(
      expect.objectContaining({ status: rdapStatuses.Inconclusive })
    )
    expect(fetcher).not.toHaveBeenCalled()
  })

  test('applies a per-request timeout', async () => {
    const fetcher = jest.fn((_url, { signal }) => {
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true })
      })
    })
    const client = new RdapClient({ fetcher, timeoutMs: 5 })

    await expect(client.lookup('example.com')).resolves.toEqual(
      expect.objectContaining({ status: rdapStatuses.Inconclusive })
    )
    expect(DEFAULT_TIMEOUT_MS).toBe(3000)
  })

  test('caches bootstrap and domain promises for the client lifetime', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(response(200, bootstrap()))
      .mockResolvedValueOnce(response(404))
      .mockResolvedValueOnce(response(200, { objectClassName: 'domain' }))
    const client = new RdapClient({ fetcher })

    const firstLookup = client.lookup('example.com')
    const duplicateLookup = client.lookup('EXAMPLE.COM')
    expect(duplicateLookup).toBe(firstLookup)

    await expect(Promise.all([firstLookup, client.lookup('other.com')])).resolves.toEqual([
      { status: rdapStatuses.NotFound },
      { status: rdapStatuses.Registered }
    ])
    expect(fetcher).toHaveBeenCalledTimes(3)
  })
})
