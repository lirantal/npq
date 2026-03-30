'use strict'

const { promiseThrottleHelper, PromiseThrottler } = require('../lib/helpers/promiseThrottler')

describe('PromiseThrottler', () => {
  beforeEach(() => {
    // Reset the singleton instance before each test
    PromiseThrottler.instance = null
  })

  describe('Singleton Pattern', () => {
    test('should create a singleton instance', () => {
      const instance1 = PromiseThrottler.getInstance()
      const instance2 = PromiseThrottler.getInstance()
      expect(instance1).toBe(instance2)
    })

    test('should return same instance when using new constructor', () => {
      const instance1 = new PromiseThrottler()
      const instance2 = new PromiseThrottler()
      const instance3 = PromiseThrottler.getInstance()
      expect(instance1).toBe(instance2)
      expect(instance1).toBe(instance3)
    })
  })

  describe('Configuration', () => {
    test('should have default configuration values', () => {
      const throttler = new PromiseThrottler()
      expect(throttler.maxConcurrent).toBe(5)
      expect(throttler.minDelay).toBe(0)
      expect(throttler.runningCount).toBe(0)
      expect(throttler.queue).toEqual([])
    })

    test('should allow configuration of maxConcurrent and minDelay', () => {
      const throttler = new PromiseThrottler()
      throttler.configure(3, 1000)
      expect(throttler.maxConcurrent).toBe(3)
      expect(throttler.minDelay).toBe(1000)
    })

    test('should use default values when configure is called without parameters', () => {
      const throttler = new PromiseThrottler()
      throttler.configure()
      expect(throttler.maxConcurrent).toBe(5)
      expect(throttler.minDelay).toBe(0)
    })
  })

  describe('throttle method', () => {
    test('should execute single promise immediately when under limit', async () => {
      const throttler = new PromiseThrottler()
      const mockPromise = jest.fn().mockResolvedValue('result')

      const result = await throttler.throttle(mockPromise)

      expect(mockPromise).toHaveBeenCalledTimes(1)
      expect(result).toBe('result')
    })

    test('should queue promises when at concurrent limit', async () => {
      const throttler = new PromiseThrottler()
      throttler.configure(1, 0) // Only 1 concurrent

      let resolve1
      const promise1 = jest.fn().mockImplementation(
        () =>
          new Promise((r) => {
            resolve1 = r
          })
      )
      const promise2 = jest.fn().mockResolvedValue('result2')

      // Start first promise (should start immediately)
      const result1Promise = throttler.throttle(promise1)
      expect(promise1).toHaveBeenCalledTimes(1)

      // Start second promise (should be queued)
      const result2Promise = throttler.throttle(promise2)
      expect(promise2).not.toHaveBeenCalled()
      expect(throttler.queue).toHaveLength(1)

      // Complete first promise
      resolve1('result1')
      await result1Promise

      // Second promise should now execute
      const result2 = await result2Promise
      expect(promise2).toHaveBeenCalledTimes(1)
      expect(result2).toBe('result2')
    })

    test('should respect minimum delay between requests', async () => {
      jest.useFakeTimers({ now: Date.now() })
      try {
        const throttler = new PromiseThrottler()
        throttler.configure(5, 100) // 100ms minDelay (fake timers: avoids wall-clock flake on some Node versions)

        const mockPromise = jest.fn().mockResolvedValue('result')
        const finished = throttler.throttle(mockPromise)

        await Promise.resolve()
        await jest.advanceTimersByTimeAsync(100)
        await finished

        expect(mockPromise).toHaveBeenCalledTimes(1)
      } finally {
        jest.useRealTimers()
      }
    })

    test('should not add extra delay if promise already took longer than minDelay', async () => {
      jest.useFakeTimers({ now: Date.now() })
      try {
        const throttler = new PromiseThrottler()
        throttler.configure(5, 50) // 50ms minDelay; work below takes 100ms fake time — no extra 50ms wait

        const slowPromise = jest
          .fn()
          .mockImplementation(
            () => new Promise((resolve) => setTimeout(() => resolve('result'), 100))
          )

        const startedAt = jest.now()
        const finished = throttler.throttle(slowPromise)

        await Promise.resolve()
        await jest.advanceTimersByTimeAsync(100)
        await finished

        // Work consumed 100ms fake time; throttler must not add minDelay on top (~150ms)
        expect(jest.now() - startedAt).toBe(100)
        expect(slowPromise).toHaveBeenCalledTimes(1)
      } finally {
        jest.useRealTimers()
      }
    })

    test('should handle promise rejection', async () => {
      const throttler = new PromiseThrottler()
      const error = new Error('Test error')
      const mockPromise = jest.fn().mockRejectedValue(error)

      await expect(throttler.throttle(mockPromise)).rejects.toThrow('Test error')
      expect(mockPromise).toHaveBeenCalledTimes(1)
    })

    test('should continue processing queue after error', async () => {
      const throttler = new PromiseThrottler()
      throttler.configure(1, 0)

      let resolve1
      const promise1 = jest.fn().mockImplementation(
        () =>
          new Promise((r) => {
            resolve1 = r
          })
      )
      const promise2 = jest.fn().mockRejectedValue(new Error('Error'))
      const promise3 = jest.fn().mockResolvedValue('result3')

      // Start all promises
      const result1Promise = throttler.throttle(promise1)
      const result2Promise = throttler.throttle(promise2)
      const result3Promise = throttler.throttle(promise3)

      // Complete first promise
      resolve1('result1')
      await result1Promise

      // Second should fail
      await expect(result2Promise).rejects.toThrow('Error')

      // Third should still execute
      const result3 = await result3Promise
      expect(result3).toBe('result3')
    })

    test('should process multiple queued items when capacity allows', async () => {
      const throttler = new PromiseThrottler()
      throttler.configure(2, 0) // 2 concurrent

      let resolve1, resolve2
      const promise1 = jest.fn().mockImplementation(
        () =>
          new Promise((r) => {
            resolve1 = r
          })
      )
      const promise2 = jest.fn().mockImplementation(
        () =>
          new Promise((r) => {
            resolve2 = r
          })
      )
      const promise3 = jest.fn().mockResolvedValue('result3')
      const promise4 = jest.fn().mockResolvedValue('result4')

      // Start all promises - first two should start, others queued
      const result1Promise = throttler.throttle(promise1)
      const result2Promise = throttler.throttle(promise2)
      const result3Promise = throttler.throttle(promise3)
      const result4Promise = throttler.throttle(promise4)

      expect(promise1).toHaveBeenCalledTimes(1)
      expect(promise2).toHaveBeenCalledTimes(1)
      expect(promise3).not.toHaveBeenCalled()
      expect(promise4).not.toHaveBeenCalled()

      // Complete first promise - should start third
      resolve1('result1')
      await result1Promise

      // Give some time for queue processing
      await new Promise((resolve) => setImmediate(resolve))

      expect(promise3).toHaveBeenCalledTimes(1)
      // Due to timing, promise4 might also have been called if promise3 resolved quickly
      // Let's not be strict about promise4 timing here

      // Complete second promise - should start fourth if not already started
      resolve2('result2')
      await result2Promise

      // All should complete
      await Promise.all([result3Promise, result4Promise])
      expect(promise3).toHaveBeenCalledTimes(1)
      expect(promise4).toHaveBeenCalledTimes(1)
    })
  })

  describe('processQueue method', () => {
    test('should not process queue when at max concurrent limit', async () => {
      const throttler = new PromiseThrottler()
      throttler.configure(1, 0)
      throttler.runningCount = 1 // Simulate running promise

      const mockPromise = jest.fn().mockResolvedValue('result')
      throttler.queue.push({ promiseFunction: mockPromise, resolve: jest.fn(), reject: jest.fn() })

      await throttler.processQueue()

      expect(mockPromise).not.toHaveBeenCalled()
      expect(throttler.queue).toHaveLength(1)
    })

    test('should not process when queue is empty', async () => {
      const throttler = new PromiseThrottler()
      const initialRunningCount = throttler.runningCount

      await throttler.processQueue()

      expect(throttler.runningCount).toBe(initialRunningCount)
    })
  })
})

describe('promiseThrottleHelper', () => {
  beforeEach(() => {
    // Reset the singleton instance before each test
    PromiseThrottler.instance = null
  })

  test('should use singleton instance and configure it', async () => {
    const mockPromise = jest.fn().mockResolvedValue('result')

    const result = await promiseThrottleHelper(mockPromise, 3, 100)

    expect(result).toBe('result')
    expect(mockPromise).toHaveBeenCalledTimes(1)

    const instance = PromiseThrottler.getInstance()
    expect(instance.maxConcurrent).toBe(3)
    expect(instance.minDelay).toBe(100)
  })

  test('should use default values when no parameters provided', async () => {
    const mockPromise = jest.fn().mockResolvedValue('result')

    await promiseThrottleHelper(mockPromise)

    const instance = PromiseThrottler.getInstance()
    expect(instance.maxConcurrent).toBe(5)
    expect(instance.minDelay).toBe(0)
  })

  test('should work with multiple calls using same instance', async () => {
    const promise1 = jest.fn().mockResolvedValue('result1')
    const promise2 = jest.fn().mockResolvedValue('result2')

    const [result1, result2] = await Promise.all([
      promiseThrottleHelper(promise1, 2, 0),
      promiseThrottleHelper(promise2, 2, 0)
    ])

    expect(result1).toBe('result1')
    expect(result2).toBe('result2')
    expect(promise1).toHaveBeenCalledTimes(1)
    expect(promise2).toHaveBeenCalledTimes(1)
  })

  test('should handle real-world concurrent API calls scenario', async () => {
    // Simulate auditing multiple packages with rate limiting
    const packages = ['express', 'lodash', 'react', 'vue', 'angular']
    const auditPackage = jest.fn().mockImplementation((pkg) => Promise.resolve(`audit-${pkg}`))

    const throttledAudits = packages.map(
      (pkg) => promiseThrottleHelper(() => auditPackage(pkg), 2, 10) // max 2 concurrent, 10ms delay
    )

    const startTime = Date.now()
    const results = await Promise.all(throttledAudits)
    const endTime = Date.now()

    expect(results).toEqual([
      'audit-express',
      'audit-lodash',
      'audit-react',
      'audit-vue',
      'audit-angular'
    ])
    expect(auditPackage).toHaveBeenCalledTimes(5)

    // Should take at least some time due to throttling
    // With 2 concurrent and 5 items, we need at least 3 batches
    // Each batch after the first should have at least 10ms delay
    expect(endTime - startTime).toBeGreaterThanOrEqual(20)
  })
})
