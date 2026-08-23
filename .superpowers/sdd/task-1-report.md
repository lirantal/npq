# Task 1 Implementation Report

## Status

DONE

## Implemented

- Updated package-manager launch assertions in `__tests__/packageManager.test.js` to require the executable, argument array, `stdio: 'inherit'`, and `shell: false` contract.
- Updated default-manager, npm argument filtering, yarn, pnpm, filter-order, custom-registry, and environment-integration expectations.
- Added the literal shell-metacharacter regression test.
- Added the Windows launch-spec expectation for `getPackageManagerLaunchSpec()`; this intentionally fails until the helper is implemented in the next task.
- Did not modify production code, documentation, the plan, or `.env.development`.

## RED Evidence

Command:

```sh
npm test -- --runInBand __tests__/packageManager.test.js __tests__/env-var-integration.test.js
```

Expected failure reason: the current implementation still passes a joined command string, uses `shell: true`, and does not expose `getPackageManagerLaunchSpec`.

Full command output (exit status 1):

```text

> npq@0.0.0-development test
> jest --runInBand __tests__/packageManager.test.js __tests__/env-var-integration.test.js

FAIL __tests__/packageManager.test.js
  ● package manager spawns successfully when provided valid package manager

    expect(jest.fn()).toHaveBeenCalledWith(...expected)

    Expected: "npm", [], {"shell": false, "stdio": "inherit"}
    Received: "npm", {"shell": true, "stdio": "inherit"}

    Number of calls: 1

      51 |   childProcess.spawn.mockImplementation(() => createMockChild(0))
      52 |   await packageManager.process('npm')
    > 53 |   expect(childProcess.spawn).toHaveBeenCalledWith('npm', [], {
         |                              ^
      54 |     stdio: 'inherit',
      55 |     shell: false
      56 |   })

      at Object.toHaveBeenCalledWith (__tests__/packageManager.test.js:53:30)

  ● package manager spawns successfully when retrieves default package manager

    expect(jest.fn()).toHaveBeenCalledWith(...expected)

    Expected: "npm", [], {"shell": false, "stdio": "inherit"}
    Received: "npm", {"shell": true, "stdio": "inherit"}

    Number of calls: 1

      62 |   childProcess.spawn.mockImplementation(() => createMockChild(0))
      63 |   await packageManager.process()
    > 64 |   expect(childProcess.spawn).toHaveBeenCalledWith('npm', [], {
         |                              ^
      65 |     stdio: 'inherit',
      66 |     shell: false
      67 |   })

      at Object.toHaveBeenCalledWith (__tests__/packageManager.test.js:64:30)

  ● package manager spawns successfully when provided array of packages to handle

    expect(jest.fn()).toHaveBeenCalledWith(...expected)

    Expected: "npm", ["install", "semver", "express"], {"shell": false, "stdio": "inherit"}
    Received: "npm install semver express", {"shell": true, "stdio": "inherit"}

    Number of calls: 1

      74 |   process.argv = ['node', 'script name', 'install', 'semver', 'express']
      75 |   await packageManager.process('npm')
    > 76 |   expect(childProcess.spawn).toHaveBeenCalledWith(
         |                              ^
      77 |     'npm',
      78 |     ['install', 'semver', 'express'],
      79 |     { stdio: 'inherit', shell: false }

      at Object.toHaveBeenCalledWith (__tests__/packageManager.test.js:76:30)

  ● package manager spawns successfully and ignore npq's own internal commands when spawning package manager

    expect(jest.fn()).toHaveBeenCalledWith(...expected)

    Expected: "npm", ["install", "semver", "express"], {"shell": false, "stdio": "inherit"}
    Received: "npm install semver express", {"shell": true, "stdio": "inherit"}

    Number of calls: 1

      94 |   ]
      95 |   await packageManager.process('npm')
    > 96 |   expect(childProcess.spawn).toHaveBeenCalledWith(
         |                              ^
      97 |     'npm',
      98 |     ['install', 'semver', 'express'],
      99 |     { stdio: 'inherit', shell: false }

      at Object.toHaveBeenCalledWith (__tests__/packageManager.test.js:96:30)

  ● package manager spawns with yarn when provided as parameter

    expect(jest.fn()).toHaveBeenCalledWith(...expected)

    Expected: "yarn", ["install", "express"], {"shell": false, "stdio": "inherit"}
    Received: "yarn install express", {"shell": true, "stdio": "inherit"}

    Number of calls: 1

      106 |   process.argv = ['node', 'script name', 'install', 'express']
      107 |   await packageManager.process('yarn')
    > 108 |   expect(childProcess.spawn).toHaveBeenCalledWith(
          |                              ^
      109 |     'yarn',
      110 |     ['install', 'express'],
      111 |     { stdio: 'inherit', shell: false }

      at Object.toHaveBeenCalledWith (__tests__/packageManager.test.js:108:30)

  ● package manager spawns with pnpm when provided as parameter

    expect(jest.fn()).toHaveBeenCalledWith(...expected)

    Expected: "pnpm", ["install", "lodash"], {"shell": false, "stdio": "inherit"}
    Received: "pnpm install lodash", {"shell": true, "stdio": "inherit"}

    Number of calls: 1

      118 |   process.argv = ['node', 'script name', 'install', 'lodash']
      119 |   await packageManager.process('pnpm')
    > 120 |   expect(childProcess.spawn).toHaveBeenCalledWith(
          |                              ^
      121 |     'pnpm',
      122 |     ['install', 'lodash'],
      123 |     { stdio: 'inherit', shell: false }

      at Object.toHaveBeenCalledWith (__tests__/packageManager.test.js:120:30)

  ● pnpm preserves filter and ellipsis selector order before add

    expect(jest.fn()).toHaveBeenCalledWith(...expected)

    Expected: "pnpm", ["--filter", "workspace...", "add", "express"], {"shell": false, "stdio": "inherit"}
    Received: "pnpm --filter workspace... add express", {"shell": true, "stdio": "inherit"}

    Number of calls: 1

      135 |   await packageManager.process('pnpm')
      136 |
    > 137 |   expect(childProcess.spawn).toHaveBeenCalledWith('pnpm', args, {
          |                              ^
      138 |     stdio: 'inherit',
      139 |     shell: false
      140 |   })

      at toHaveBeenCalledWith (__tests__/packageManager.test.js:137:30)

  ● pnpm preserves filter and ellipsis selector order after install

    expect(jest.fn()).toHaveBeenCalledWith(...expected)

    Expected: "pnpm", ["install", "express", "--filter", "...workspace"], {"shell": false, "stdio": "inherit"}
    Received: "pnpm install express --filter ...workspace", {"shell": true, "stdio": "inherit"}

    Number of calls: 1

      135 |   await packageManager.process('pnpm')
      136 |
    > 137 |   expect(childProcess.spawn).toHaveBeenCalledWith('pnpm', args, {
          |                              ^
      138 |     stdio: 'inherit',
      139 |     shell: false
      140 |   })

      at toHaveBeenCalledWith (__tests__/packageManager.test.js:137:30)

  ● package manager forwards custom registry options

    expect(jest.fn()).toHaveBeenCalledWith(...expected)

    Expected: "pnpm", ["install", "@company/tool", "--registry=https://artifactory.example.test/api/npm/npm/"], {"shell": false, "stdio": "inherit"}
    Received: "pnpm install @company/tool --registry=https://artifactory.example.test/api/npm/npm/", {"shell": true, "stdio": "inherit"}

    Number of calls: 1

      153 |   await packageManager.process('pnpm')
      154 |
    > 155 |   expect(childProcess.spawn).toHaveBeenCalledWith(
          |                              ^
      156 |     'pnpm',
      157 |     ['install', '@company/tool', '--registry=https://artifactory.example.test/api/npm/npm/'],
      158 |     { stdio: 'inherit', shell: false }

      at Object.toHaveBeenCalledWith (__tests__/packageManager.test.js:155:30)

  ● passes shell metacharacters as literal arguments without enabling a shell

    expect(jest.fn()).toHaveBeenCalledWith(...expected)

    Expected: "npm", ["install", "left;touch marker", "quoted value"], {"shell": false, "stdio": "inherit"}
    Received: "npm install left;touch marker quoted value", {"shell": true, "stdio": "inherit"}

    Number of calls: 1

      167 |   await packageManager.process('npm')
      168 |
    > 169 |   expect(childProcess.spawn).toHaveBeenCalledWith(
          |                              ^
      170 |     'npm',
      171 |     ['install', 'left;touch marker', 'quoted value'],
      172 |     { stdio: 'inherit', shell: false }

      at Object.toHaveBeenCalledWith (__tests__/packageManager.test.js:169:30)

  ● uses the Windows command interpreter only as an explicit launcher

    TypeError: packageManager.getPackageManagerLaunchSpec is not a function

      175 |
      176 | test('uses the Windows command interpreter only as an explicit launcher', () => {
    > 177 |   expect(packageManager.getPackageManagerLaunchSpec('npm', ['install', 'express'], 'win32')).toEqual(
          |                         ^
      178 |     {
      179 |       executable: process.env.ComSpec || 'cmd.exe',
      180 |       args: ['/d', '/s', '/c', 'npm', 'install', 'express']

      at Object.getPackageManagerLaunchSpec (__tests__/packageManager.test.js:177:25)

FAIL .worktrees/publication-history-spike/__tests__/packageManager.test.js
  ● package manager spawns successfully when provided valid package manager

    expect(received).toBe(expected) // Object.is equality

    Expected: "npm"
    Received: "npm --runInBand __tests__/packageManager.test.js __tests__/env-var-integration.test.js"

      43 |   expect(childProcess.spawn).toHaveBeenCalled()
      44 |   expect(childProcess.spawn.mock.calls.length).toBe(1)
    > 45 |   expect(childProcess.spawn.mock.calls[0][0]).toBe('npm')
         |                                               ^
      46 |
      47 |   childProcess.spawn.mockReset()
      48 | })

      at Object.toBe (.worktrees/publication-history-spike/__tests__/packageManager.test.js:45:47)

  ● package manager spawns successfully when retrieves default package manager

    expect(received).toBe(expected) // Object.is equality

    Expected: 1
    Received: 2

      52 |   await packageManager.process()
      53 |   expect(childProcess.spawn).toHaveBeenCalled()
    > 54 |   expect(childProcess.spawn.mock.calls.length).toBe(1)
         |                                                ^
      55 |   expect(childProcess.spawn.mock.calls[0][0]).toBe('npm')
      56 |
      57 |   childProcess.spawn.mockReset()

      at Object.toBe (.worktrees/publication-history-spike/__tests__/packageManager.test.js:54:48)

  ● package manager spawns successfully when provided array of packages to handle

    expect(received).toBe(expected) // Object.is equality

    Expected: 1
    Received: 3

      63 |   await packageManager.process('npm')
      64 |   expect(childProcess.spawn).toHaveBeenCalled()
    > 65 |   expect(childProcess.spawn.mock.calls.length).toBe(1)
         |                                                ^
      66 |   expect(childProcess.spawn.mock.calls[0][0]).toEqual('npm install semver express')
      67 |   childProcess.spawn.mockReset()
      68 | })

      at Object.toBe (.worktrees/publication-history-spike/__tests__/packageManager.test.js:65:48)

  ● package manager spawns successfully and ignore npq's own internal commands when spawning package manager

    expect(received).toBe(expected) // Object.is equality

    Expected: 1
    Received: 4

      81 |   await packageManager.process('npm')
      82 |   expect(childProcess.spawn).toHaveBeenCalled()
    > 83 |   expect(childProcess.spawn.mock.calls.length).toBe(1)
         |                                                ^
      84 |   expect(childProcess.spawn.mock.calls[0][0]).toEqual('npm install semver express')
      85 |   childProcess.spawn.mockReset()
      86 | })

      at Object.toBe (.worktrees/publication-history-spike/__tests__/packageManager.test.js:83:48)

  ● package manager spawns with yarn when provided as parameter

    expect(received).toBe(expected) // Object.is equality

    Expected: 1
    Received: 5

      91 |   await packageManager.process('yarn')
      92 |   expect(childProcess.spawn).toHaveBeenCalled()
    > 93 |   expect(childProcess.spawn.mock.calls.length).toBe(1)
         |                                                ^
      94 |   expect(childProcess.spawn.mock.calls[0][0]).toEqual('yarn install express')
      95 |   childProcess.spawn.mockReset()
      96 | })

      at Object.toBe (.worktrees/publication-history-spike/__tests__/packageManager.test.js:93:48)

  ● package manager spawns with pnpm when provided as parameter

    expect(received).toBe(expected) // Object.is equality

    Expected: 1
    Received: 6

      101 |   await packageManager.process('pnpm')
      102 |   expect(childProcess.spawn).toHaveBeenCalled()
    > 103 |   expect(childProcess.spawn.mock.calls.length).toBe(1)
          |                                                ^
      104 |   expect(childProcess.spawn.mock.calls[0][0]).toEqual('pnpm install lodash')
      105 |   childProcess.spawn.mockReset()
      106 | })

      at Object.toBe (.worktrees/publication-history-spike/__tests__/packageManager.test.js:103:48)

FAIL __tests__/env-var-integration.test.js
  ● NPQ_PKG_MGR Environment Variable Integration › package manager process should handle pnpm correctly

    expect(jest.fn()).toHaveBeenCalledWith(...expected)

    Expected: "pnpm", ["install", "fastify"], {"shell": false, "stdio": "inherit"}
    Received: "pnpm install fastify", {"shell": true, "stdio": "inherit"}

    Number of calls: 1

      44 |     await packageManager.process('pnpm')
      45 |
    > 46 |     expect(childProcess.spawn).toHaveBeenCalledWith('pnpm', ['install', 'fastify'], {
         |                                ^
      47 |       stdio: 'inherit',
      48 |       shell: false
      49 |     })

      at Object.toHaveBeenCalledWith (__tests__/env-var-integration.test.js:46:32)

  ● NPQ_PKG_MGR Environment Variable Integration › package manager process should handle yarn correctly

    expect(jest.fn()).toHaveBeenCalledWith(...expected)

    Expected: "yarn", ["install", "express", "lodash"], {"shell": false, "stdio": "inherit"}
    Received: "yarn install express lodash", {"shell": true, "stdio": "inherit"}

    Number of calls: 1

      55 |     await packageManager.process('yarn')
      56 |
    > 57 |     expect(childProcess.spawn).toHaveBeenCalledWith('yarn', ['install', 'express', 'lodash'], {
         |                                ^
      58 |       stdio: 'inherit',
      59 |       shell: false
      60 |     })

      at Object.toHaveBeenCalledWith (__tests__/env-var-integration.test.js:57:32)

  ● NPQ_PKG_MGR Environment Variable Integration › package manager process should handle various package managers

    expect(jest.fn()).toHaveBeenCalledWith(...expected)

    Expected: "npm", ["install", "test-package"], {"shell": false, "stdio": "inherit"}
    Received: "npm install test-package", {"shell": true, "stdio": "inherit"}

    Number of calls: 1

      69 |       await packageManager.process(pm)
      70 |
    > 71 |       expect(childProcess.spawn).toHaveBeenCalledWith(pm, ['install', 'test-package'], {
         |                                  ^
      72 |         stdio: 'inherit',
      73 |         shell: false
      74 |       })

      at Object.toHaveBeenCalledWith (__tests__/env-var-integration.test.js:71:34)

----------------------------------------------------|---------|----------|---------|---------|-------------------
File                                                | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
----------------------------------------------------|---------|----------|---------|---------|-------------------
All files                                           |     100 |    98.57 |     100 |     100 |                   
 .worktrees/custom-registry-support/lib             |     100 |      100 |     100 |     100 |                   
  packageManager.js                                 |     100 |      100 |     100 |     100 |                   
 .worktrees/fix-expired-domain-resolved-version/lib |     100 |      100 |     100 |     100 |                   
  packageManager.js                                 |     100 |      100 |     100 |     100 |                   
 .worktrees/fix-pnpm-filter-args/lib                |     100 |      100 |     100 |     100 |                   
  packageManager.js                                 |     100 |      100 |     100 |     100 |                   
 .worktrees/improve-expired-domain-warning/lib      |     100 |      100 |     100 |     100 |                   
  packageManager.js                                 |     100 |      100 |     100 |     100 |                   
 .worktrees/issue-424-older-version-suggestion/lib  |     100 |      100 |     100 |     100 |                   
  packageManager.js                                 |     100 |      100 |     100 |     100 |                   
 .worktrees/publication-history-spike/lib           |     100 |       90 |     100 |     100 |                   
  packageManager.js                                 |     100 |       90 |     100 |     100 | 26                
 lib                                                |     100 |      100 |     100 |     100 |                   
  packageManager.js                                 |     100 |      100 |     100 |     100 |                   
----------------------------------------------------|---------|----------|---------|---------|-------------------
Jest: Coverage data for scripts/* was not found.
Test Suites: 3 failed, 11 passed, 14 total
Tests:       20 failed, 129 passed, 149 total
Snapshots:   0 total
Time:        1.68 s, estimated 2 s
Ran all test suites matching __tests__/packageManager.test.js|__tests__/env-var-integration.test.js.
```

## Files Changed

- `__tests__/packageManager.test.js`
- `__tests__/env-var-integration.test.js`
- `.superpowers/sdd/task-1-report.md` (this report)

## Self-review

The assertions preserve the existing executable names and argument ordering. The focused red run shows the intended contract failures and the missing-helper failure. The Jest configuration also discovers an unrelated test copy under `.worktrees/publication-history-spike`; those additional failures are environmental repository noise, while the two requested test files fail for the specified reasons.

## Concerns

The required red command exits 1 by design. No production implementation was added.

## Review Fix Report

### Changes

- Added explicit regression coverage that filters the --pkgMgr alias from the forwarded package-manager arguments.
- Added focused coverage proving a configured executable containing spaces is passed to childProcess.spawn as one executable string, with package-manager arguments kept in a separate array and shell: false.
- Did not add whitespace rejection: valid executable paths can contain spaces, and the approved contract is shell-free direct executable handling.

### Verification

Command:

    npm test -- --runInBand --collectCoverage=false --runTestsByPath __tests__/packageManager.test.js __tests__/env-var-integration.test.js

Output: exit status 1; 2 test suites failed, 16 tests failed, and 10 tests passed. The failures are the expected Task 1 RED state because production code still joins the executable and arguments into one command string, uses shell: true, and does not yet expose the Windows launch-spec helper. The new spaced-executable regression specifically received /opt/package managers/npm install express instead of separate executable and argument-array values; it does not reject the path because no whitespace validation is asserted or desired.
