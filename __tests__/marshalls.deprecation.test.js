'use strict'

const DeprecationMarshall = require('../lib/marshalls/deprecation.marshall')

describe('Deprecation Marshall test suites', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetAllMocks()
  })

  describe('title', () => {
    test('has the right title', () => {
      const marshall = new DeprecationMarshall({
        packageRepoUtils: {}
      })
      expect(marshall.title()).toEqual('Checking package for deprecation flag')
    })
  })

  describe('npm deprecation check', () => {
    test('throws error when package version is deprecated on npm', async () => {
      const mockPackageData = {
        'dist-tags': {
          latest: '1.0.0'
        },
        versions: {
          '1.0.0': {
            deprecated: 'This package is no longer maintained'
          }
        }
      }

      const marshall = new DeprecationMarshall({
        packageRepoUtils: {
          getPackageInfo: jest.fn().mockResolvedValue(mockPackageData),
          extractGitHubRepoFromUrl: jest.fn().mockReturnValue(null),
          isGitHubRepoArchived: jest.fn().mockResolvedValue(false)
        }
      })

      await expect(
        marshall.validate({ packageName: 'test-pkg', packageVersion: 'latest' })
      ).rejects.toThrow('Package deprecated: This package is no longer maintained')
    })

    test('passes when package version is not deprecated', async () => {
      const mockPackageData = {
        'dist-tags': {
          latest: '1.0.0'
        },
        versions: {
          '1.0.0': {}
        }
      }

      const marshall = new DeprecationMarshall({
        packageRepoUtils: {
          getPackageInfo: jest.fn().mockResolvedValue(mockPackageData),
          extractGitHubRepoFromUrl: jest.fn().mockReturnValue(null),
          isGitHubRepoArchived: jest.fn().mockResolvedValue(false)
        }
      })

      await expect(
        marshall.validate({ packageName: 'test-pkg', packageVersion: 'latest' })
      ).resolves.not.toThrow()
    })

    test('returns true when no package data is available', async () => {
      const marshall = new DeprecationMarshall({
        packageRepoUtils: {
          getPackageInfo: jest.fn().mockResolvedValue(null)
        }
      })

      const result = await marshall.validate({ packageName: 'test-pkg', packageVersion: 'latest' })
      expect(result).toBe(true)
    })

    test('returns true when package version cannot be resolved', async () => {
      const mockPackageData = {
        'dist-tags': {},
        versions: {}
      }

      const marshall = new DeprecationMarshall({
        packageRepoUtils: {
          getPackageInfo: jest.fn().mockResolvedValue(mockPackageData),
          parsePackageVersion: jest.fn().mockReturnValue(null)
        }
      })

      const result = await marshall.validate({
        packageName: 'test-pkg',
        packageVersion: 'nonexistent'
      })
      expect(result).toBe(true)
    })
  })

  describe('GitHub repository archive check', () => {
    test('throws error when GitHub repository is archived', async () => {
      const mockPackageData = {
        'dist-tags': {
          latest: '1.0.0'
        },
        versions: {
          '1.0.0': {}
        },
        repository: {
          url: 'git+https://github.com/owner/repo.git'
        }
      }

      const marshall = new DeprecationMarshall({
        packageRepoUtils: {
          getPackageInfo: jest.fn().mockResolvedValue(mockPackageData),
          extractGitHubRepoFromUrl: jest.fn().mockReturnValue({ owner: 'owner', repo: 'repo' }),
          isGitHubRepoArchived: jest.fn().mockResolvedValue(true)
        }
      })

      await expect(
        marshall.validate({ packageName: 'test-pkg', packageVersion: 'latest' })
      ).rejects.toThrow('Package repository has been archived on GitHub')
    })

    test('passes when GitHub repository is not archived', async () => {
      const mockPackageData = {
        'dist-tags': {
          latest: '1.0.0'
        },
        versions: {
          '1.0.0': {}
        },
        repository: {
          url: 'git+https://github.com/owner/repo.git'
        }
      }

      const marshall = new DeprecationMarshall({
        packageRepoUtils: {
          getPackageInfo: jest.fn().mockResolvedValue(mockPackageData),
          extractGitHubRepoFromUrl: jest.fn().mockReturnValue({ owner: 'owner', repo: 'repo' }),
          isGitHubRepoArchived: jest.fn().mockResolvedValue(false)
        }
      })

      await expect(
        marshall.validate({ packageName: 'test-pkg', packageVersion: 'latest' })
      ).resolves.not.toThrow()
    })

    test('skips GitHub check when no repository URL is present', async () => {
      const mockPackageData = {
        'dist-tags': {
          latest: '1.0.0'
        },
        versions: {
          '1.0.0': {}
        }
      }

      const mockIsGitHubRepoArchived = jest.fn()
      const marshall = new DeprecationMarshall({
        packageRepoUtils: {
          getPackageInfo: jest.fn().mockResolvedValue(mockPackageData),
          extractGitHubRepoFromUrl: jest.fn(),
          isGitHubRepoArchived: mockIsGitHubRepoArchived
        }
      })

      await marshall.validate({ packageName: 'test-pkg', packageVersion: 'latest' })
      expect(mockIsGitHubRepoArchived).not.toHaveBeenCalled()
    })

    test('skips GitHub check for non-GitHub repository URLs (GitLab, Bitbucket)', async () => {
      const mockPackageData = {
        'dist-tags': {
          latest: '1.0.0'
        },
        versions: {
          '1.0.0': {}
        },
        repository: {
          url: 'git+https://gitlab.com/owner/repo.git'
        }
      }

      const mockIsGitHubRepoArchived = jest.fn()
      const marshall = new DeprecationMarshall({
        packageRepoUtils: {
          getPackageInfo: jest.fn().mockResolvedValue(mockPackageData),
          extractGitHubRepoFromUrl: jest.fn().mockReturnValue(null),
          isGitHubRepoArchived: mockIsGitHubRepoArchived
        }
      })

      await marshall.validate({ packageName: 'test-pkg', packageVersion: 'latest' })
      expect(mockIsGitHubRepoArchived).not.toHaveBeenCalled()
    })

    test('propagates GitHub API rate limit error', async () => {
      const mockPackageData = {
        'dist-tags': {
          latest: '1.0.0'
        },
        versions: {
          '1.0.0': {}
        },
        repository: {
          url: 'git+https://github.com/owner/repo.git'
        }
      }

      const marshall = new DeprecationMarshall({
        packageRepoUtils: {
          getPackageInfo: jest.fn().mockResolvedValue(mockPackageData),
          extractGitHubRepoFromUrl: jest.fn().mockReturnValue({ owner: 'owner', repo: 'repo' }),
          isGitHubRepoArchived: jest
            .fn()
            .mockRejectedValue(
              new Error(
                'GitHub API rate limit exceeded - deprecation marshall could not evaluate repository archive status'
              )
            )
        }
      })

      await expect(
        marshall.validate({ packageName: 'test-pkg', packageVersion: 'latest' })
      ).rejects.toThrow(
        'GitHub API rate limit exceeded - deprecation marshall could not evaluate repository archive status'
      )
    })
  })

  describe('combined npm deprecation and GitHub archive', () => {
    test('throws npm deprecation error first when both deprecated and archived', async () => {
      const mockPackageData = {
        'dist-tags': {
          latest: '1.0.0'
        },
        versions: {
          '1.0.0': {
            deprecated: 'This package is deprecated'
          }
        },
        repository: {
          url: 'git+https://github.com/owner/repo.git'
        }
      }

      const marshall = new DeprecationMarshall({
        packageRepoUtils: {
          getPackageInfo: jest.fn().mockResolvedValue(mockPackageData),
          extractGitHubRepoFromUrl: jest.fn().mockReturnValue({ owner: 'owner', repo: 'repo' }),
          isGitHubRepoArchived: jest.fn().mockResolvedValue(true)
        }
      })

      // Should throw the npm deprecation error first
      await expect(
        marshall.validate({ packageName: 'test-pkg', packageVersion: 'latest' })
      ).rejects.toThrow('Package deprecated: This package is deprecated')
    })
  })
})
