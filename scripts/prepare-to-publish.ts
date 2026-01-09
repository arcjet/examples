import fs from "node:fs/promises";
import path from "node:path";
import { type SimpleGit, simpleGit } from "simple-git";

const BASE_PATH = path.join(import.meta.dirname, "..");

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

const branch = await git.branch();
if (branch.current !== "main") {
  console.log("You must be on the 'main' branch to run this script.");
  process.exit(1);
}

const status = await git.status();
if (!status.isClean()) {
  console.log(
    "Your working directory is not clean. Please commit or stash your changes before running this script.",
  );
  process.exit(1);
}

// TODO(#31): Add an improved loading mechanism for workspaces
const workspaces = [
  ["@arcjet-examples/astro", path.join(BASE_PATH, "./examples/astro")],
  ["@arcjet-examples/deno", path.join(BASE_PATH, "./examples/deno")],
  ["@arcjet-examples/expressjs", path.join(BASE_PATH, "./examples/expressjs")],
  ["@arcjet-examples/fastapi", path.join(BASE_PATH, "./examples/fastapi")],
  ["@arcjet-examples/fastify", path.join(BASE_PATH, "./examples/fastify")],
  [
    "@arcjet-examples/firebase-functions",
    path.join(BASE_PATH, "./examples/firebase-functions"),
  ],
  ["@arcjet-examples/flask", path.join(BASE_PATH, "./examples/flask")],
  ["@arcjet-examples/nestjs", path.join(BASE_PATH, "./examples/nestjs")],
  [
    "@arcjet-examples/nextjs-bot-protection",
    path.join(BASE_PATH, "./examples/nextjs-bot-protection"),
  ],
  [
    "@arcjet-examples/nextjs-fly",
    path.join(BASE_PATH, "./examples/nextjs-fly"),
  ],
  [
    "@arcjet-examples/nextjs-form",
    path.join(BASE_PATH, "./examples/nextjs-form"),
  ],
  [
    "@arcjet-examples/nextjs-server-action",
    path.join(BASE_PATH, "./examples/nextjs-server-action"),
  ],
  ["@arcjet-examples/nextjs", path.join(BASE_PATH, "./examples/nextjs")],
  ["@arcjet-examples/nuxt", path.join(BASE_PATH, "./examples/nuxt")],
  [
    "@arcjet-examples/react-router",
    path.join(BASE_PATH, "./examples/react-router"),
  ],
  ["@arcjet-examples/sveltekit", path.join(BASE_PATH, "./examples/sveltekit")],
  [
    "@arcjet-examples/tanstack-start",
    path.join(BASE_PATH, "./examples/tanstack-start"),
  ],
] satisfies [string, string][];

const BUILD_PATH = path.join(BASE_PATH, "dist");

try {
  await fs.rm(BUILD_PATH, {
    recursive: true,
  });
} catch {
  // Ignore errors if the directory does not exist
}

// Iterate over each workspace and prepare it for publishing

for (const [workspaceName, workspacePath] of workspaces) {
  console.log(`Preparing '${workspaceName}'...`);

  // Read the `repository` field from the manifest

  let raw: string | null = null;
  // Try to read package.json first
  try {
    raw = await fs.readFile(
      path.join(workspacePath, "arcjet-example.json"),
      "utf-8",
    );
  } catch {
    // Intentionally left blank
  }

  // Fallback to reading example.json if package.json is not found
  // TODO(#31): Rework this script
  if (!raw) {
    raw = await fs.readFile(path.join(workspacePath, "package.json"), "utf-8");
  }

  const packageJson: unknown = JSON.parse(raw);
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
  const match = packageJson.repository.match(/^github:arcjet\/example-(.+)$/);
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
    // TODO(#31): Better handling of ignored files etc.
    if (path.basename(filePath) === "arcjet-example.json") {
      continue;
    }

    const relativeFilePath = path.relative(workspacePath, filePath);
    copyFilePromises.push(
      copyFile(filePath, path.join(workspaceBuildPath, relativeFilePath)),
    );
  }

  await Promise.all(copyFilePromises);

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
