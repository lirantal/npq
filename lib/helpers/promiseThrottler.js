// Example use-case
//
// Using the new throttling mechanism - each audit will be throttled globally
// const throttledAudits = pkgs.map(pkg =>
//     promiseThrottle(() => auditPackage(pkg), 1, 1000) // max 1 concurrent, 1 second delay
//   )
// const res = await Promise.all(throttledAudits)

/**
 * A function that throttles promises to avoid overwhelming remote APIs
 * rate limits. Uses a global throttling mechanism that works across
 * multiple concurrent calls.
 *
 * @param {Function} promiseFunction - Function that returns a promise
 * @param {number} maxConcurrent - Maximum concurrent promises (global setting)
 * @param {number} delay - Minimum delay between requests in milliseconds
 */
async function promiseThrottleHelper(promiseFunction, maxConcurrent = 5, delay = 0) {
  const throttler = PromiseThrottler.getInstance()

  // Configure global throttling settings
  throttler.configure(maxConcurrent, delay)

  // Use the global throttler
  return throttler.throttle(promiseFunction)
}

/**
 * A throttling class that limits concurrent promise execution across all instances
 * to avoid overwhelming remote APIs with rate limits.
 */
class PromiseThrottler {
  constructor() {
    if (!PromiseThrottler.instance) {
      this.runningCount = 0
      this.queue = []
      this.maxConcurrent = 5
      this.minDelay = 0
      PromiseThrottler.instance = this
    }
    return PromiseThrottler.instance
  }

  static getInstance() {
    if (!PromiseThrottler.instance) {
      new PromiseThrottler()
    }
    return PromiseThrottler.instance
  }

  configure(maxConcurrent = 5, minDelay = 0) {
    this.maxConcurrent = maxConcurrent
    this.minDelay = minDelay
  }

  async processQueue() {
    while (this.queue.length > 0 && this.runningCount < this.maxConcurrent) {
      const { promiseFunction, resolve, reject } = this.queue.shift()
      this.runningCount++

      try {
        const startTime = Date.now()
        const result = await promiseFunction()

        // Ensure minimum delay between requests
        if (this.minDelay > 0) {
          const elapsed = Date.now() - startTime
          const remainingDelay = this.minDelay - elapsed
          if (remainingDelay > 0) {
            await new Promise((r) => setTimeout(r, remainingDelay))
          }
        }

        resolve(result)
      } catch (error) {
        reject(error)
      } finally {
        this.runningCount--
        // Process next items in queue
        setImmediate(() => this.processQueue())
      }
    }
  }

  async throttle(promiseFunction) {
    return new Promise((resolve, reject) => {
      this.queue.push({ promiseFunction, resolve, reject })
      this.processQueue()
    })
  }
}

module.exports = {
  promiseThrottleHelper,
  PromiseThrottler
}
