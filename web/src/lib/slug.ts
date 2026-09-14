import { randomBytes } from "node:crypto";

// Same normalization as the 009_auth.sql backfill, so newly created
// businesses and pre-existing seeded ones look consistent.
export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const suffix = randomBytes(4).toString("hex");
  return `${base}-${suffix}`;
}
