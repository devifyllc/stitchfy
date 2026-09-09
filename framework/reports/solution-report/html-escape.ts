/**
 * Shared escaping for solution-report.html. Every blueprint-derived string
 * must pass through one of these before landing in the output — no raw
 * interpolation anywhere in render.ts (task: "Treat all blueprint content
 * as untrusted text when rendering HTML").
 */

export function escHtml(value: unknown): string {
  const s = value === undefined || value === null ? "" : String(value);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Same rule applies to attribute values — escHtml already escapes quotes, so it doubles as escAttr. */
export const escAttr = escHtml;

/** A conservative slug for use in id="..."/href="#..." anchors — ids in this codebase are already [A-Z0-9-]+ but this stays safe if that ever changes. */
export function slugify(id: string): string {
  return id.replace(/[^A-Za-z0-9_-]/g, "-");
}
