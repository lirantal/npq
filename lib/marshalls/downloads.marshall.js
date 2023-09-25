'use strict'

const BaseMarshall = require('./baseMarshall')

const MARSHALL_NAME = 'downloads'
const DOWNLOAD_COUNT_THRESHOLD = 20 // threshold per month

class Marshall extends BaseMarshall {
  constructor(options) {
    super(options)
    this.name = MARSHALL_NAME
  }

  title() {
    return 'Checking package download popularity'
  }

  validate(pkg) {
    return this.packageRepoUtils.getDownloadInfo(pkg.packageName).then((downloadCount) => {
      if (downloadCount < DOWNLOAD_COUNT_THRESHOLD) {
        throw new Error(
          `detected a low download-count package (downloads last month < ${DOWNLOAD_COUNT_THRESHOLD})`
        )
      }

      return downloadCount
    })
  }
}

module.exports = Marshall
