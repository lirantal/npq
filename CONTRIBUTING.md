# Contribution Guidelines

Please review below for developer guidelines on general project contribution guidelines as well as writing your own marshalls plugin.

## Contributing Marshalls

### A Marshall's Interface

A Marshall always extends the BaseMarshall class and needs to implement the following interface:
* `title(): string`
* `isEnabled(ctx: object): boolean`
* `run(ctx: object, task: object): Promise<>`

for reference about the `ctx` and `task` objects passed to tasks refer to [listr](https://github.com/SamVerschueren/listr) package documentation.

### run()

The `run()` method must be able to support multiple packages provided in `ctx.pkgs` to run its check upon.

If you implement multiple packages checks with a `Promise.all()` strategy you should be aware that it will fail-fast on exceptions. This default behavior is not desirable because while errors exist in one packge, you would still want to continue running your checks on the other packages as well.

To mitigate that, your specific check method should now throw an exception if it fails, but instead catch it and call
```js
this.setError({
          pkg: pkg,
          message: err.message
        })
```
to record an error that happened in a specific package.

### General Marshalls Guidelines

* Never overwrite `ctx.pkgs` property


## Tests

Make sure you the code you're adding has decent test coverage.

Running project tests and coverage:

```bash
npm run test
```

## Commit Guidelines

The project uses the commitizen tool for standardizing changelog style commit
messages so you should follow it as so:

```bash
git add .           # add files to staging
yarn run commit      # use the wizard for the commit message
```

