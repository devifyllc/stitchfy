/**
 * stitch-patcher — Applies a list of HtmlPatch operations to an HTML string.
 *
 * Each patch is a find-and-replace. Patches are applied sequentially so that
 * later patches can see earlier ones' results. The return value records which
 * patches matched (applied) and which didn't (skipped), so the reporter can
 * show exactly what changed per page.
 *
 * Safety boundary: patches must be attribute-level only. This module enforces
 * nothing about that — it's the agents' responsibility to stay within scope.
 */

import type { HtmlPatch } from "../agents/stitch-html-review.types.js";

export interface PatchResult {
  html: string;
  applied: string[];
  skipped: string[];
}

export function applyPatches(html: string, patches: HtmlPatch[]): PatchResult {
  let result = html;
  const applied: string[] = [];
  const skipped: string[] = [];

  for (const patch of patches) {
    const before = result;

    if (patch.find instanceof RegExp) {
      const flags = patch.replaceAll
        ? ensureGlobalFlag(patch.find)
        : patch.find;
      result = result.replace(flags, patch.replace);
    } else {
      // String find
      result = patch.replaceAll
        ? result.split(patch.find).join(patch.replace)
        : result.replace(patch.find, patch.replace);
    }

    if (result !== before) {
      applied.push(patch.description);
    } else {
      skipped.push(patch.description);
    }
  }

  return { html: result, applied, skipped };
}

function ensureGlobalFlag(re: RegExp): RegExp {
  if (re.flags.includes("g")) return re;
  return new RegExp(re.source, re.flags + "g");
}
