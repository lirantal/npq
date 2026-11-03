# Testing

## Test Command

Run the test suite with:

```sh
npm run test
```

## Linting

Run lint checks with:

```sh
npm run lint
```


## Windows Coverage

The CI workflow runs the focused package-manager `.cmd` shim regression on `windows-latest` in addition to the regular Linux test suite.

## Expectations

- Add or update tests for behavior changes.
- Run the relevant package-level checks before opening a PR.
- Keep generated coverage, build output, and dependency folders out of commits.

## Codecov uploads

CI uploads this public repository's coverage without a Codecov upload token.
This uses the `lirantal` account's public tokenless upload setting in Codecov
(Settings → Global Upload Token). Upload errors fail CI.

Tokenless uploads and GitHub status publishing are separate: the Codecov
GitHub App needs access to this repository to post coverage checks and PR
comments. Keep that app access when using tokenless uploads.
See [Codecov upload authentication](https://docs.codecov.com/docs/codecov-tokens)
and [GitHub integration](https://docs.codecov.com/docs/team-bot).
