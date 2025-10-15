# Contributing to Arcjet Examples

Thanks for helping improve the Arcjet Examples! This guide explains how to set
up your environment, run examples, follow our lint/format rules, add a new
example, publish it to its own repository, and keep dependencies up to date.

---

## Table of contents

1. [Development environment](#development-environment)
2. [Starting the examples](#starting-the-examples)
3. [Static analysis (formatting & linting)](#static-analysis-formatting--linting)
4. [Adding a new example (Arcjet JS SDK)](#adding-a-new-example-arcjet-js-sdk)
5. [Publishing to a new repository](#publishing-to-a-new-repository)
6. [Publishing an example (semi‑automated)](#publishing-an-example-semiautomated)
7. [Updating dependencies](#updating-dependencies)
   - [npm](#npm)
   - [Deno](#deno)
8. [Helpful commands](#helpful-commands)

---

## Development environment

We recommend using the provided [Dev Container](https://code.visualstudio.com/docs/devcontainers/containers). It gives you a consistent toolchain and avoids “works on my machine” issues.

> [!TIP]
> You can still work locally without the devcontainer; just be sure to install the tools referenced below (e.g., Docker, Trunk).

---

## Starting the examples

From **outside** the devcontainer, start all examples in watch mode:

```sh
# You'll likely need to populate the relevant .env files first
docker compose up [example-name]  # e.g. astro, deno, expressjs, etc.
```

When using [OrbStack](https://orbstack.dev/), each example will be reachable at:

```
[example-name].arcjet-examples.orb.local
# e.g. astro.arcjet-examples.orb.local
```

> [!TIP]
> Using a different Docker provider? Ports will be auto‑assigned and examples will be served at `http://localhost:<port>` rather than `*.arcjet-examples.orb.local`.
> Run `docker compose ps` to find the assigned ports.

---

## Static analysis (formatting & linting)

We use [Trunk](https://docs.trunk.io/) to manage formatting and linting.

If you’re **not** using the devcontainer, first [install Trunk locally](https://docs.trunk.io/references/cli/install).

Once installed:

```sh
# Format all changed files
trunk fmt

# Lint all changed files
trunk check
```

> [!TIP]
> If you hit Biome import‑sorting issues, stage the affected files and run:
>
> ```sh
> npm run sort-staged-imports
> ```

---

## Adding a new example (Arcjet JS SDK)

> [!NOTE]
> These steps are for examples built with the **Arcjet JS SDK**.

1. **Create the project**
   - Place your example in the `examples/` directory.

2. **Set up the shared stylesheet**
   - Copy the shared `*.css` files (temporarily copy from [`examples/astro/src/styles`](./examples/astro/src/styles)).
   - Install required dependencies:

     ```sh
     npm install @fontsource-variable/figtree @fontsource/ibm-plex-mono @oddbird/css-anchor-positioning
     ```

   - Import `styles.css` using your framework’s standard method.
   - Conditionally load the [`@oddbird/css-anchor-positioning` polyfill](https://github.com/oddbird/css-anchor-positioning?tab=readme-ov-file#getting-started).

3. **Match the HTML structure**
   - Follow the general HTML structure used by existing examples to stay consistent.

4. **Containerization**
   - Add a `Dockerfile` and a `compose.yaml` in your example folder.
   - Link your example service in the **root** `compose.yaml`.

5. **(Temporary) Workspace entry**
   - Until [#31](https://github.com/arcjet/examples/issues/31) is resolved, manually add your example to the `workspaces` array in [`scripts/prepare-to-publish.ts`](./scripts/prepare-to-publish.ts).

---

## Publishing to a new repository

Once your example is merged into `main`, you can publish it to its own repository.

1. **Create a public GitHub repository**
   - Naming: `arcjet/example-[example-name]`
   - Do **not** initialize a README, `.gitignore`, or license.
   - Description: `An example [framework] application protected by Arcjet`
   - Mark as a **Template repository**
   - Disable repository features you won’t need:
     - Wikis
     - Issues
     - Sponsorships
     - Discussions
     - Projects

   - Disable GitHub Actions

2. **Add the repository field to your example’s `package.json`**

   ```json
   {
     "repository": "github:arcjet/example-[example-name]"
   }
   ```

Your example repository is now ready to receive code. Next, follow [Publishing an example](#publishing-an-example-semiautomated).

---

## Publishing an example (semi‑automated)

> [!NOTE]
> This process is currently semi‑automated. We may fully automate it with a GitHub Action & GitHub App in the future.

1. Ensure you have `main` checked out and a clean working directory.
2. Build all Docker images to validate they’re healthy (run **outside** the devcontainer):

   ```sh
   docker compose build
   ```

3. Prepare examples for publishing:

   ```sh
   npm run prepare-to-publish
   ```

   This script will:
   - Shallow clone each example’s destination repo into `dist/[example-name]`
   - Overwrite `dist/[example-name]` with the current example
   - Commit any changes to the example repository
   - Prompt you to push the changes upstream

4. When prompted, sanity‑check the changes and push.

   ```sh
   # Check changed files
   git diff --name-only HEAD^
   ```

   _Remember it's a proper (shallow) git repository! You'll only be able to see the last commit but the power of git is still there if you need it!_

---

## Updating dependencies

### npm

We use [`npm-check-updates`](https://www.npmjs.com/package/npm-check-updates#cooldown) with a **30‑day cooldown**.

- **Update Arcjet packages to the latest version:**

  ```sh
  npx npm-check-updates --interactive --packageFile 'examples/*/package.json' --filter 'arcjet, @arcjet/*, nosecone, @nosecone/*' --target latest
  ```

- **Recursively update all dependencies to the greatest minor within cooldown:**

  ```sh
  npx npm-check-updates --interactive --packageFile 'examples/*/package.json' --cooldown 30 --target minor
  ```

- **Recursively update all dependencies to the latest within cooldown:**

  ```sh
  npx npm-check-updates --interactive --packageFile 'examples/*/package.json' --cooldown 30 --target @latest
  ```

### Deno

Deno dependencies are currently managed manually. Open the `deno-2` devcontainer and run:

```sh
cd examples/deno
deno update --interactive --latest
```

## Helpful commands

Destroy all docker containers + volumes (can be relevant for dependency updates):

```sh
docker compose down -v
```

Rebuild all examples:

_Typically if this passes without error, everything is working relatively well._

```sh
docker compose build --no-cache
```

VSCode switch devcontainer:

```txt
[COMMAND]+[P] > Dev Containers: Switch Container
```
