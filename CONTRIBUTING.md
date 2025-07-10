# Contributing to Arcjet Examples

## Static analysis

We use [Trunk](https://docs.trunk.io/) to manage formatting and linting in this
repository. If you arn't using the provided devcontainer, you'll need to
[install Trunk locally](https://docs.trunk.io/references/cli/install).

Once installed you have access to the following commands:

```shell
# Format all changed files
trunk fmt

# Lint all changed files
trunk check
```

> [!TIP]
> If you encounter Biome import sorting issues, stage the effected files and
> run:
>
> ```shell
> npm run sort-staged-imports
> ```

## Adding a new example

> [!NOTE]
> This guide is for adding new examples using the Arcjet JS SDK.

1. Place your example in the `examples` directory.
2. Set up the shared stylesheet
   1. Add the shared `*.css` files to your example (for now copy from [examples/astro/src/styles](./examples/astro/src/styles))
   2. Install the required dependencies:
      ```bash
      npm install @fontsource-variable/figtree @fontsource/ibm-plex-mono @oddbird/css-anchor-positioning
      ```
   3. Import `styles.css` via your frameworks canonical method
   4. Conditionally import the [`@oddbird/css-anchor-positioning` polyfill](https://github.com/oddbird/css-anchor-positioning?tab=readme-ov-file#getting-started)
3. Follow the html structure of the other examples
