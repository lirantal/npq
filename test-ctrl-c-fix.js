#!/usr/bin/env node
'use strict'

// Simple test script to verify Ctrl+C handling
const { prompt } = require('./lib/helpers/cliPrompt')

async function testCtrlC() {
  console.log('Testing Ctrl+C handling...')
  console.log('You can press Ctrl+C to test the graceful exit behavior')

  try {
    const result = await prompt({
      name: 'test',
      message: 'Press Ctrl+C to test the fix',
      default: false
    })
    console.log('Result:', result)
  } catch (error) {
    if (error.code === 'USER_ABORT') {
      console.log('✅ Caught USER_ABORT error correctly')
      console.log('Error details:', {
        message: error.message,
        code: error.code,
        exitCode: error.exitCode
      })
      process.exit(error.exitCode)
    } else {
      console.log('❌ Unexpected error:', error)
      process.exit(1)
    }
  }
}

testCtrlC()
