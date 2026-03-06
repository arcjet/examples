import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { copyFile, loadExamples } from "./lib.ts";

describe("copyFile", () => {
  it("copies a file to the destination", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "aj-test-"));
    try {
      const src = path.join(tmpDir, "src.txt");
      const dst = path.join(tmpDir, "subdir", "dst.txt");
      await fs.writeFile(src, "hello");
      await copyFile(src, dst);
      const content = await fs.readFile(dst, "utf-8");
      assert.equal(content, "hello");
    } finally {
      await fs.rm(tmpDir, { recursive: true });
    }
  });

  it("creates intermediate directories", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "aj-test-"));
    try {
      const src = path.join(tmpDir, "src.txt");
      const dst = path.join(tmpDir, "a", "b", "c", "dst.txt");
      await fs.writeFile(src, "world");
      await copyFile(src, dst);
      const content = await fs.readFile(dst, "utf-8");
      assert.equal(content, "world");
    } finally {
      await fs.rm(tmpDir, { recursive: true });
    }
  });
});

describe("loadExamples", () => {
  it("returns an empty array when examples dir is empty", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "aj-test-"));
    try {
      await fs.mkdir(path.join(tmpDir, "examples"));
      const examples = await loadExamples(tmpDir);
      assert.deepEqual(examples, []);
    } finally {
      await fs.rm(tmpDir, { recursive: true });
    }
  });

  it("returns workspace tuples for each example directory", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "aj-test-"));
    try {
      await fs.mkdir(path.join(tmpDir, "examples", "astro"), {
        recursive: true,
      });
      await fs.mkdir(path.join(tmpDir, "examples", "nextjs"), {
        recursive: true,
      });
      const examples = await loadExamples(tmpDir);
      assert.deepEqual(examples, [
        ["@arcjet-examples/astro", path.join(tmpDir, "examples", "astro")],
        ["@arcjet-examples/nextjs", path.join(tmpDir, "examples", "nextjs")],
      ]);
    } finally {
      await fs.rm(tmpDir, { recursive: true });
    }
  });

  it("ignores non-directory entries", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "aj-test-"));
    try {
      await fs.mkdir(path.join(tmpDir, "examples", "astro"), {
        recursive: true,
      });
      await fs.writeFile(path.join(tmpDir, "examples", "file.txt"), "");
      const examples = await loadExamples(tmpDir);
      assert.deepEqual(examples, [
        ["@arcjet-examples/astro", path.join(tmpDir, "examples", "astro")],
      ]);
    } finally {
      await fs.rm(tmpDir, { recursive: true });
    }
  });
});
