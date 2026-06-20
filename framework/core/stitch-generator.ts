/**
 * stitch-generator — Drives the full Stitch code-generation flow for a
 * multi-page website from a Stitchfy blueprint.
 *
 * Flow (per run):
 *   1. Create a Stitch project for this business
 *   2. Generate one Stitch screen per blueprint page (sequential — Stitch rate limits)
 *   3. Call get_screen per screen to retrieve HTML (build_site not on official endpoint)
 *   4. Post-process each page (inject SEO meta + accessibility attributes)
 *   5. Write output to output/stitch-site/{route}/index.html
 *
 * Requires STITCH_API_KEY in the environment.
 * Optional: STITCH_MODEL ("GEMINI_3_1_PRO" | "GEMINI_3_FLASH", default: GEMINI_3_1_PRO)
 */

import * as fs from "fs";
import * as path from "path";
import { StitchClient } from "./stitch-client.js";
import { buildPagePrompt } from "./stitch-prompt-builder.js";
import { postProcessPage } from "./stitch-post-processor.js";
import type { WebsiteBlueprint, PageDefinition } from "../schemas/blueprint.types.js";

export interface StitchGeneratorResult {
  ok: boolean;
  pagesGenerated: number;
  outputDir: string;
  projectId: string;
  errors: string[];
  warnings: string[];
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function generateWithStitch(
  blueprint: WebsiteBlueprint,
  outputDir: string,
  onProgress?: (message: string) => void
): Promise<StitchGeneratorResult> {
  const log = onProgress ?? (() => {});
  const errors: string[] = [];
  const warnings: string[] = [];

  // ── Validate env ────────────────────────────────────────────────────────────
  const apiKey = process.env.STITCH_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      pagesGenerated: 0,
      outputDir,
      projectId: "",
      errors: ["STITCH_API_KEY is not set — add it to your .env file"],
      warnings: [],
    };
  }

  const modelId =
    (process.env.STITCH_MODEL as "GEMINI_3_1_PRO" | "GEMINI_3_FLASH") ?? "GEMINI_3_1_PRO";

  const client = new StitchClient(apiKey);
  fs.mkdirSync(outputDir, { recursive: true });

  // ── Step 1: Create project ──────────────────────────────────────────────────
  log(`Creating Stitch project for "${blueprint.business.name}"...`);
  let projectId: string;
  try {
    projectId = await client.createProject(blueprint.business.name);
    log(`Project created: ${projectId}`);
  } catch (e) {
    return {
      ok: false,
      pagesGenerated: 0,
      outputDir,
      projectId: "",
      errors: [`Failed to create Stitch project: ${(e as Error).message}`],
      warnings: [],
    };
  }

  // ── Step 2: Generate one screen per page ────────────────────────────────────
  // Sequential — Stitch generates with Gemini and may have per-project rate limits.
  const screenMap: Array<{ screenId: string; route: string; page: PageDefinition }> = [];

  for (const page of blueprint.pages) {
    log(`Generating screen for page "${page.id}" (${page.path})...`);
    const prompt = buildPagePrompt(page, blueprint);

    try {
      const screenId = await client.generateScreen(projectId, prompt, modelId);
      screenMap.push({ screenId, route: page.path, page });
      log(`  Screen ready: ${screenId}`);
    } catch (e) {
      const msg = `Screen generation failed for "${page.id}": ${(e as Error).message}`;
      errors.push(msg);
      log(`  ✗ ${msg}`);
      // Non-fatal: skip this page, continue with the rest
    }
  }

  if (screenMap.length === 0) {
    return { ok: false, pagesGenerated: 0, outputDir, projectId, errors, warnings };
  }

  if (screenMap.length < blueprint.pages.length) {
    warnings.push(
      `${blueprint.pages.length - screenMap.length} page(s) skipped due to screen generation errors`
    );
  }

  // ── Step 3, 4 & 5: Fetch HTML per screen, post-process, and write ──────────
  // build_site is not available on the official endpoint — we call get_screen
  // individually for each generated screen and retrieve its HTML content.
  let pagesGenerated = 0;

  for (const { screenId, route, page } of screenMap) {
    log(`Fetching HTML for page "${page.id}" (screen: ${screenId})...`);

    let html: string;
    try {
      html = await client.getScreen(projectId, screenId);
    } catch (e) {
      const msg = `Failed to fetch HTML for "${page.id}": ${(e as Error).message}`;
      errors.push(msg);
      log(`  ✗ ${msg}`);
      continue;
    }

    const processed = postProcessPage(html, page, blueprint);

    // "/" → index.html, "/about" → about/index.html
    const relPath =
      route === "/" ? "index.html" : `${route.replace(/^\//, "").replace(/\/$/, "")}/index.html`;

    const fullPath = path.join(outputDir, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, processed, "utf-8");

    pagesGenerated++;
    log(`  Wrote ${relPath}`);
  }

  return { ok: pagesGenerated > 0, pagesGenerated, outputDir, projectId, errors, warnings };
}
