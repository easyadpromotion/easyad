#!/usr/bin/env node
// Assembles the Capacitor webDir (www/) from this repo's flat collection of
// static HTML screens. There is no bundler for this project (see CLAUDE.md) -
// this just copies the browser-facing files the native shell needs to load
// and skips everything that isn't part of the app itself (SQL migrations,
// tooling, native platform projects, docs).

import { cp, mkdir, rm, readdir } from "node:fs/promises";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const wwwDir = join(rootDir, "www");

const INCLUDE_EXT = new Set([".html", ".js", ".jpg", ".jpeg", ".png", ".svg", ".ico", ".webp", ".gif"]);
const EXCLUDE_DIRS = new Set(["node_modules", "www", "android", "ios", "scripts", ".git", "resources"]);

async function main() {
  await rm(wwwDir, { recursive: true, force: true });
  await mkdir(wwwDir, { recursive: true });

  const entries = await readdir(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!EXCLUDE_DIRS.has(entry.name)) {
        console.warn(`Skipping unexpected directory: ${entry.name}`);
      }
      continue;
    }
    if (!INCLUDE_EXT.has(extname(entry.name).toLowerCase())) continue;
    await cp(join(rootDir, entry.name), join(wwwDir, entry.name));
  }

  console.log(`www/ assembled at ${wwwDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
