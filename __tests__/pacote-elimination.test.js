'use strict'

describe('Pacote Dependency Elimination', () => {
  let originalEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
    jest.clearAllMocks()
    
    // Clear module cache to ensure fresh imports
    Object.keys(require.cache).forEach(key => {
      if (key.includes('pacote') || key.includes('marshall')) {
        delete require.cache[key]
      }
    })
  })

  afterEach(() => {
    process.env = originalEnv
  })

  test('should work without loading pacote when both signature and provenance are disabled', async () => {
    // Set environment variables to disable both pacote-using marshalls
    process.env.MARSHALL_DISABLE_SIGNATURES = 'true'
    process.env.MARSHALL_DISABLE_PROVENANCE = 'true'

    // Mock require to track if pacote is loaded
    const originalRequire = require
    const pacoteLoadAttempts = []
    
    // Override require globally to track pacote loading attempts
    const Module = require('module')
    const originalLoad = Module._load
    Module._load = function(request, parent) {
      if (request === 'pacote') {
        pacoteLoadAttempts.push({ request, parent: parent ? parent.filename : 'unknown' })
      }
      return originalLoad.apply(this, arguments)
    }

    try {
      // Import and run marshalls with disabled features
      const Marshalls = require('../lib/marshalls')
      
      const options = {
        pkgs: [{
          packageName: 'test-package',
          packageVersion: '1.0.0',
          packageString: 'test-package@1.0.0'
        }],
        packageRepoUtils: {
          getPackageInfo: jest.fn().mockResolvedValue({
            name: 'test-package',
            version: '1.0.0'
          }),
          getDownloadInfo: jest.fn().mockResolvedValue(1000),
          getLicenseInfo: jest.fn().mockResolvedValue('MIT'),
          getReadmeInfo: jest.fn().mockResolvedValue('# Test Package'),
          parsePackageVersion: jest.fn().mockReturnValue({ version: '1.0.0' }),
          isPackageInAllowList: jest.fn().mockReturnValue(false),
          getSemVer: jest.fn().mockResolvedValue('1.0.0'),
          getLatestVersion: jest.fn().mockResolvedValue('1.0.0')
        }
      }

      // Run the marshalls
      const results = await Marshalls.tasks(options)
      
      // Verify that signatures and provenance marshalls were not executed
      const flatResults = results.reduce((acc, result) => ({ ...acc, ...result }), {})
      expect(flatResults.signatures).toBeUndefined()
      expect(flatResults.provenance).toBeUndefined()
      
      // Verify that other marshalls still ran (e.g., typosquatting, age, etc.)
      expect(Object.keys(flatResults).length).toBeGreaterThan(0)
      
      // Most importantly: pacote should not have been loaded
      expect(pacoteLoadAttempts).toHaveLength(0)
      
    } finally {
      // Restore original require
      Module._load = originalLoad
    }
  })

  test('should verify signatures and provenance marshalls exist but can be disabled', () => {
    // Test that the marshalls exist
    const SignaturesMarshall = require('../lib/marshalls/signatures.marshall')
    const ProvenanceMarshall = require('../lib/marshalls/provenance.marshall')
    
    expect(SignaturesMarshall).toBeDefined()
    expect(ProvenanceMarshall).toBeDefined()
    
    // Test that they can be disabled
    const signaturesInstance = new SignaturesMarshall({})
    const provenanceInstance = new ProvenanceMarshall({})
    
    // Enable them by default
    expect(signaturesInstance.isEnabled()).toBe(true)
    expect(provenanceInstance.isEnabled()).toBe(true)
    
    // Disable via environment variables
    process.env.MARSHALL_DISABLE_SIGNATURES = 'true'
    process.env.MARSHALL_DISABLE_PROVENANCE = 'true'
    
    expect(signaturesInstance.isEnabled()).toBe(false)
    expect(provenanceInstance.isEnabled()).toBe(false)
  })

  test('should verify env var names match marshall names', () => {
    // This test ensures our environment variable names are correct
    const SignaturesMarshall = require('../lib/marshalls/signatures.marshall')
    const ProvenanceMarshall = require('../lib/marshalls/provenance.marshall')
    
    const signaturesInstance = new SignaturesMarshall({})
    const provenanceInstance = new ProvenanceMarshall({})
    
    expect(signaturesInstance.name).toBe('signatures')
    expect(provenanceInstance.name).toBe('provenance')
    
    // Verify the environment variable names match
    process.env.MARSHALL_DISABLE_SIGNATURES = 'true'
    expect(signaturesInstance.isEnabled()).toBe(false)
    
    delete process.env.MARSHALL_DISABLE_SIGNATURES
    process.env.MARSHALL_DISABLE_PROVENANCE = 'true'
    expect(provenanceInstance.isEnabled()).toBe(false)
  })
})