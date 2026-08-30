import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

/**
 * Every IPv4 address this machine answers on.
 *
 * Testing on a phone means loading the dev server over the LAN by IP, and
 * Next blocks cross-origin requests to dev assets by default: the HTML
 * arrives, every script 403s, hydration never happens, and you are left
 * staring at the server-rendered shell.
 *
 * The list is computed rather than hard-coded because the address changes
 * with the network — ours moved from 192.168.1.40 to 10.192.44.175 between
 * two sessions, and a pinned value would have silently gone stale again.
 * CIDR ranges are not accepted here; it has to be exact hosts.
 *
 * Development only. Production serves its assets normally.
 */
function lanAddresses(): string[] {
  const found: string[] = [];
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) found.push(entry.address);
    }
  }
  return found;
}

const nextConfig: NextConfig = {
  // `next dev` otherwise appends a generated block to CLAUDE.md on every boot.
  // On macOS the filesystem is case-insensitive, so that file *is* the
  // project's own claude.md — we keep Next.js out of it. The Next 16 notes
  // that block carries live in this repo's agent memory instead.
  agentRules: false,

  allowedDevOrigins: [...lanAddresses(), "*.local"],
};

export default nextConfig;
