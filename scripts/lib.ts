import fs from "node:fs/promises";
import path from "node:path";
import type { SimpleGit } from "simple-git";

/**
 * Copies a file from one location to another, creating the necessary directories.
 */
export async function copyFile(from: string, to: string): Promise<void> {
  await fs.mkdir(path.dirname(to), { recursive: true });
  await fs.copyFile(from, to);
}

/**
 * Lists all tracked files in a git repository at a given path.
 */
export async function listTrackedFiles(
  git: SimpleGit,
  filePath?: string,
): Promise<string[]> {
  const filesRaw = await git.raw(
    typeof filePath === "string" ? ["ls-files", filePath] : ["ls-files"],
  );
  return filesRaw
    .split("\n")
    .map((f) => f.trim())
    .filter(Boolean);
}

/**
 * Loads all example workspaces from the `examples/` directory.
 * Returns an array of [workspaceName, workspacePath] tuples.
 */
export async function loadExamples(
  baseDir: string,
): Promise<[string, string][]> {
  const examplesDir = path.join(baseDir, "examples");
  const entries = await fs.readdir(examplesDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => [
      `@arcjet-examples/${entry.name}`,
      path.join(examplesDir, entry.name),
    ]);
}
