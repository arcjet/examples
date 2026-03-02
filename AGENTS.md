# Agent Instructions

**This repository uses a devcontainer.** Always run inside it. You do NOT have
access to Docker commands (`docker`, `docker compose`, etc.) from within the
devcontainer.

## Dependency updates

See the [Updating dependencies](CONTRIBUTING.md#updating-dependencies) section in
CONTRIBUTING.md for the base commands.

The commands in CONTRIBUTING.md use `--interactive` for human use. As an agent,
follow this workflow instead:

### npm

**IMPORTANT**: This repository does NOT use npm workspaces. Each example is a
standalone project with its own `package-lock.json`. You must run `npm install`
in each example directory individually.

1. **Check available updates** - Run the command without `--interactive` or `-u` to
   see what updates are available across all examples
2. **Selectively update** - Use `-u` with `--filter 'package1,package2'` to update
   specific packages in all example `package.json` files
3. **Install and verify per-example** - Run `npm install` in EACH example directory
   individually.
4. **Handle peer dependency conflicts** - If peer dependency warnings occur during install:
   - First try: `npm install --legacy-peer-deps` followed by `npm install`
   - This two-step process resolves conflicts while keeping the lockfile clean
   - If still problematic, revert packages for that example and inform the user
5. **Clean up lockfile (CRITICAL)** - If you revert any dependency changes, running
   `npm i` again is NOT sufficient. You MUST clean up the lockfile to prevent
   bloating the diff:
   ```sh
   git checkout main -- examples/[example-name]/package-lock.json
   cd examples/[example-name]
   npm install
   ```

### deno

Deno dependencies are managed manually. See [CONTRIBUTING.md](CONTRIBUTING.md#deno)
for the manual process.

### uv (python)

Python dependencies are managed manually. See [CONTRIBUTING.md](CONTRIBUTING.md#uv-python)
for the manual process.

## security audit

After dependency updates (or independently), resolve known vulnerabilities.

**IMPORTANT**: Security audits must be run PER-EXAMPLE since this is not a workspace.

1. **For each example** with a `package-lock.json`:
   ```sh
   cd examples/[example-name]
   npm ci  # ensure lockfile is up to date
   npm audit
   ```
2. For each vulnerability in an example, attempt a fix:
   - Try `npm up <package>` for the affected top-level dependency.
   - If `npm up` doesn't help because the package is pinned, use
     `npx --no -- npm-check-updates --filter '<package>' --target minor -u`
     (or `--target patch`) then `npm install`.
   - **Do not** run `npm audit fix` or `npm audit fix --force` — npm lies about
     what these will do and they can cause unintended major version bumps.
3. After each dependency update, run `npm audit` again in that example:
   - If the vulnerability is resolved, commit the change immediately with
     **ONE COMMIT PER DEPENDENCY PER EXAMPLE**:
     `deps(<example-name>): update <package> past <GHSA-ID(s)>`
     For example, if `examples/astro` has vulnerabilities in `dep-a` and `dep-b`:
     ```txt
     deps(astro): update dep-a past GHSA-xxxx
     deps(astro): update dep-b past GHSA-yyyy
     ```
     Closely related packages (e.g. `svelte` + `@sveltejs/kit`) may be combined
     into a single commit referencing all their GHSA IDs.
   - If the vulnerability is **not** resolved, revert the change, clean up the
     lockfile (see step 5 in Dependency updates), and record the package so you
     can report it to the user at the end.
4. After processing all examples, report any vulnerabilities that could not be resolved.
