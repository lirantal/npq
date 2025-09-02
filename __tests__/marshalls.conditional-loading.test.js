'use strict'

const Marshalls = require('../lib/marshalls')

describe('Conditional Marshall Loading', () => {
  let originalEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
    jest.clearAllMocks()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  test('should include signatures marshall by default', async () => {
    const marshalls = await Marshalls.collectMarshalls()
    const signaturesMarshall = marshalls.find(m => m.includes('signatures.marshall.js'))
    expect(signaturesMarshall).toBeDefined()
  })

  test('should include provenance marshall by default', async () => {
    const marshalls = await Marshalls.collectMarshalls()
    const provenanceMarshall = marshalls.find(m => m.includes('provenance.marshall.js'))
    expect(provenanceMarshall).toBeDefined()
  })

  test('should disable signatures marshall when environment variable is set', async () => {
    process.env.MARSHALL_DISABLE_SIGNATURES = 'true'
    
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
        })
      }
    }

    const marshalls = await Marshalls.collectMarshalls()
    const marshallTasks = await Marshalls.buildMarshallTasks(marshalls, {
      packageRepoUtils: options.packageRepoUtils
    })

    // Find signatures marshall task
    const signaturesTask = marshallTasks.find(task => task.title.includes('Verifying registry signatures'))
    expect(signaturesTask).toBeDefined()
    
    // Execute the task and it should be skipped
    const result = await signaturesTask.execute(options)
    
    // The signatures marshall should not have run (no results for signatures)
    expect(result.marshalls.signatures).toBeUndefined()
  })

  test('should disable provenance marshall when environment variable is set', async () => {
    process.env.MARSHALL_DISABLE_PROVENANCE = 'true'
    
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
        })
      }
    }

    const marshalls = await Marshalls.collectMarshalls()
    const marshallTasks = await Marshalls.buildMarshallTasks(marshalls, {
      packageRepoUtils: options.packageRepoUtils
    })

    // Find provenance marshall task
    const provenanceTask = marshallTasks.find(task => task.title.includes('Verifying package provenance'))
    expect(provenanceTask).toBeDefined()
    
    // Execute the task and it should be skipped
    const result = await provenanceTask.execute(options)
    
    // The provenance marshall should not have run (no results for provenance)
    expect(result.marshalls.provenance).toBeUndefined()
  })

  test('should run normally when neither environment variable is set', async () => {
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
        })
      }
    }

    const marshalls = await Marshalls.collectMarshalls()
    const marshallTasks = await Marshalls.buildMarshallTasks(marshalls, {
      packageRepoUtils: options.packageRepoUtils
    })

    // Should find both signature and provenance tasks
    const signaturesTask = marshallTasks.find(task => task.title.includes('Verifying registry signatures'))
    const provenanceTask = marshallTasks.find(task => task.title.includes('Verifying package provenance'))
    
    expect(signaturesTask).toBeDefined()
    expect(provenanceTask).toBeDefined()
  })
})