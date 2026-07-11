'use strict'

const Marshall = require('../lib/marshalls/downloads.marshall')
const NotEvaluated = require('../lib/helpers/notEvaluated')
const Warning = require('../lib/helpers/warning')

describe('Downloads Marshall', () => {
  it('should format download count with thousands separator (US style)', async () => {
    const mockPackageRepoUtils = {
      getDownloadInfo: () => Promise.resolve(8354)
    }
    const marshall = new Marshall({ packageRepoUtils: mockPackageRepoUtils })
    const pkg = { packageName: 'test-package' }

    const p = marshall.validate(pkg)
    await expect(p).rejects.toThrow(Warning)
    await expect(p).rejects.toThrow('8,354 downloads last month')
  })

  it('records custom-registry download checks as not evaluated', async () => {
    const mockPackageRepoUtils = {
      getDownloadInfo: jest.fn().mockRejectedValue(
        new NotEvaluated('download counts are unavailable for custom registries', {
          capability: 'downloads'
        })
      )
    }
    const marshall = new Marshall({ packageRepoUtils: mockPackageRepoUtils })
    const ctx = {
      pkgs: [{ packageName: '@company/tool', packageString: '@company/tool@1.0.0' }],
      marshalls: {}
    }
    marshall.init(ctx)

    await marshall.run(ctx)

    expect(ctx.marshalls.downloads.errors).toEqual([])
    expect(ctx.marshalls.downloads.warnings).toEqual([])
    expect(ctx.marshalls.downloads.notEvaluated).toEqual([
      {
        pkg: '@company/tool@1.0.0',
        message: 'download counts are unavailable for custom registries'
      }
    ])
  })
})
