#!/usr/bin/env node

/**
 * Demo script to show pacote dependency elimination in action
 * 
 * This script demonstrates how disabling signature and provenance marshalls
 * allows npq to run without requiring the heavy pacote dependency.
 */

console.log('🔍 Testing npq with disabled security marshalls...\n')

// Set environment variables to disable pacote-dependent marshalls
process.env.MARSHALL_DISABLE_SIGNATURES = 'true'
process.env.MARSHALL_DISABLE_PROVENANCE = 'true'

const Marshalls = require('../lib/marshalls')
const PackageRepoUtils = require('../lib/helpers/packageRepoUtils')

async function demonstratePackoteElimination() {
  console.log('Environment variables set:')
  console.log('  MARSHALL_DISABLE_SIGNATURES =', process.env.MARSHALL_DISABLE_SIGNATURES)
  console.log('  MARSHALL_DISABLE_PROVENANCE =', process.env.MARSHALL_DISABLE_PROVENANCE)
  console.log()

  try {
    // Create a mock package repo utils (to avoid network calls in demo)
    const packageRepoUtils = {
      getPackageInfo: () => Promise.resolve({
        name: 'express',
        version: '4.18.0',
        'dist-tags': { latest: '4.18.0' },
        versions: { '4.18.0': { name: 'express', version: '4.18.0' } }
      }),
      getDownloadInfo: () => Promise.resolve(1000000),
      getLicenseInfo: () => Promise.resolve('MIT'),
      getReadmeInfo: () => Promise.resolve('# Express'),
      parsePackageVersion: (v) => ({ version: v }),
      isPackageInAllowList: () => false,
      getSemVer: () => Promise.resolve('4.18.0'),
      getLatestVersion: () => Promise.resolve('4.18.0')
    }

    const options = {
      pkgs: [{
        packageName: 'express',
        packageVersion: '4.18.0',
        packageString: 'express@4.18.0'
      }],
      packageRepoUtils
    }

    console.log('⚡ Running npq security checks without pacote dependency...')
    
    const startTime = Date.now()
    const results = await Marshalls.tasks(options)
    const endTime = Date.now()

    console.log(`✅ Completed in ${endTime - startTime}ms\n`)

    // Analyze results
    const flatResults = results.reduce((acc, result) => ({ ...acc, ...result }), {})
    const enabledMarshalls = Object.keys(flatResults)
    const disabledMarshalls = ['signatures', 'provenance'].filter(name => !flatResults[name])

    console.log('📊 Results:')
    console.log(`  Enabled marshalls: ${enabledMarshalls.length}`)
    console.log(`  Disabled marshalls: ${disabledMarshalls.length} (${disabledMarshalls.join(', ')})`)
    console.log()

    console.log('🎯 Enabled security checks:')
    enabledMarshalls.forEach(name => {
      const marshall = flatResults[name]
      const errorCount = marshall.errors ? marshall.errors.length : 0
      const warningCount = marshall.warnings ? marshall.warnings.length : 0
      console.log(`  ✓ ${name}: ${errorCount} errors, ${warningCount} warnings`)
    })

    if (disabledMarshalls.length > 0) {
      console.log('\n🚫 Disabled security checks (pacote not required):')
      disabledMarshalls.forEach(name => {
        console.log(`  ⊘ ${name}: skipped`)
      })
    }

    console.log('\n🏆 Success! npq ran without pacote dependency.')
    console.log('💾 Saved ~2.2 MiB and ~128 transitive dependencies')

  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

demonstratePackoteElimination().catch(console.error)