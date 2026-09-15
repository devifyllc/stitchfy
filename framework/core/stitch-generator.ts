/**
 * stitch-generator — Drives the full Stitch code-generation flow for a
 * multi-page website from a Stitchfy blueprint.
 *
 * Flow (per run):
 *   1. Create a Stitch project for this business
 *   2. Generate one Stitch screen per blueprint page (sequential — Stitch rate limits)
 *   3. Fetch HTML per screen via get_screen
 *   4. Post-process each page (inject SEO meta + base accessibility attributes)
 *   5. Run SEO + A11y review agents → collect patches and findings
 *   6. Apply patches (attribute-level fixes only)
 *   7. Write final HTML to output/stitch-site/{route}/index.html
 *   8. Generate output/reports/stitch-review-report.html
 *
 * Requires STITCH_API_KEY in the environment.
 * Optional: STITCH_MODEL ("GEMINI_3_8_FLASH" | "GEMINI_3_5_FLASH_LITE", default: GEMINI_3_8_FLASH)
 */

import * as fs from "fs";
import * as path from "path";
import { StitchClient } from "./stitch-client.js";
import { buildPagePrompt } from "./stitch-prompt-builder.js";
import { postProcessPage } from "./stitch-post-processor.js";
import { reviewSEO } from "../agents/stitch-seo.agent.js";
import { reviewA11y } from "../agents/stitch-a11y.agent.js";
import { applyPatches } from "./stitch-patcher.js";
import { generateReviewReport } from "./stitch-review-reporter.js";
import type { WebsiteBlueprint, PageDefinition } from "../schemas/blueprint.types.js";
import type { PageReviewSummary } from "../agents/stitch-html-review.types.js";

const REGEN_MAX_ATTEMPTS = 3;
const REGEN_BACKOFF_MS = 7000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface StitchGeneratorResult {
  ok: boolean;
  pagesGenerated: number;
  outputDir: string;
  projectId: string;
  reportPath: string;
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
  const pageReviews: PageReviewSummary[] = [];

  // ── Validate env ────────────────────────────────────────────────────────────
  const apiKey = process.env.STITCH_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      pagesGenerated: 0,
      outputDir,
      projectId: "",
      reportPath: "",
      errors: ["STITCH_API_KEY is not set — add it to your .env file"],
      warnings: [],
    };
  }

  const preferredModelId = process.env.STITCH_MODEL ?? "GEMINI_3_8_FLASH";

  const client = new StitchClient(apiKey);
  fs.mkdirSync(outputDir, { recursive: true });

  // Validate the model against the live Stitch schema before burning any
  // per-page API calls — a stale/misconfigured STITCH_MODEL would otherwise
  // fail every single page with the same opaque error.
  const modelId = await client.resolveModelId(preferredModelId, (msg) => warnings.push(msg));
  log(`Using Stitch model: ${modelId}`);

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
      reportPath: "",
      errors: [`Failed to create Stitch project: ${(e as Error).message}`],
      warnings: [],
    };
  }

  // ── Step 2: Generate one screen per page ────────────────────────────────────
  // generate_screen_from_text sometimes returns the exported HTML inline
  // (synchronous completion) and sometimes only a screen ID that requires a
  // separate getScreen() poll — carry any inline HTML through so step 3 can
  // skip that redundant (and occasionally stuck) fetch.
  const screenMap: Array<{ screenId: string; html?: string; route: string; page: PageDefinition }> = [];

  for (const page of blueprint.pages) {
    log(`Generating screen for page "${page.id}" (${page.path})...`);
    const prompt = buildPagePrompt(page, blueprint);

    try {
      const { screenId, html } = await client.generateScreen(projectId, prompt, modelId);
      screenMap.push({ screenId, html, route: page.path, page });
      log(`  Screen ready: ${screenId}${html ? " (HTML included inline)" : ""}`);
    } catch (e) {
      const msg = `Screen generation failed for "${page.id}": ${(e as Error).message}`;
      errors.push(msg);
      log(`  ✗ ${msg}`);
    }
  }

  if (screenMap.length === 0) {
    return { ok: false, pagesGenerated: 0, outputDir, projectId, reportPath: "", errors, warnings };
  }

  if (screenMap.length < blueprint.pages.length) {
    warnings.push(
      `${blueprint.pages.length - screenMap.length} page(s) skipped due to screen generation errors`
    );
  }

  // ── Steps 3–7: Fetch → post-process → review → patch → write ────────────────
  let pagesGenerated = 0;

  for (const { screenId, html: inlineHtml, route, page } of screenMap) {
    let html: string;

    if (inlineHtml) {
      html = inlineHtml;
    } else {
      log(`Fetching HTML for page "${page.id}" (screen: ${screenId})...`);
      try {
        html = await client.getScreen(projectId, screenId);
      } catch (e) {
        // getScreen's export path occasionally never syncs for a given screen
        // even though the underlying generation succeeded — a fresh generate
        // call for the same prompt reliably works when this happens. Retry a
        // few times with a short backoff so a single transient API hiccup
        // (e.g. a "service unavailable" blip on the retry itself) doesn't
        // sink the page.
        log(`  ⚠  getScreen stalled for "${page.id}" (${(e as Error).message}) — retrying generation...`);
        let lastError = e as Error;
        let regenerated: string | null = null;

        for (let attempt = 1; attempt <= REGEN_MAX_ATTEMPTS && regenerated === null; attempt++) {
          if (attempt > 1) await sleep(REGEN_BACKOFF_MS);
          try {
            const prompt = buildPagePrompt(page, blueprint);
            const regen = await client.generateScreen(projectId, prompt, modelId);
            regenerated = regen.html ?? (await client.getScreen(projectId, regen.screenId));
          } catch (e2) {
            lastError = e2 as Error;
            log(`  ⚠  Retry ${attempt}/${REGEN_MAX_ATTEMPTS} failed for "${page.id}": ${lastError.message}`);
          }
        }

        if (regenerated === null) {
          const msg = `Failed to fetch HTML for "${page.id}" after ${REGEN_MAX_ATTEMPTS} regeneration attempt(s): ${lastError.message}`;
          errors.push(msg);
          log(`  ✗ ${msg}`);
          continue;
        }
        html = regenerated;
      }
    }

    // Step 4: inject our SEO meta block and base a11y attributes
    const postProcessed = postProcessPage(html, page, blueprint);

    // Step 5: run review agents
    log(`  Running SEO + A11y agents on "${page.id}"...`);
    const seoResult  = reviewSEO(postProcessed, page, blueprint);
    const a11yResult = reviewA11y(postProcessed, page, blueprint);

    const allPatches  = [...seoResult.patches,  ...a11yResult.patches];
    const allFindings = [...seoResult.findings, ...a11yResult.findings];

    // Step 6: apply patches
    const { html: patched, applied, skipped } = applyPatches(postProcessed, allPatches);

    if (applied.length > 0) {
      log(`  ✓ Patched ${applied.length} issue(s): ${applied.slice(0, 2).join("; ")}${applied.length > 2 ? ` (+${applied.length - 2} more)` : ""}`);
    }
    const manualCount = allFindings.filter(f => f.severity === "error" || f.severity === "warning").length;
    if (manualCount > 0) {
      log(`  ⚠  ${manualCount} finding(s) need manual review — see report`);
    }

    // Collect for report
    pageReviews.push({
      pageId: page.id,
      route,
      patchesApplied: applied,
      patchesSkipped: skipped,
      findings: allFindings,
    });

    // Step 7: write final HTML
    const relPath =
      route === "/" ? "index.html" : `${route.replace(/^\//, "").replace(/\/$/, "")}/index.html`;

    const fullPath = path.join(outputDir, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, patched, "utf-8");

    pagesGenerated++;
    log(`  Wrote ${relPath}`);
  }

  // ── Step 8: Generate review report ─────────────────────────────────────────
  let reportPath = "";
  if (pageReviews.length > 0) {
    reportPath = generateReviewReport(pageReviews, outputDir);
    log(`Review report → ${path.relative(process.cwd(), reportPath)}`);
  }

  return { ok: pagesGenerated > 0, pagesGenerated, outputDir, projectId, reportPath, errors, warnings };
}
