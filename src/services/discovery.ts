/**
 * VaultDiscovery — scan a root directory for MasterVaults.
 *
 * A MasterVault is identified by the presence of an `_orientation.md` file at
 * its root. This lets the server be pointed at a *projects root* ("find all my
 * vaults") rather than a single vault, which is convenient when several vaults
 * live under one parent.
 *
 * Credit: the multi-vault discovery idea (scan a root, identify vaults by their
 * orientation file, address them by name) was contributed by Grigori Korotkikh.
 * This implementation adapts that idea to the server's existing security model:
 * discovery only *locates* vaults; every file operation still goes through a
 * path-confined VaultService rooted at a specific discovered vault, so a vault
 * name can never be used to escape into an arbitrary path.
 */

import { promises as fs } from "node:fs";
import * as path from "node:path";
import { ORIENTATION_FILE } from "../constants.js";

export interface DiscoveredVault {
  name: string;
  path: string;
}

/** Maximum directory depth to descend when scanning, to bound the walk on a
 *  large or deep filesystem. */
const MAX_DEPTH = 4;

export class VaultDiscovery {
  private readonly root: string;

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  getRoot(): string {
    return this.root;
  }

  /**
   * Find every directory under the root that contains an orientation file.
   * Bounded by MAX_DEPTH and skips hidden dirs and node_modules to avoid
   * pathological scans. Never follows symlinks out of the tree (uses lstat
   * semantics via readdir withFileTypes and does not recurse into symlinked
   * directories).
   */
  async discover(): Promise<DiscoveredVault[]> {
    const found: DiscoveredVault[] = [];
    await this.walk(this.root, 0, found);
    // Stable, predictable ordering by name.
    found.sort((a, b) => a.name.localeCompare(b.name));
    return found;
  }

  private async walk(
    dir: string,
    depth: number,
    acc: DiscoveredVault[]
  ): Promise<void> {
    if (depth > MAX_DEPTH) return;

    // Is this dir itself a vault?
    try {
      await fs.access(path.join(dir, ORIENTATION_FILE));
      acc.push({ name: path.basename(dir), path: dir });
      // A vault can still contain sub-vaults, so we keep descending.
    } catch {
      // not a vault root; keep scanning
    }

    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const e of entries) {
      if (!e.isDirectory()) continue;
      // Skip hidden dirs and dependency/build folders.
      if (e.name.startsWith(".") || e.name === "node_modules") continue;
      // Do NOT descend into symlinked directories — avoids escaping the tree
      // and avoids symlink loops.
      if (e.isSymbolicLink && e.isSymbolicLink()) continue;
      await this.walk(path.join(dir, e.name), depth + 1, acc);
    }
  }

  /**
   * Resolve a discovered vault by name to its absolute path, confined to the
   * scan root. Returns null if no unique match. This is the ONLY bridge from a
   * user-supplied name to a path, and it never returns a path outside the root.
   */
  async resolveByName(name: string): Promise<string | null> {
    const vaults = await this.discover();
    const matches = vaults.filter((v) => v.name === name);
    if (matches.length !== 1) return null; // no match, or ambiguous
    const resolved = matches[0].path;
    // Defense in depth: confirm the resolved path is inside the scan root.
    const rel = path.relative(this.root, resolved);
    if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
    return resolved;
  }
}
