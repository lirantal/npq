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
