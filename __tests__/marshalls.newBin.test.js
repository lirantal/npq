'use strict'

const NewBinMarshall = require('../lib/marshalls/newbin.marshall')
const PackageRepoUtils = require('../lib/helpers/packageRepoUtils')

jest.mock('../lib/helpers/packageRepoUtils')

describe('NewBinMarshall', () => {
  let packageRepoUtilsMock
  let newBinMarshall

  beforeEach(() => {
    packageRepoUtilsMock = new PackageRepoUtils()
    newBinMarshall = new NewBinMarshall({ packageRepoUtils: packageRepoUtilsMock })

    // Mock context and task for the marshall
    newBinMarshall.init(
      {
        marshalls: {
          newBin: {
            status: null,
            errors: [],
            warnings: [],
            data: {}
          }
        },
        pkgs: [] // Not directly used by validate but part of ctx
      },
      { output: '' } // Mock task object
    )
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  const mockPackageInfo = (packageName, versions) => {
    const fullPackageData = {
      name: packageName,
      versions: {},
      'dist-tags': {}
    }
    let latestTag = null
    Object.keys(versions).forEach((vStr) => {
      fullPackageData.versions[vStr] = {
        name: packageName,
        version: vStr,
        bin: versions[vStr].bin
        // other fields like scripts, dependencies might be needed if other marshalls run
      }
      if (!latestTag || require('semver').gt(vStr, latestTag)) {
        latestTag = vStr
      }
    })
    if (latestTag) {
      fullPackageData['dist-tags'].latest = latestTag
    }
    return fullPackageData
  }

  test('should return correct title', () => {
    const newBinMarshall = new NewBinMarshall({
      packageRepoUtils: null
    })

    const title = newBinMarshall.title()
    expect(title).toBe('Checking for new binaries introduced in package.json')
  })

  it('should pass if no previous version exists', async () => {
    const pkg = {
      packageName: 'test-pkg',
      packageVersion: '1.0.0',
      packageString: 'test-pkg@1.0.0'
    }
    const versions = {
      '1.0.0': { bin: { 'my-cli': 'cli.js' } }
    }
    packageRepoUtilsMock.getPackageInfo.mockResolvedValue(mockPackageInfo('test-pkg', versions))
    packageRepoUtilsMock.parsePackageVersion.mockImplementation((version) => ({ version }))

    await expect(newBinMarshall.validate(pkg)).resolves.toBeUndefined()
    expect(newBinMarshall.ctx.marshalls.newBin.warnings).toHaveLength(0)
  })

  it('should pass if bin field is the same', async () => {
    const pkg = {
      packageName: 'test-pkg',
      packageVersion: '1.0.1',
      packageString: 'test-pkg@1.0.1'
    }
    const versions = {
      '1.0.0': { bin: { 'my-cli': 'cli.js' } },
      '1.0.1': { bin: { 'my-cli': 'cli.js' } }
    }
    packageRepoUtilsMock.getPackageInfo.mockResolvedValue(mockPackageInfo('test-pkg', versions))
    packageRepoUtilsMock.parsePackageVersion.mockImplementation((version) => ({ version }))

    await expect(newBinMarshall.validate(pkg)).resolves.toBeUndefined()
    expect(newBinMarshall.ctx.marshalls.newBin.warnings).toHaveLength(0)
  })

  it('should warn if a new binary is introduced (object format)', async () => {
    const pkg = {
      packageName: 'test-pkg',
      packageVersion: '1.0.1',
      packageString: 'test-pkg@1.0.1'
    }
    const versions = {
      '1.0.0': { bin: { 'old-cli': 'old.js' } },
      '1.0.1': { bin: { 'old-cli': 'old.js', 'new-cli': 'new.js' } }
    }
    packageRepoUtilsMock.getPackageInfo.mockResolvedValue(mockPackageInfo('test-pkg', versions))
    packageRepoUtilsMock.parsePackageVersion.mockImplementation((version) => ({ version }))

    await expect(newBinMarshall.validate(pkg)).rejects.toThrow(
      'New binaries detected for test-pkg@1.0.1'
    )
    expect(newBinMarshall.ctx.marshalls.newBin.warnings).toHaveLength(1)
    expect(newBinMarshall.ctx.marshalls.newBin.warnings[0].message).toContain(
      "introduces a new binary 'new-cli'"
    )
    expect(newBinMarshall.ctx.marshalls.newBin.warnings[0].message).toContain(
      "compared to version '1.0.0'"
    )
  })

  it('should warn if a new binary is introduced (string format to object)', async () => {
    const pkg = {
      packageName: 'test-pkg',
      packageVersion: '1.0.1',
      packageString: 'test-pkg@1.0.1'
    }
    // Previous version has string bin, new one has object bin
    const versions = {
      '1.0.0': { bin: 'old.js' }, // This will be normalized to { 'test-pkg': 'old.js' }
      '1.0.1': { bin: { 'test-pkg': 'old.js', 'new-cli': 'new.js' } }
    }
    packageRepoUtilsMock.getPackageInfo.mockResolvedValue(mockPackageInfo('test-pkg', versions))
    packageRepoUtilsMock.parsePackageVersion.mockImplementation((version) => ({ version }))

    await expect(newBinMarshall.validate(pkg)).rejects.toThrow(
      'New binaries detected for test-pkg@1.0.1'
    )
    expect(newBinMarshall.ctx.marshalls.newBin.warnings).toHaveLength(1)
    expect(newBinMarshall.ctx.marshalls.newBin.warnings[0].message).toContain(
      "introduces a new binary 'new-cli'"
    )
  })

  it('should warn if a new binary is introduced (string format for both, new name)', async () => {
    // This case implies the package name itself changed or the bin refers to a different command name
    // For this marshall, we primarily care about new keys in the (normalized) bin object.
    // If package name changes, it's a different package, not really a "new bin" for the *same* package.
    // However, if `bin` was a string `old-bin-name.js` and becomes `new-bin-name.js`,
    // and assuming the package name (key) remains the same, this is not a *new* binary key.
    // This test will check introduction of a string bin when there was none.
    const pkg = {
      packageName: 'test-pkg',
      packageVersion: '1.0.1',
      packageString: 'test-pkg@1.0.1'
    }
    const versions = {
      '1.0.0': { bin: null }, // No bin before
      '1.0.1': { bin: 'new.js' } // New bin (string)
    }
    packageRepoUtilsMock.getPackageInfo.mockResolvedValue(mockPackageInfo('test-pkg', versions))
    packageRepoUtilsMock.parsePackageVersion.mockImplementation((version) => ({ version }))

    await expect(newBinMarshall.validate(pkg)).rejects.toThrow(
      'New binaries detected for test-pkg@1.0.1'
    )
    expect(newBinMarshall.ctx.marshalls.newBin.warnings).toHaveLength(1)
    expect(newBinMarshall.ctx.marshalls.newBin.warnings[0].message).toContain(
      "introduces a new binary 'test-pkg'"
    )
    expect(newBinMarshall.ctx.marshalls.newBin.warnings[0].message).toContain("command: 'new.js'")
  })

  it('should pass if a binary is removed', async () => {
    const pkg = {
      packageName: 'test-pkg',
      packageVersion: '1.0.1',
      packageString: 'test-pkg@1.0.1'
    }
    const versions = {
      '1.0.0': { bin: { 'old-cli': 'old.js', 'to-remove': 'remove.js' } },
      '1.0.1': { bin: { 'old-cli': 'old.js' } }
    }
    packageRepoUtilsMock.getPackageInfo.mockResolvedValue(mockPackageInfo('test-pkg', versions))
    packageRepoUtilsMock.parsePackageVersion.mockImplementation((version) => ({ version }))

    await expect(newBinMarshall.validate(pkg)).resolves.toBeUndefined()
    expect(newBinMarshall.ctx.marshalls.newBin.warnings).toHaveLength(0)
  })

  it('should pass if bin changes from string to object but represents the same binary', async () => {
    const pkg = {
      packageName: 'test-pkg',
      packageVersion: '1.0.1',
      packageString: 'test-pkg@1.0.1'
    }
    const versions = {
      '1.0.0': { bin: 'cli.js' }, // Normalized: { 'test-pkg': 'cli.js' }
      '1.0.1': { bin: { 'test-pkg': 'cli.js' } }
    }
    packageRepoUtilsMock.getPackageInfo.mockResolvedValue(mockPackageInfo('test-pkg', versions))
    packageRepoUtilsMock.parsePackageVersion.mockImplementation((version) => ({ version }))

    await expect(newBinMarshall.validate(pkg)).resolves.toBeUndefined()
    expect(newBinMarshall.ctx.marshalls.newBin.warnings).toHaveLength(0)
  })

  it('should pass if bin changes from object to string but represents the same binary', async () => {
    const pkg = {
      packageName: 'test-pkg',
      packageVersion: '1.0.1',
      packageString: 'test-pkg@1.0.1'
    }
    const versions = {
      '1.0.0': { bin: { 'test-pkg': 'cli.js' } },
      '1.0.1': { bin: 'cli.js' } // Normalized: { 'test-pkg': 'cli.js' }
    }
    packageRepoUtilsMock.getPackageInfo.mockResolvedValue(mockPackageInfo('test-pkg', versions))
    packageRepoUtilsMock.parsePackageVersion.mockImplementation((version) => ({ version }))

    await expect(newBinMarshall.validate(pkg)).resolves.toBeUndefined()
    expect(newBinMarshall.ctx.marshalls.newBin.warnings).toHaveLength(0)
  })

  it('should handle package version being a dist-tag like "latest"', async () => {
    const pkg = {
      packageName: 'test-pkg',
      packageVersion: 'latest',
      packageString: 'test-pkg@latest'
    }
    const versions = {
      '1.0.0': { bin: { 'my-cli': 'cli.js' } },
      '1.0.1': { bin: { 'my-cli': 'cli.js', 'new-cli': 'new.js' } } // latest points to 1.0.1
    }
    const mockPkgInfo = mockPackageInfo('test-pkg', versions)
    packageRepoUtilsMock.getPackageInfo.mockResolvedValue(mockPkgInfo)
    // The 'latest' tag will be resolved using dist-tags in the mock data

    await expect(newBinMarshall.validate(pkg)).rejects.toThrow(
      'New binaries detected for test-pkg@latest'
    )
    expect(newBinMarshall.ctx.marshalls.newBin.warnings).toHaveLength(1)
    expect(newBinMarshall.ctx.marshalls.newBin.warnings[0].message).toContain(
      "introduces a new binary 'new-cli'"
    )
    expect(newBinMarshall.ctx.marshalls.newBin.warnings[0].message).toContain(
      "compared to version '1.0.0'"
    )
  })

  it('should pass if package info cannot be fetched', async () => {
    const pkg = {
      packageName: 'test-pkg',
      packageVersion: '1.0.0',
      packageString: 'test-pkg@1.0.0'
    }
    packageRepoUtilsMock.getPackageInfo.mockResolvedValue(null) // Simulate failed fetch
    packageRepoUtilsMock.parsePackageVersion.mockImplementation((version) => ({ version }))

    await expect(newBinMarshall.validate(pkg)).resolves.toBeUndefined()
    expect(newBinMarshall.ctx.marshalls.newBin.warnings).toHaveLength(0)
  })

  it('should pass if target version string cannot be resolved', async () => {
    const pkg = {
      packageName: 'test-pkg',
      packageVersion: 'nonexistent-tag',
      packageString: 'test-pkg@nonexistent-tag'
    }
    const versions = { '1.0.0': { bin: 'cli.js' } }
    packageRepoUtilsMock.getPackageInfo.mockResolvedValue(mockPackageInfo('test-pkg', versions))
    packageRepoUtilsMock.parsePackageVersion.mockReturnValue(null) // Simulate version not resolving

    await expect(newBinMarshall.validate(pkg)).resolves.toBeUndefined()
    expect(newBinMarshall.ctx.marshalls.newBin.warnings).toHaveLength(0)
  })

  it('should handle multiple new binaries being introduced', async () => {
    const pkg = {
      packageName: 'test-pkg',
      packageVersion: '1.0.1',
      packageString: 'test-pkg@1.0.1'
    }
    const versions = {
      '1.0.0': { bin: { 'old-cli': 'old.js' } },
      '1.0.1': { bin: { 'old-cli': 'old.js', 'new-cli-1': 'new1.js', 'new-cli-2': 'new2.js' } }
    }
    packageRepoUtilsMock.getPackageInfo.mockResolvedValue(mockPackageInfo('test-pkg', versions))
    packageRepoUtilsMock.parsePackageVersion.mockImplementation((version) => ({ version }))

    await expect(newBinMarshall.validate(pkg)).rejects.toThrow(
      'New binaries detected for test-pkg@1.0.1'
    )
    expect(newBinMarshall.ctx.marshalls.newBin.warnings).toHaveLength(2)
    expect(newBinMarshall.ctx.marshalls.newBin.warnings[0].message).toContain(
      "introduces a new binary 'new-cli-1'"
    )
    expect(newBinMarshall.ctx.marshalls.newBin.warnings[1].message).toContain(
      "introduces a new binary 'new-cli-2'"
    )
  })

  it('should pass if the new version has no bin field but old one did', async () => {
    const pkg = {
      packageName: 'test-pkg',
      packageVersion: '1.0.1',
      packageString: 'test-pkg@1.0.1'
    }
    const versions = {
      '1.0.0': { bin: { 'old-cli': 'old.js' } },
      '1.0.1': { bin: null } // No bin in new version
    }
    packageRepoUtilsMock.getPackageInfo.mockResolvedValue(mockPackageInfo('test-pkg', versions))
    packageRepoUtilsMock.parsePackageVersion.mockImplementation((version) => ({ version }))

    await expect(newBinMarshall.validate(pkg)).resolves.toBeUndefined()
    expect(newBinMarshall.ctx.marshalls.newBin.warnings).toHaveLength(0)
  })

  it('should correctly use package name from version data for string bin normalization', async () => {
    // Scenario: pkg.packageName might be different from the actual name in package.json (e.g. alias)
    // The marshall should use the name from the fetched package.json for normalization.
    const pkg = {
      packageName: 'alias-pkg',
      packageVersion: '1.0.1',
      packageString: 'alias-pkg@1.0.1'
    }
    const actualPackageName = 'actual-pkg-name'

    // Mock getPackageInfo to return versions with the actual package name
    const versions = {
      '1.0.0': { bin: null }, // No bin in old version
      '1.0.1': { bin: 'cli.js' } // Bin is a string, should be keyed by actualPackageName
    }
    const mockPkgData = mockPackageInfo(actualPackageName, versions) // mockPackageInfo uses the name for versions too

    packageRepoUtilsMock.getPackageInfo.mockResolvedValue(mockPkgData)
    packageRepoUtilsMock.parsePackageVersion.mockImplementation((version) => ({ version }))

    await expect(newBinMarshall.validate(pkg)).rejects.toThrow(
      `New binaries detected for ${pkg.packageString}`
    )
    expect(newBinMarshall.ctx.marshalls.newBin.warnings).toHaveLength(1)
    // Check that the binary name used in the warning is the actualPackageName
    expect(newBinMarshall.ctx.marshalls.newBin.warnings[0].message).toContain(
      `introduces a new binary '${actualPackageName}'`
    )
    expect(newBinMarshall.ctx.marshalls.newBin.warnings[0].message).toContain(`command: 'cli.js'`)
  })

  it('should use pkg.packageName when newVersionData.name is falsy (line 40 coverage)', async () => {
    const pkg = {
      packageName: 'fallback-pkg',
      packageVersion: '1.0.1',
      packageString: 'fallback-pkg@1.0.1'
    }
    const versions = {
      '1.0.0': { bin: null },
      '1.0.1': { bin: 'cli.js' } // This version will have name: falsy
    }
    const mockPkgData = mockPackageInfo('fallback-pkg', versions)
    // Set name to falsy to test the fallback in line 40: newVersionData.name || pkg.packageName
    mockPkgData.versions['1.0.1'].name = ''

    packageRepoUtilsMock.getPackageInfo.mockResolvedValue(mockPkgData)
    packageRepoUtilsMock.parsePackageVersion.mockImplementation((version) => ({ version }))

    await expect(newBinMarshall.validate(pkg)).rejects.toThrow(
      'New binaries detected for fallback-pkg@1.0.1'
    )
    expect(newBinMarshall.ctx.marshalls.newBin.warnings).toHaveLength(1)
    expect(newBinMarshall.ctx.marshalls.newBin.warnings[0].message).toContain(
      "introduces a new binary 'fallback-pkg'"
    )
    expect(newBinMarshall.ctx.marshalls.newBin.warnings[0].message).toContain("command: 'cli.js'")
  })

  it('should use pkg.packageName when previousVersionData.name is falsy (line 56 coverage)', async () => {
    const pkg = {
      packageName: 'fallback-pkg',
      packageVersion: '1.0.1',
      packageString: 'fallback-pkg@1.0.1'
    }
    const versions = {
      '1.0.0': { bin: 'old.js' }, // This version will have name: falsy
      '1.0.1': { bin: { 'fallback-pkg': 'old.js', 'new-cli': 'new.js' } }
    }
    const mockPkgData = mockPackageInfo('fallback-pkg', versions)
    // Set name to falsy to test the fallback in line 56: previousVersionData.name || pkg.packageName
    mockPkgData.versions['1.0.0'].name = undefined

    packageRepoUtilsMock.getPackageInfo.mockResolvedValue(mockPkgData)
    packageRepoUtilsMock.parsePackageVersion.mockImplementation((version) => ({ version }))

    await expect(newBinMarshall.validate(pkg)).rejects.toThrow(
      'New binaries detected for fallback-pkg@1.0.1'
    )
    expect(newBinMarshall.ctx.marshalls.newBin.warnings).toHaveLength(1)
    expect(newBinMarshall.ctx.marshalls.newBin.warnings[0].message).toContain(
      "introduces a new binary 'new-cli'"
    )
  })

  it('should use pkg.packageName when both version data names are falsy (covers both lines)', async () => {
    const pkg = {
      packageName: 'double-fallback-pkg',
      packageVersion: '1.0.1',
      packageString: 'double-fallback-pkg@1.0.1'
    }
    const versions = {
      '1.0.0': { bin: null },
      '1.0.1': { bin: 'cli.js' }
    }
    const mockPkgData = mockPackageInfo('double-fallback-pkg', versions)
    // Set both names to falsy values to test both fallbacks
    mockPkgData.versions['1.0.0'].name = null
    mockPkgData.versions['1.0.1'].name = ''

    packageRepoUtilsMock.getPackageInfo.mockResolvedValue(mockPkgData)
    packageRepoUtilsMock.parsePackageVersion.mockImplementation((version) => ({ version }))

    await expect(newBinMarshall.validate(pkg)).rejects.toThrow(
      'New binaries detected for double-fallback-pkg@1.0.1'
    )
    expect(newBinMarshall.ctx.marshalls.newBin.warnings).toHaveLength(1)
    expect(newBinMarshall.ctx.marshalls.newBin.warnings[0].message).toContain(
      "introduces a new binary 'double-fallback-pkg'"
    )
    expect(newBinMarshall.ctx.marshalls.newBin.warnings[0].message).toContain("command: 'cli.js'")
  })
})
