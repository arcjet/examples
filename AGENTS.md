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
standalone project with its own `package.json`. Examples declare caret ranges
and do not commit a lockfile, so `npm install` in an example resolves the
newest versions those ranges allow. Run `npm install` in each example directory
individually.

A routine release inside an existing range needs no change. Update an example's
`package.json` only to raise a range's lower bound (to require a fix or a new
API) or to move to a new major version.

1. **Check available updates** - Run the command without `--interactive` or `-u` to
   see what updates are available across all examples
2. **Selectively update** - Use `-u` with `--filter 'package1,package2'` to update
   specific packages in all example `package.json` files. Keep the caret: write
   `^1.15.0`, not `1.15.0`.
3. **Install and verify per-example** - In EACH changed example directory, run
   `npm install`, then the example's `build` script, or `typecheck` if it has no
   `build` script.
4. **Handle peer dependency conflicts** - If `npm install` fails with `ERESOLVE`,
   raise the lower bound of the package named in the peer requirement so the
   ranges agree. If they still cannot agree, revert that example's
   `package.json` and inform the user.

Exception: `examples/tanstack-start` declares `@tanstack/react-start` and
`@tanstack/react-router` as exact versions. Each `@tanstack/react-start` release
depends on one exact `@tanstack/react-router` release, so the two must be
updated together to a matching pair.

### deno

Deno dependencies are managed manually. See [CONTRIBUTING.md](CONTRIBUTING.md#deno)
for the manual process.

### uv (python)

Python dependencies are managed manually. See [CONTRIBUTING.md](CONTRIBUTING.md#uv-python)
for the manual process.

## security audit

After dependency updates (or independently), resolve known vulnerabilities.

**IMPORTANT**: Security audits must be run PER-EXAMPLE since this is not a workspace.

1. **For each example** with a `package.json`:
   ```sh
   cd examples/[example-name]
   npm install
   npm audit
   ```
2. For each vulnerability in an example, attempt a fix:
   - Try `npm up <package>` for the affected top-level dependency.
   - If `npm up` doesn't help because the example's range excludes the fixed
     release, raise the range's lower bound with
     `npx --no -- npm-check-updates --filter '<package>' --target minor -u`
     (or `--target patch`), keep the caret, then run `npm install`.
   - If the affected package is a transitive dependency whose parent's range
     excludes the fixed release, add an override as described in
     [OVERRIDES.md](OVERRIDES.md).
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
   - If the vulnerability is **not** resolved, revert the change and record the
     package so you can report it to the user at the end.
4. After processing all examples, report any vulnerabilities that could not be resolved.
