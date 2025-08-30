'use strict'

const Marshall = require('../lib/marshalls/downloads.marshall')
const Warning = require('../lib/helpers/warning')

describe('Downloads Marshall', () => {
  it('should format download count with thousands separator (US style)', async () => {
    const mockPackageRepoUtils = {
      getDownloadInfo: () => Promise.resolve(8354)
    }
    const marshall = new Marshall({ packageRepoUtils: mockPackageRepoUtils })
    const pkg = { packageName: 'test-package' }

    await expect(marshall.validate(pkg)).rejects.toThrow(Warning)
    await expect(marshall.validate(pkg)).rejects.toThrow('8,354 downloads last month')
  })
})
