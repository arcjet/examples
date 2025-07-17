import fs from "node:fs/promises";
import path from "node:path";
import Arborist from "@npmcli/arborist";
import { type SimpleGit, simpleGit } from "simple-git";

const BASE_PATH = path.join(import.meta.dirname, "..");

/**
 * Checks if the lockfile is in sync with the current state of the node_modules.
 */
async function isLockfileInSync() {
  const arborist = new Arborist({
    path: path.join(import.meta.dirname, ".."),
    dryRun: true,
    ignoreScripts: true,
  });
  await arborist.reify();
  return !arborist.diff?.children?.length;
}

/**
 * Generates an isolated lockfile for a selected npm workspace.
 *
 * Based on similar functionality in the
 * {@linkcode https://github.com/0x80/isolate-package/blob/59e56f66069574ebbe1610ccbc83a48897924ff1/src/lib/lockfile/helpers/generate-npm-lockfile.ts | isolate-package}
 * npm package and
 * {@link https://github.com/npm/rfcs/issues/554 | npm RRFC 554}.
 *
 */
async function generateIsolatedLockfile(path: string): Promise<string> {
  const arborist = new Arborist({
    path,
  });

  const { meta } = await arborist.buildIdealTree();
  meta?.commit();

  return String(meta);
}

/**
 * Copies a file from one location to another, creating the necessary directories.
 */
async function copyFile(from: string, to: string): Promise<void> {
  await fs.mkdir(path.dirname(to), { recursive: true });
  await fs.copyFile(from, to);
}

/**
 * Lists all tracked files in a git repository at a given path.
 */
async function listTrackedFiles(
  git: SimpleGit,
  path?: string,
): Promise<string[]> {
  const filesRaw = await git.raw(
    typeof path === "string" ? ["ls-files", path] : ["ls-files"],
  );
  return filesRaw
    .split("\n")
    .map((f) => f.trim())
    .filter(Boolean);
}

const git = simpleGit({
  baseDir: BASE_PATH,
});

// Verify git status and branch

// const branch = await git.branch();
// if (branch.current !== "main") {
//   console.log("You must be on the 'main' branch to run this script.");
//   process.exit(1);
// }

// const status = await git.status();
// if (!status.isClean()) {
//   console.log(
//     "Your working directory is not clean. Please commit or stash your changes before running this script.",
//   );
//   process.exit(1);
// }

// Verify the lockfile is in sync with node_modules

if (!(await isLockfileInSync())) {
  console.log(
    "Lockfile is not in sync with node_modules. Please run `npm ci` to update it.",
  );
  process.exit(1);
}

// Read the list of workspaces via Arborist

const arborist = new Arborist({
  path: BASE_PATH,
});
const tree = await arborist.loadActual();

const workspaces = tree.workspaces;

if (!workspaces) {
  console.log("No workspaces found in the current project.");
  process.exit(1);
}

const BUILD_PATH = path.join(BASE_PATH, "dist");

await fs.rm(BUILD_PATH, {
  recursive: true,
});

// Iterate over each workspace and prepare it for publishing

for (const [workspaceName, workspacePath] of workspaces) {
  console.log(`Preparing '${workspaceName}'...`);

  // Read the `repository` field from the package.json

  const packageJson: unknown = JSON.parse(
    await fs.readFile(path.join(workspacePath, "package.json"), "utf-8"),
  );
  if (typeof packageJson !== "object" || packageJson === null) {
    console.error(`Invalid package.json in '${workspaceName}'`);
    continue;
  }

  if (
    !("repository" in packageJson) ||
    typeof packageJson.repository !== "string"
  ) {
    console.error(
      `No repository field found in '${workspaceName}'s package.json`,
    );
    continue;
  }

  /**
   * Spefically match only arcjet/example-<name> to avoid any potential leaks
   * of private repositories.
   */
  const match = packageJson.repository.match(/^github:arcjet\/example-(\w+)$/);
  if (!match) {
    console.error(
      `Invalid repository field in '${workspaceName}'s package.json`,
    );
    continue;
  }

  const workspaceBuildPath = path.join(
    BUILD_PATH,
    path.basename(workspacePath),
  );

  // Shallow clone the corresponding example repository

  await git.clone(
    `git@github.com:arcjet/example-${match[1]}.git`,
    workspaceBuildPath,
    ["--depth", "1"],
  );

  const workspaceGit = simpleGit({
    baseDir: workspaceBuildPath,
  });

  // Delete all files in the cloned repository that were previously tracked

  const previousFiles = await listTrackedFiles(workspaceGit);
  const deleteFilePromises: Promise<void>[] = [];
  for (const file of previousFiles) {
    deleteFilePromises.push(fs.rm(path.join(workspaceBuildPath, file)));
  }
  await Promise.all(deleteFilePromises);

  // Copy all files from the workspace to the cloned repository

  const copyFilePromises: Promise<void>[] = [];
  for (const filePath of await listTrackedFiles(git, workspacePath)) {
    const relativeFilePath = path.relative(workspacePath, filePath);
    copyFilePromises.push(
      copyFile(filePath, path.join(workspaceBuildPath, relativeFilePath)),
    );
  }

  await Promise.all(copyFilePromises);

  // Write an isolated lockfile for the workspace

  const workspaceLockfile = await generateIsolatedLockfile(workspacePath);
  await fs.writeFile(
    path.join(workspaceBuildPath, "package-lock.json"),
    workspaceLockfile,
    "utf8",
  );

  // Check if there are any changes to commit

  const status = await workspaceGit.status();
  if (status.isClean()) {
    console.log(`'${workspaceName}' is unchanged.`);
    continue;
  }

  // Write a commit message with the current commit hash

  await workspaceGit.add("./*");
  await workspaceGit.commit(
    `Publish https://github.com/arcjet/examples/commit/${await git.revparse(["HEAD"])}`,
  );

  // Prompt the user to push the changes

  const promptString = `
Detected changes for '${workspaceName}' have been commited.
To push the changes run:

  cd '${workspaceBuildPath}'
  git push origin main

`;

  console.log(promptString);
}
