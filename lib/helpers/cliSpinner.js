const growVertical = {
  interval: 120,
  frames: ['▁', '▃', '▄', '▅', '▆', '▇', '▆', '▅', '▄', '▃']
}

class Spinner {
  constructor(options = {}) {
    this.spinner = options.spinner || growVertical
    this.text = options.text || ''
    this.color = options.color || null
    this.stream = options.stream || process.stderr
    this.frameIndex = 0
    this.timer = null
    this.isSpinning = false
  }

  start(text) {
    if (this.isSpinning) {
      return
    }

    if (text) {
      this.text = text
    }

    this.isSpinning = true
    this.frameIndex = 0

    // Hide cursor
    this.stream.write('\u001B[?25l')

    this.timer = setInterval(() => {
      this.render()
    }, this.spinner.interval)

    this.render()
  }

  stop(finalText) {
    if (!this.isSpinning) {
      return
    }

    clearInterval(this.timer)
    this.isSpinning = false

    // Clear current line and show cursor
    this.stream.write('\r\u001B[K\u001B[?25h')

    if (finalText) {
      this.stream.write(finalText + '\n')
    }
  }

  succeed(text) {
    this.stop()
    const message = text || this.text
    this.stream.write(`✅ ${message}\n`)
  }

  fail(text) {
    this.stop()
    const message = text || this.text
    this.stream.write(`❌ ${message}\n`)
  }

  warn(text) {
    this.stop()
    const message = text || this.text
    this.stream.write(`⚠️  ${message}\n`)
  }

  info(text) {
    this.stop()
    const message = text || this.text
    this.stream.write(`ℹ️  ${message}\n`)
  }

  setText(text) {
    this.text = text
  }

  update(text) {
    this.text = text
    if (this.isSpinning) {
      this.render()
    }
  }

  render() {
    const frame = this.spinner.frames[this.frameIndex]
    const output = `${frame} ${this.text}`

    // Move cursor to beginning of line and clear it
    this.stream.write('\r\u001B[K')
    this.stream.write(output)

    this.frameIndex = (this.frameIndex + 1) % this.spinner.frames.length
  }
}

module.exports = {
  Spinner
}
