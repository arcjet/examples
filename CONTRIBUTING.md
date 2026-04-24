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
6. [Publishing an example (automated)](#publishing-an-example-automated)
7. [Publishing an example (manual)](#publishing-an-example-manual)
8. [Setting up the Publish GitHub App](#setting-up-the-publish-github-app)
9. [Updating dependencies](#updating-dependencies)
   - [npm](#npm)
   - [Deno](#deno)
10. [Helpful commands](#helpful-commands)

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
     npm install @fontsource-variable/figtree @fontsource/ibm-plex-mono
     ```

   - Import `styles.css` using your framework’s standard method.

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

3. **Add the repository to the publish workflow allowlist**
   - Open [`.github/workflows/publish.yml`](./.github/workflows/publish.yml).
   - Add `example-[example-name]` to the `repositories` list in the
     `Create GitHub App Token` step.

Your example repository is now ready to receive code. Next, follow [Publishing an example (automated)](#publishing-an-example-automated).

---

## Publishing an example (automated)

The **Publish Examples** workflow (`.github/workflows/publish.yml`) pushes every
example to its own `arcjet/example-*` repository using a GitHub App for
authentication.

1. Open the [Actions tab](../../actions/workflows/publish.yml).
2. Click **Run workflow** → select the `main` branch → **Run workflow**.

The workflow will:
- Shallow clone each example’s destination repository
- Overwrite it with the current example source
- Commit and push any changes

> [!NOTE]
> The workflow requires a GitHub App to be configured. See
> [Setting up the Publish GitHub App](#setting-up-the-publish-github-app).

---

## Publishing an example (manual)

If the automated workflow is unavailable you can publish locally:

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

   _Remember it’s a proper (shallow) git repository! You’ll only be able to see the last commit but the power of git is still there if you need it!_

---

## Setting up the Publish GitHub App

The [Publish Examples workflow](./.github/workflows/publish.yml) authenticates
via a [GitHub App](https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps/about-creating-github-apps)
so it can push to the `arcjet/example-*` repositories. Follow these steps to
create the app (org admin required):

1. **Create a new GitHub App** at
   <https://github.com/organizations/arcjet/settings/apps/new>.

   | Setting | Value |
   | --- | --- |
   | **App name** | `Arcjet Examples Publish` (or similar) |
   | **Homepage URL** | `https://github.com/arcjet/examples` |
   | **Webhook → Active** | **Unchecked** (no webhook needed) |

2. **Set repository permissions** — grant only what is needed:

   | Permission | Access |
   | --- | --- |
   | **Contents** | **Read & write** |

   No other permissions are required.

3. **Install the app** on the `arcjet` organization:
   - Go to **Install App** in the app settings.
   - Choose **Only select repositories** and pick every `example-*`
     repository listed in the workflow's `repositories` input.

4. **Store credentials** in the `arcjet/examples` repository:
   - Copy the app's **Client ID** → create a **repository variable**
     named `PUBLISH_APP_CLIENT_ID` under
     **Settings → Secrets and variables → Actions → Variables**.
   - Generate a **private key** in the app settings → create a
     **repository secret** named `PUBLISH_APP_PRIVATE_KEY` under
     **Settings → Secrets and variables → Actions → Secrets**.

> [!TIP]
> For more details, see the
> [`actions/create-github-app-token` documentation](https://github.com/actions/create-github-app-token).

---

## Updating dependencies

### npm

We use [`npm-check-updates`](https://www.npmjs.com/package/npm-check-updates#cooldown) with a **30‑day cooldown**.

- **Update Arcjet packages to the latest version:**

  ```sh
  npx --no -- npm-check-updates --interactive --packageFile 'examples/*/package.json' --filter 'arcjet, @arcjet/*, nosecone, @nosecone/*' --target latest
  ```

- **Recursively update all dependencies to the greatest minor within cooldown:**

  ```sh
  npx --no -- npm-check-updates --interactive --packageFile 'examples/*/package.json' --cooldown 30 --target minor
  ```

- **Recursively update all dependencies to the latest within cooldown:**

  ```sh
  npx --no -- npm-check-updates --interactive --packageFile 'examples/*/package.json' --cooldown 30 --target @latest
  ```

### Deno

Deno dependencies are currently managed manually. Open the `deno-2` devcontainer and run:

```sh
cd examples/deno
deno update --interactive --latest
```

### uv (Python)

Python dependencies are currently managed extra manually. From the `python-3` devcontainer:



```sh
# Run from an example folder, e.g. examples/fastapi

# Show top-level outdated dependencies
uv tree --depth 1 --outdated | grep latest

# Show installed version of a specific package
uv tree --package <package-name>

# Update specific transitive package
uv lock --upgrade-package <package-name>

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
