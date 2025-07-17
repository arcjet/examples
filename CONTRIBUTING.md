# Contributing to Arcjet Examples

## Development environment

We recommend using the provided
[devcontainer](https://code.visualstudio.com/docs/devcontainers/containers) to
develop examples in this repository. This ensures a consistent development
environment across all contributors.

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
1. Set up the shared stylesheet
   1. Add the shared `*.css` files to your example (for now copy from [examples/astro/src/styles](./examples/astro/src/styles))
   1. Install the required dependencies:
      ```bash
      npm install @fontsource-variable/figtree @fontsource/ibm-plex-mono @oddbird/css-anchor-positioning
      ```
   1. Import `styles.css` via your frameworks canonical method
   1. Conditionally import the [`@oddbird/css-anchor-positioning` polyfill](https://github.com/oddbird/css-anchor-positioning?tab=readme-ov-file#getting-started)
1. Follow the html structure of the other examples

### Publishing to a repository

1. Once the example has been merged into the `main` branch it can be published to it's own repository.
1. Create a new public repository on GitHub
   1. Following the naming convention
      > arcjet/example-[example-name]
   1. Do not initialize a README, .gitignore, or license
   1. Set the repository description
      > An example [framework] application protected by Arcjet
   1. Set the repository as a Template repository
   <!-- TODO(#8): Social preview -->
   1. Disable repository features
      - Wikis
      - Issues
      - Sponsorships
      - Discussions
      - Projects
   1. Disable GitHub actions
1. Add the `repository` field to the `package.json` of your example
   ```json
   {
     "repository": "github:arcjet/example-[example-name]"
   }
   ```

Your new example repository is now ready to be published to. Follow [Publishing an example](#publishing-an-example).

## Publishing an example

> [!NOTE]
> For now, publishing is only semi-automated. In the future we will likely fully
> automate this process via a GitHub Action & GitHub App.

1. Ensure you have `main` checked out and the working directory is clean.
1. Run the node script to prepare the examples for publishing:
   ```bash
   npm run prepare-to-publish
   ```
   This will:
   - Build the examples to verify they work
   - Shallow clone the corresponding example repositories into `dist/[example-name]`
   - Overwrite the `dist/[example-name]` with the current example
   - Write out an isolated `package-lock.json` for the example
   - If there are any changes, commit them to the example repository
   - Prompt you to push the changes to the example repository
1. Where prompted, sanity check and then push as directed
