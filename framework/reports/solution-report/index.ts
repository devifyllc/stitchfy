/**
 * Public entry point for the Solution Report — see
 * docs/architecture/ARCHITECTURE.md "Solution Report".
 *
 *   SolutionBlueprint → buildSolutionReportProjection → renderSolutionReportHtml
 *     → output/.../reports/solution-report.html
 *
 * Mirrors render-solution-plan-report.ts's write-result shape.
 */

import * as fs from "fs";
import * as path from "path";
import type { SolutionBlueprint } from "../../schemas/solution-blueprint/solution-blueprint.types.js";
import { buildSolutionReportProjection } from "./projection.js";
import { renderSolutionReportHtml } from "./render.js";

export interface SolutionReportWriteResult {
  ok: boolean;
  filePath?: string;
  error?: string;
}

export function writeSolutionReport(blueprint: SolutionBlueprint, outputDir: string): SolutionReportWriteResult {
  try {
    const projection = buildSolutionReportProjection(blueprint);
    const html = renderSolutionReportHtml(projection);
    const reportsDir = path.join(outputDir, "reports");
    fs.mkdirSync(reportsDir, { recursive: true });
    const filePath = path.join(reportsDir, "solution-report.html");
    fs.writeFileSync(filePath, html);
    return { ok: true, filePath };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export { buildSolutionReportProjection } from "./projection.js";
export { renderSolutionReportHtml } from "./render.js";
export type { SolutionReportProjection } from "./types.js";
