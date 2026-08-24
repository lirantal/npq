# Non-Interactive Install Safety Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

Goal: Make warning-only installs fail closed outside an interactive terminal while preserving explicit automation opt-ins and coding-agent package-manager passthrough.

Architecture: Add a pure install-policy helper that separates audit findings from the choice to prompt, count down, install, or reject. Both executable entrypoints will use that policy, while parser output will distinguish explicit JSON audit mode from coding-agent authorization for explicit install commands. autoContinue will retain only its TTY implementation and reject non-TTY calls defensively.

Tech Stack: Node.js CommonJS modules, node:util.parseArgs, existing CLI binaries in bin/, Jest 30, npm scripts, Markdown documentation, and Changesets.

## Global Constraints

- Never start or complete an auto-continue countdown outside an interactive terminal.
- Ordinary non-TTY warning and error findings exit nonzero without invoking the package manager.
- Ordinary non-TTY callers opt in with --allow-non-interactive-install or NPQ_ALLOW_NON_INTERACTIVE_INSTALL=true.
- A detected coding-agent environment is an opt-in for explicit install commands, preserving package-manager passthrough for agent-driven installs.
- Explicit --json remains strict audit-only mode and never invokes the package manager.
- Error findings do not receive a non-interactive bypass.
- Interactive TTY countdown, prompt, Ctrl+C, and package-manager exit-code behavior remain unchanged.
- npq-hero does not receive a public npq-specific CLI flag; its ordinary automation opt-in is environment-based.
- Do not change the JSON schema, coding-agent signal list, registry behavior, marshall behavior, package-manager selection, or package-manager arguments.
- Every behavior change has a regression test, and final verification runs npm test and npm run lint.

---

## File map

Create:

- lib/helpers/installPolicy.js — pure decision function and typed non-interactive rejection error.
- __tests__/installPolicy.test.js — complete decision-matrix coverage.
- __tests__/cliSupportHandler.test.js — input/output TTY and CI detection coverage.
- .changeset/quiet-install-guard.md — patch Changeset for the published safety behavior.

Modify:

- lib/helpers/cliPrompt.js:72-179 — remove the non-TTY countdown fallback and reject direct non-TTY calls.
- lib/helpers/cliSupportHandler.js:47-71 — require both stdin and stdout TTYs for interactivity.
- lib/cli.js:72-180 — parse the new opt-in, preserve explicit JSON precedence, and authorize coding-agent explicit installs.
- bin/npq.js:26-188 — use the policy for standalone install routing and map typed rejection errors to exit code 1.
- bin/npq-hero.js:21-154 — use the same policy while preserving non-install passthrough.
- __tests__/cliPrompt.test.js:272-520 — set countdown tests up as TTY tests and add the non-TTY regression.
- __tests__/cli.parser.complete.test.js:208-633 — cover full-parser flags, env values, and coding-agent precedence.
- __tests__/cli.packageManagerArgs.test.js:150-175 — cover minimal-parser coding-agent install authorization.
- __tests__/cli.test.js:206-323 — cover standalone route decisions and package-manager suppression.
- __tests__/npqHero.test.js:96-152 — cover hero install passthrough under coding agents and non-TTY rejection.
- __tests__/exitCode.test.js:145-340 — cover non-TTY finding exit code and package-manager suppression.
- __tests__/codingAgentCli.process.test.js:55-161 — replace JSON-only agent-install expectations with direct passthrough and add ordinary CI cases.
- __tests__/__fixtures__/json-process-preload.js:9-48 — make the process fixture deterministic for clean and findings scenarios.
- README.md:244-267 — document the explicit non-TTY opt-in and coding-agent install exception.
- docs/feature/auto-continue.md:119-160 — document fail-closed non-TTY behavior.
- docs/feature/json-output.md:1-83 — document explicit-install coding-agent routing and explicit JSON precedence.
- docs/feature/exit-codes.md:7-65,83-96,109-118 — document non-TTY rejection and its exit code.
- docs/feature/alias.md:38-52,148-153 — document hero behavior under coding-agent detection.
- docs/README.md:94-113 — link the implementation plan.

---

### Task 1: Define and test the install decision policy

Files:

- Create: lib/helpers/installPolicy.js
- Create: __tests__/installPolicy.test.js

Interfaces:

- Produces getInstallAction({ countErrors, countWarnings, isInteractive, disableAutoContinue, allowNonInteractiveInstall }), returning exactly 'install' | 'prompt' | 'countdown' | 'reject'.
- Produces createNonInteractiveInstallError(), returning an Error with code equal to 'NON_INTERACTIVE_INSTALL' and exitCode equal to 1.
- Later tasks consume both exports from lib/helpers/installPolicy.js.

- [ ] Step 1: Write the failing policy matrix test

Create __tests__/installPolicy.test.js with the matrix below. It must assert that clean audits install, interactive warning-only audits count down unless disabled, interactive errors prompt, authorized non-TTY warnings install, and all non-TTY error/unauthorized-warning cases reject.

    'use strict'

    const {
      getInstallAction,
      createNonInteractiveInstallError
    } = require('../lib/helpers/installPolicy')

    describe('install policy', () => {
      test.each([
        ['clean interactive', { isInteractive: true }, 'install'],
        ['clean non-interactive', { isInteractive: false }, 'install'],
        [
          'interactive warning countdown',
          { countWarnings: 1, isInteractive: true, disableAutoContinue: false },
          'countdown'
        ],
        [
          'interactive warning prompt when disabled',
          { countWarnings: 1, isInteractive: true, disableAutoContinue: true },
          'prompt'
        ],
        [
          'interactive errors prompt',
          { countErrors: 1, isInteractive: true },
          'prompt'
        ],
        [
          'ordinary non-interactive warning rejects',
          { countWarnings: 1, isInteractive: false, allowNonInteractiveInstall: false },
          'reject'
        ],
        [
          'authorized non-interactive warning installs',
          { countWarnings: 1, isInteractive: false, allowNonInteractiveInstall: true },
          'install'
        ],
        [
          'disabled non-interactive warning rejects even when authorized',
          {
            countWarnings: 1,
            isInteractive: false,
            disableAutoContinue: true,
            allowNonInteractiveInstall: true
          },
          'reject'
        ],
        [
          'ordinary non-interactive errors reject',
          { countErrors: 1, isInteractive: false, allowNonInteractiveInstall: true },
          'reject'
        ]
      ])('%s', (_name, options, expected) => {
        expect(getInstallAction(options)).toBe(expected)
      })

      test('creates an exit-code-one non-interactive rejection', () => {
        expect(createNonInteractiveInstallError()).toMatchObject({
          code: 'NON_INTERACTIVE_INSTALL',
          exitCode: 1
        })
      })
    })

- [ ] Step 2: Run the focused test to verify it fails

Run: npx jest __tests__/installPolicy.test.js --runInBand

Expected: FAIL because lib/helpers/installPolicy.js does not exist.

- [ ] Step 3: Implement the minimal pure policy

Create lib/helpers/installPolicy.js with no process or terminal dependencies:

    'use strict'

    function getInstallAction({
      countErrors = 0,
      countWarnings = 0,
      isInteractive = false,
      disableAutoContinue = false,
      allowNonInteractiveInstall = false
    } = {}) {
      if (countErrors > 0) {
        return isInteractive ? 'prompt' : 'reject'
      }

      if (countWarnings > 0) {
        if (isInteractive) {
          return disableAutoContinue ? 'prompt' : 'countdown'
        }

        return !disableAutoContinue && allowNonInteractiveInstall ? 'install' : 'reject'
      }

      return 'install'
    }

    function createNonInteractiveInstallError() {
      const error = new Error(
        'Installation blocked: findings require an interactive terminal or an explicit non-interactive install opt-in.'
      )
      error.code = 'NON_INTERACTIVE_INSTALL'
      error.exitCode = 1
      return error
    }

    module.exports = {
      getInstallAction,
      createNonInteractiveInstallError
    }

- [ ] Step 4: Run the focused test to verify it passes

Run: npx jest __tests__/installPolicy.test.js --runInBand

Expected: PASS with all policy cases green.

- [ ] Step 5: Commit the policy unit

    git add lib/helpers/installPolicy.js __tests__/installPolicy.test.js
    git commit -m "test: define non-interactive install policy"

### Task 2: Make terminal detection and countdown behavior fail closed

Files:

- Modify: lib/helpers/cliPrompt.js:72-179
- Modify: lib/helpers/cliSupportHandler.js:47-71
- Modify: __tests__/cliPrompt.test.js:272-520
- Create: __tests__/cliSupportHandler.test.js
- Modify: __tests__/reportResults.test.js — update stdin-TTY fixtures for the shared terminal detector.

Interfaces:

- Consumes createNonInteractiveInstallError() from Task 1.
- autoContinue(options) continues to resolve { [name]: true } only when process.stdin.isTTY is truthy; otherwise it rejects with the Task 1 typed error before writing output or scheduling timers.
- isInteractiveTerminal() returns true only when stdin and stdout are TTYs and no supported CI environment variable is set.

- [ ] Step 1: Add the non-TTY regression and TTY fixture setup

In __tests__/cliPrompt.test.js, save and set process.stdin.isTTY = true in the autoContinue beforeEach, restore it in afterEach, and add this test before the existing countdown tests:

    test('rejects without output or timers outside a TTY', async () => {
      const originalIsTTY = process.stdin.isTTY
      process.stdin.isTTY = false

      try {
        await expect(
          autoContinue({ name: 'install', message: 'Install in ', timeInSeconds: 15 })
        ).rejects.toMatchObject({ code: 'NON_INTERACTIVE_INSTALL', exitCode: 1 })

        expect(mockWrite).not.toHaveBeenCalled()
        expect(jest.getTimerCount()).toBe(0)
      } finally {
        process.stdin.isTTY = originalIsTTY
      }
    })

- [ ] Step 2: Add terminal-detection tests

Create __tests__/cliSupportHandler.test.js with controlled stdin/stdout TTY values and CI cleanup:

    'use strict'

    const { isInteractiveTerminal } = require('../lib/helpers/cliSupportHandler')

    describe('isInteractiveTerminal', () => {
      const originalStdinTTY = process.stdin.isTTY
      const originalStdoutTTY = process.stdout.isTTY
      const originalCI = process.env.CI

      afterEach(() => {
        process.stdin.isTTY = originalStdinTTY
        process.stdout.isTTY = originalStdoutTTY
        if (originalCI === undefined) delete process.env.CI
        else process.env.CI = originalCI
      })

      test('requires both stdin and stdout to be TTYs', () => {
        delete process.env.CI
        process.stdin.isTTY = true
        process.stdout.isTTY = true
        expect(isInteractiveTerminal()).toBe(true)

        process.stdin.isTTY = false
        expect(isInteractiveTerminal()).toBe(false)
      })

      test('rejects a CI environment even when both streams are TTYs', () => {
        process.stdin.isTTY = true
        process.stdout.isTTY = true
        process.env.CI = 'true'
        expect(isInteractiveTerminal()).toBe(false)
      })
    })

Update __tests__/reportResults.test.js so every test that expects an interactive terminal sets both process.stdin.isTTY and process.stdout.isTTY to true; keep the existing CI and stdout-only negative cases, and add a stdin-not-TTY negative assertion.

- [ ] Step 3: Run the tests to verify the guard fails

Run: npx jest __tests__/cliPrompt.test.js __tests__/cliSupportHandler.test.js __tests__/reportResults.test.js --runInBand

Expected: FAIL because the current non-TTY branch counts down and isInteractiveTerminal() checks stdout only.

- [ ] Step 4: Remove the non-TTY fallback and require both TTY streams

At the start of autoContinue() in lib/helpers/cliPrompt.js, add the guard before any output or timer call:

    const { createNonInteractiveInstallError } = require('./installPolicy')

    async function autoContinue({ name, message, timeInSeconds = 5 } = {}) {
      if (!process.stdin.isTTY) {
        throw createNonInteractiveInstallError()
      }

      // Keep the existing TTY countdown body below this guard unchanged.
    }

Delete the existing else branch from lines 153-179. Keep the current raw-mode setup, keypress handling, cleanup, countdown rendering, Ctrl+C error, and return value in the TTY path.

In lib/helpers/cliSupportHandler.js, change the terminal test to:

    const isTTY = Boolean(process.stdin.isTTY && process.stdout.isTTY)
    return isTTY && !isCI

- [ ] Step 5: Run the focused tests to verify they pass

Run: npx jest __tests__/cliPrompt.test.js __tests__/cliSupportHandler.test.js __tests__/reportResults.test.js --runInBand

Expected: PASS, including all existing TTY countdown/Ctrl+C tests, reportResults terminal fixtures, and the new non-TTY rejection test.

- [ ] Step 6: Commit terminal safety

    git add lib/helpers/cliPrompt.js lib/helpers/cliSupportHandler.js __tests__/cliPrompt.test.js __tests__/cliSupportHandler.test.js __tests__/reportResults.test.js
    git commit -m "fix: reject non-interactive auto-continue"

### Task 3: Add opt-in parsing and coding-agent install routing metadata

Files:

- Modify: lib/cli.js:72-180
- Modify: __tests__/cli.parser.complete.test.js:208-633
- Modify: __tests__/cli.packageManagerArgs.test.js:150-175

Interfaces:

- CliParser.parseArgsFull() returns the existing fields plus allowNonInteractiveInstall: boolean.
- CliParser.parseArgsMinimal() returns the existing fields plus allowNonInteractiveInstall: boolean.
- In full parsing, json means output routing; JSON-safe package parsing is tracked separately so coding-agent explicit installs can use the normal install pipeline without losing safe invalid-input handling.

- [ ] Step 1: Write failing parser assertions

Add these cases to describe('parseArgsFull') in __tests__/cli.parser.complete.test.js:

    test('enables ordinary non-interactive installation from the CLI flag', () => {
      mockParseArgs.mockReturnValue({
        values: { 'allow-non-interactive-install': true },
        positionals: ['install', 'express']
      })

      expect(CliParser.parseArgsFull().allowNonInteractiveInstall).toBe(true)
    })

    test('enables ordinary non-interactive installation from the environment', () => {
      process.env.NPQ_ALLOW_NON_INTERACTIVE_INSTALL = 'true'
      mockParseArgs.mockReturnValue({ values: {}, positionals: ['install', 'express'] })

      expect(CliParser.parseArgsFull().allowNonInteractiveInstall).toBe(true)
      delete process.env.NPQ_ALLOW_NON_INTERACTIVE_INSTALL
    })

    test('uses coding-agent detection as authorization for explicit installs', () => {
      mockIsCodingAgentEnvironment.mockReturnValue(true)
      mockParseArgs.mockReturnValue({ values: {}, positionals: ['install', 'express'] })

      expect(CliParser.parseArgsFull()).toEqual(
        expect.objectContaining({
          json: false,
          allowNonInteractiveInstall: true,
          installSubcommandExplicit: true
        })
      )
    })

    test('keeps a coding-agent audit without an install command in JSON mode', () => {
      mockIsCodingAgentEnvironment.mockReturnValue(true)
      mockParseArgs.mockReturnValue({ values: {}, positionals: ['express'] })

      expect(CliParser.parseArgsFull()).toEqual(
        expect.objectContaining({ json: true, allowNonInteractiveInstall: false })
      )
    })

    test('explicit JSON wins over coding-agent install authorization', () => {
      mockIsCodingAgentEnvironment.mockReturnValue(true)
      mockParseArgs.mockReturnValue({ values: { json: true }, positionals: ['install', 'express'] })

      expect(CliParser.parseArgsFull()).toEqual(
        expect.objectContaining({ json: true, allowNonInteractiveInstall: false })
      )
    })

Update existing full-parser object equality assertions to include allowNonInteractiveInstall: false when neither an opt-in nor coding-agent explicit install is present.

In describe('parseArgsMinimal'), replace the current agent-install JSON expectation with:

    test('authorizes a coding-agent install without selecting JSON output mode', () => {
      mockIsCodingAgentEnvironment.mockReturnValue(true)
      mockParseArgs.mockReturnValue({ values: {}, positionals: ['install', 'express'] })

      expect(CliParser.parseArgsMinimal()).toEqual({
        packages: ['express@latest'],
        registryConfigArgs: [],
        installSubcommandExplicit: true,
        json: false,
        allowNonInteractiveInstall: true
      })
    })

Keep the existing invalid-agent-install test and assert that it still marks error.npqJsonMode = true; this preserves sanitized JSON failure output while successful installs use the normal pipeline. Update minimal-parser object equality assertions with allowNonInteractiveInstall: false when appropriate.

- [ ] Step 2: Run parser tests to verify they fail

Run: npx jest __tests__/cli.parser.complete.test.js __tests__/cli.packageManagerArgs.test.js --runInBand

Expected: FAIL because the new option is not parsed and coding-agent install parsing still sets json: true.

- [ ] Step 3: Implement full-parser precedence and safe package parsing

In CliParser.parseArgsFull(), add the option:

    'allow-non-interactive-install': { type: 'boolean' },

Replace the current JSON calculation and return fields with this sequence:

    const explicitJson = values.json === true
    const installSubcommandExplicit =
      positionals.length > 0 && this.isInstallSubcommand(positionals[0])
    const codingAgentDetected = isCodingAgentEnvironment()
    const json = explicitJson || (codingAgentDetected && !installSubcommandExplicit)
    const jsonPackageParsing = explicitJson || codingAgentDetected
    const normalizedPackages = this._extractPackagesFromPositionals(
      positionals,
      false,
      jsonPackageParsing
    )
    const allowNonInteractiveInstall =
      !explicitJson &&
      (values['allow-non-interactive-install'] === true ||
        process.env.NPQ_ALLOW_NON_INTERACTIVE_INSTALL === 'true' ||
        (codingAgentDetected && installSubcommandExplicit))

Return allowNonInteractiveInstall alongside the existing fields. Add the help text:

    --allow-non-interactive-install Allow warning-only installs without a TTY
    NPQ_ALLOW_NON_INTERACTIVE_INSTALL Set to 'true' to allow warning-only non-TTY installs

Keep --json as the output-routing override while retaining JSON-safe package normalization for detected coding-agent inputs.

- [ ] Step 4: Implement minimal-parser coding-agent authorization

In CliParser.parseArgsMinimal(), compute:

    const codingAgentInstall = codingAgentEnvironment && installSubcommandExplicit
    const jsonPackageParsing = codingAgentInstall
    const json = false
    const allowNonInteractiveInstall =
      codingAgentInstall || process.env.NPQ_ALLOW_NON_INTERACTIVE_INSTALL === 'true'

Pass jsonPackageParsing to _extractPackagesFromPositionals, retain the existing npqJsonMode marker when that safe parser rejects an agent install operand, and return allowNonInteractiveInstall with json: false. This keeps invalid-agent-install failures sanitized while allowing successful installs to enter the normal hero pipeline.

- [ ] Step 5: Run parser tests to verify they pass

Run: npx jest __tests__/cli.parser.complete.test.js __tests__/cli.packageManagerArgs.test.js --runInBand

Expected: PASS with explicit JSON precedence, ordinary flag/env opt-ins, coding-agent explicit-install authorization, and unchanged non-install passthrough parsing.

- [ ] Step 6: Commit parser routing metadata

    git add lib/cli.js __tests__/cli.parser.complete.test.js __tests__/cli.packageManagerArgs.test.js
    git commit -m "feat: authorize non-interactive install routing"

### Task 4: Integrate the policy into both executable pipelines

Files:

- Modify: bin/npq.js:26-188
- Modify: bin/npq-hero.js:21-154
- Modify: __tests__/cli.test.js:206-323
- Modify: __tests__/npqHero.test.js:96-152
- Modify: __tests__/exitCode.test.js:145-340

Interfaces:

- Consumes getInstallAction() and createNonInteractiveInstallError() from Task 1.
- Consumes allowNonInteractiveInstall from Task 3 parser results.
- Produces the invariant that pkgMgr.process() is unreachable after a rejected non-TTY finding.

- [ ] Step 1: Add failing standalone CLI route tests

In __tests__/cli.test.js, set isInteractiveTerminal.mockReturnValue(false) and add a warning-only explicit-install case:

    test('rejects non-TTY warning findings without invoking the package manager', async () => {
      const { CliParser } = require('../lib/cli')
      const cliPrompt = require('../lib/helpers/cliPrompt.js')
      const pkgMgr = require('../lib/packageManager')
      const { reportResults } = require('../lib/helpers/reportResults')
      const { isInteractiveTerminal } = require('../lib/helpers/cliSupportHandler')

      isInteractiveTerminal.mockReturnValue(false)
      CliParser.parseArgsFull.mockReturnValue({
        packages: ['express'],
        packageManager: 'npm',
        plain: true,
        dryRun: false,
        json: false,
        disableAutoContinue: false,
        allowNonInteractiveInstall: false,
        installSubcommandExplicit: true
      })
      reportResults.mockReturnValue({ countErrors: 0, countWarnings: 1 })

      require('../bin/npq.js')
      await new Promise(setImmediate)

      expect(cliPrompt.autoContinue).not.toHaveBeenCalled()
      expect(pkgMgr.process).not.toHaveBeenCalled()
      expect(CliParser.exit).toHaveBeenCalledWith(
        expect.objectContaining({ errorCode: 1 })
      )
    })

Add a second case with allowNonInteractiveInstall: true and assert pkgMgr.process is called while autoContinue is not called. Update the existing interactive warning test to set isInteractiveTerminal.mockReturnValue(true) so it continues to assert countdown routing.

In __tests__/npqHero.test.js, replace the current expectation that an agent install routes to runJsonCli() with an install-pipeline case using json: false and allowNonInteractiveInstall: true; assert RegistryConfig.load, Marshall, reportResults, and packageManager.process are called, while runJsonCli, prompt, and autoContinue are not. Preserve the existing non-install passthrough test and parser-failure JSON sanitization test.

In __tests__/exitCode.test.js, add a warning-only non-TTY explicit-install test with allowNonInteractiveInstall: false, assert CliParser.exit({ errorCode: 1 }), and assert pkgMgr.process was not called. Add the same test with allowNonInteractiveInstall: true and assert the mocked package manager result controls process.exitCode.

- [ ] Step 2: Run route tests to verify they fail

Run: npx jest __tests__/cli.test.js __tests__/npqHero.test.js __tests__/exitCode.test.js --runInBand

Expected: FAIL because both binaries currently call autoContinue() for non-TTY warnings and coding-agent hero installs still route to JSON.

- [ ] Step 3: Add policy routing to bin/npq.js

Import the policy helper:

    const {
      getInstallAction,
      createNonInteractiveInstallError
    } = require('../lib/helpers/installPolicy')

Use cliSupport.isInteractiveTerminal() for the policy isInteractive value, while keeping spinner creation separate from --plain:

    const isInteractive = cliSupport.isInteractiveTerminal()
    const spinner = isInteractive && !cliArgs.plain
      ? new Spinner({ text: 'Initiating...' })
      : null

Replace the warning/error prompt branch with this decision flow after the existing auditOnly branch:

    const action = getInstallAction({
      countErrors: result?.countErrors || 0,
      countWarnings: result?.countWarnings || 0,
      isInteractive,
      disableAutoContinue: cliArgs.disableAutoContinue,
      allowNonInteractiveInstall: cliArgs.allowNonInteractiveInstall
    })

    if (action === 'reject') {
      throw createNonInteractiveInstallError()
    }

    if (action === 'prompt') {
      return cliPrompt.prompt({
        name: 'install',
        message: 'Continue install ?',
        default: false
      })
    }

    if (action === 'countdown') {
      return cliPrompt.autoContinue({
        name: 'install',
        message: 'Auto-continue with install in... ',
        timeInSeconds: 15
      })
    }

    return { install: true }

Update the promise catch mapping so typed errors use their numeric exitCode before the existing ABORT_ERR and USER_ABORT cases:

    if (typeof error.code === 'number') {
      errorCode = error.code
    } else if (typeof error.exitCode === 'number') {
      errorCode = error.exitCode
    } else if (error.code === 'ABORT_ERR') {
      errorCode = 1
    } else if (error.code === 'USER_ABORT') {
      errorCode = error.exitCode || 1
    }

Keep cliArgs.json as the successful routing gate so explicit JSON and non-install coding-agent audits still call runJsonCli() before the install policy is reached.

- [ ] Step 4: Add the same policy routing to bin/npq-hero.js

Import the same two policy exports and compute terminal interactivity independently of the no-package spinner condition:

    const isInteractive = cliSupport.isInteractiveTerminal()
    const silentModeNoPackages = !cliArgs || !cliArgs.packages || cliArgs.packages.length === 0
    const spinner = isInteractive && !silentModeNoPackages
      ? new Spinner({ text: 'Initiating...' })
      : null

Use the same getInstallAction()/reject/prompt/countdown/install sequence, passing DISABLE_AUTO_CONTINUE and cliArgs.allowNonInteractiveInstall. Keep runJsonCli() only for parser states that explicitly return json: true; successful coding-agent install parsing returns json: false. Apply the same error.exitCode catch mapping.

- [ ] Step 5: Run route tests to verify they pass

Run: npx jest __tests__/cli.test.js __tests__/npqHero.test.js __tests__/exitCode.test.js --runInBand

Expected: PASS with no package-manager call for unauthorized non-TTY findings, direct package-manager calls for authorized warning-only installs, preserved interactive countdown routing, and preserved JSON audit-only routing.

- [ ] Step 6: Commit executable routing

    git add bin/npq.js bin/npq-hero.js __tests__/cli.test.js __tests__/npqHero.test.js __tests__/exitCode.test.js
    git commit -m "fix: fail closed on non-interactive findings"

### Task 5: Prove CI and coding-agent behavior with process-level tests

Files:

- Modify: __tests__/__fixtures__/json-process-preload.js:9-48
- Modify: __tests__/codingAgentCli.process.test.js:55-161

Interfaces:

- Consumes the executable behavior from Task 4 and the existing package-manager marker launcher.
- Produces process-level evidence for exit status, stdout mode, and package-manager invocation.

- [ ] Step 1: Make the process fixture deterministic

Change childEnvironment so every process test receives a concrete scenario and optional environment overrides. Keep the current package-manager marker setup and delete all coding-agent signal variables before adding the requested signal.

    function childEnvironment(signal, scenario = 'clean', extraEnvironment = {}) {
      const env = { ...process.env }
      for (const name of CODING_AGENT_ENVIRONMENT_VARIABLES) delete env[name]
      if (signal) env[signal.name] = signal.value
      env.NODE_OPTIONS = (env.NODE_OPTIONS || '').concat(' --require=', preload).trim()
      env.NPQ_JSON_TEST_SCENARIO = scenario
      env.NPQ_PKG_MGR = packageManagerLauncher
      return { ...env, ...extraEnvironment }
    }

Update run(binary, args, signal, scenario, extraEnvironment = {}) to pass the extra environment to childEnvironment.

- [ ] Step 2: Add failing ordinary non-TTY process tests

Add these cases to a non-interactive executable-routing describe block:

    test('npq blocks warning findings in ordinary non-TTY execution', () => {
      const result = run(npqBinary, ['install', 'express'], null, 'findings')

      expect(result.error).toBeUndefined()
      expect(result.status).toBe(1)
      expect(packageManagerRan()).toBe(false)
      expect([result.stdout, result.stderr].join('')).toContain('non-interactive')
    })

    test('npq installs warning findings with the explicit flag', () => {
      const result = run(
        npqBinary,
        ['install', 'express', '--allow-non-interactive-install'],
        null,
        'findings'
      )

      expect(result.error).toBeUndefined()
      expect(result.status).toBe(0)
      expect(packageManagerRan()).toBe(true)
    })

- [ ] Step 3: Replace coding-agent JSON-install expectations

Change the current npq emits JSON when a coding-agent signal is present test to run scenario findings, assert status 0, assert that stdout is human-readable rather than parseable JSON, and assert packageManagerRan() is true. Add a corresponding npq-hero install express test under CURSOR_AGENT with findings and the same direct package-manager expectation.

Change the current bare npq-hero install agent test to assert that project dependencies are audited and the package-manager marker is created; it must no longer call expectJson().

Keep the current npq-hero non-install passthrough test and invalid-agent-input sanitization test. Add an explicit JSON override case:

    test('explicit JSON remains audit-only under a coding-agent environment', () => {
      const result = run(npqBinary, ['install', 'express', '--json'], {
        name: 'CODEX_THREAD_ID',
        value: 'thread-123'
      }, 'findings')
      const report = expectJson(result, 1)

      expect(report.status).toBe('findings')
      expect(packageManagerRan()).toBe(false)
    })

Add an ordinary hero environment-opt-in case using extraEnvironment:
{ NPQ_ALLOW_NON_INTERACTIVE_INSTALL: 'true' }, then assert warning-only findings install without a countdown.

- [ ] Step 4: Run process-level tests to verify they fail

Run: npx jest __tests__/codingAgentCli.process.test.js --runInBand

Expected: FAIL because current coding-agent installs emit JSON and ordinary non-TTY warnings auto-approve through the fallback countdown.

- [ ] Step 5: Run process-level tests to verify they pass

Run: npx jest __tests__/codingAgentCli.process.test.js --runInBand

Expected: PASS with ordinary unauthorized findings exiting 1 and no marker, explicit flag/env findings installing, coding-agent explicit installs installing directly, explicit JSON remaining audit-only, and non-install hero commands still passing through.

- [ ] Step 6: Commit process-level coverage

    git add __tests__/__fixtures__/json-process-preload.js __tests__/codingAgentCli.process.test.js
    git commit -m "test: cover non-interactive install routing"

### Task 6: Document behavior and add the release note

Files:

- Modify: README.md:244-267
- Modify: docs/feature/auto-continue.md:119-160
- Modify: docs/feature/json-output.md:1-83
- Modify: docs/feature/exit-codes.md:7-65,83-96,109-118
- Modify: docs/feature/alias.md:38-52,148-153
- Modify: docs/README.md:94-113
- Create: .changeset/quiet-install-guard.md

Interfaces:

- Documents the public flag --allow-non-interactive-install and env var NPQ_ALLOW_NON_INTERACTIVE_INSTALL.
- Documents the coding-agent explicit-install exception and explicit --json precedence.
- Documents NON_INTERACTIVE_INSTALL as an exit-code-one rejection path without changing JSON statuses or the package-manager exit-code contract.

- [ ] Step 1: Write the user-facing documentation edits

Add this section near the existing auto-continue guidance in README.md:

    ### Non-interactive installs

    npq never uses the warning countdown when standard input is not interactive. If
    an audit reports warnings or errors in CI, npq exits nonzero and does not invoke
    the package manager.

    For ordinary automation that intentionally wants warning-only installs to
    continue, opt in explicitly:

        npq install express --allow-non-interactive-install
        NPQ_ALLOW_NON_INTERACTIVE_INSTALL=true npq install express

    Detected coding-agent environments are treated as an explicit opt-in for
    npq install express and npq-hero install express, so agent-driven package-manager
    installs continue without the extra flag. Explicit --json remains audit-only
    and never invokes the package manager.

In docs/feature/auto-continue.md, replace the current non-interactive fallback with:

    ### Non-interactive environments

    The countdown is available only when stdin and stdout are interactive TTYs.
    Outside a TTY, warning-only findings fail closed and the package manager is not
    invoked unless --allow-non-interactive-install or
    NPQ_ALLOW_NON_INTERACTIVE_INSTALL=true is set. A detected coding-agent
    environment is also authorized for explicit install commands. Error findings
    always remain fail-closed in non-interactive execution.

In docs/feature/json-output.md, replace the statement that all detected agent install commands are audit-only with:

    Explicit --json is always audit-only. For automatic coding-agent detection,
    non-install audits remain JSON/audit-only, while explicit npq install express and
    npq-hero install express commands use the normal audit/install pipeline and may
    pass through warning-only installs without a countdown.

In docs/feature/alias.md, replace the coding-agent table with rows for npq-hero install express and npq-hero install that say the normal audit/report/install pipeline runs, warning-only findings install directly, error findings fail closed, and test/run build remain passthrough. Add NPQ_ALLOW_NON_INTERACTIVE_INSTALL to the environment-variable table.

- [ ] Step 2: Update exit-code documentation

Add NON_INTERACTIVE_INSTALL to the docs/feature/exit-codes.md rejection description and update the install-path table with:

    | Unauthorized non-TTY findings | 1; package manager is not invoked |
    | Authorized warning-only non-TTY install | Package manager exit code |

State explicitly that error findings do not receive a non-interactive bypass and that explicit JSON continues to use 0/1/2 audit statuses.

- [ ] Step 3: Add the Changeset and plan index entry

Create .changeset/quiet-install-guard.md:

    ---
    'npq': patch
    ---

    Fail closed on warning and error findings outside an interactive terminal,
    while preserving explicit automation opt-ins and coding-agent package-manager
    passthrough for explicit install commands.

Under ## Implementation plans in docs/README.md, add:

    - [Non-interactive install safety](./superpowers/plans/2026-08-24-non-interactive-install-safety.md) - test-first plan for fail-closed non-TTY install routing and coding-agent passthrough.

- [ ] Step 4: Review documentation consistency

Run: rg -n "auto-continue|non-interactive|coding-agent|allow-non-interactive|NPQ_ALLOW_NON_INTERACTIVE|JSON" README.md docs/feature docs/README.md

Expected: every relevant page describes the same rules: ordinary non-TTY findings fail closed, coding-agent explicit installs are authorized, explicit JSON never installs, and errors never bypass confirmation.

- [ ] Step 5: Commit documentation and release metadata

    git add README.md docs/feature/auto-continue.md docs/feature/json-output.md docs/feature/exit-codes.md docs/feature/alias.md docs/README.md .changeset/quiet-install-guard.md
    git commit -m "docs: document non-interactive install safety"

### Task 7: Run complete verification and review the final diff

Files:

- Test: __tests__/installPolicy.test.js
- Test: __tests__/cliPrompt.test.js
- Test: __tests__/cliSupportHandler.test.js
- Test: __tests__/cli.parser.complete.test.js
- Test: __tests__/cli.packageManagerArgs.test.js
- Test: __tests__/cli.test.js
- Test: __tests__/npqHero.test.js
- Test: __tests__/exitCode.test.js
- Test: __tests__/codingAgentCli.process.test.js

Interfaces:

- Consumes all implementation and documentation changes from Tasks 1-6.
- Produces verified tests, lint, whitespace, and scope evidence before the work is declared complete.

- [ ] Step 1: Run all focused safety and routing tests together

Run:

    npx jest \
      __tests__/installPolicy.test.js \
      __tests__/cliPrompt.test.js \
      __tests__/cliSupportHandler.test.js \
      __tests__/cli.parser.complete.test.js \
      __tests__/cli.packageManagerArgs.test.js \
      __tests__/cli.test.js \
      __tests__/npqHero.test.js \
      __tests__/exitCode.test.js \
      __tests__/codingAgentCli.process.test.js \
      --runInBand

Expected: PASS with no skipped tests and no process-level timeouts.

- [ ] Step 2: Run the complete test suite

Run: npm test

Expected: PASS for the entire Jest suite.

- [ ] Step 3: Run lint and whitespace checks

Run:

    npm run lint
    git diff --check

Expected: ESLint and lockfile lint pass, and git diff --check prints no errors.

- [ ] Step 4: Verify the final scope

Run:

    git status --short
    git diff --stat
    git log -7 --oneline

Expected: only the intended implementation, tests, docs, and Changeset commits are present; the pre-existing untracked .env.development is not staged or modified.

## Self-review checklist

- Policy matrix covers clean, warning-only, error, interactive, ordinary non-TTY, explicit opt-in, coding-agent, disabled-auto-continue, and explicit JSON precedence cases.
- autoContinue cannot write output or schedule timers when stdin is not a TTY.
- Both binaries use the same pure policy and map rejection to exit code 1 before pkgMgr.process().
- Standalone parser supports the flag and env var; hero remains flag-free and supports the env var.
- Coding-agent explicit installs route normally; coding-agent non-install audits and explicit JSON remain audit-only.
- Existing JSON-safe invalid-input handling remains covered for coding-agent parser failures.
- Documentation, Changeset, and docs/README.md index entries cover the new public behavior.
- No plan step contains a placeholder or an undefined interface.
