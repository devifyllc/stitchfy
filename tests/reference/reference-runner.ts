/**
 * Shared reference-scenario execution/validation logic — imported by BOTH
 * tests/reference-solutions.test.ts and scripts/reference-validate.ts, so
 * the two never drift into separately-maintained copies of the same checks.
 *
 * Test/support infrastructure only (task's own "do not put it into
 * SolutionBlueprint" instruction) — nothing here is a production domain
 * model.
 */

import * as fs from "fs";
import * as path from "path";
import { runSolutionPipeline } from "../../framework/orchestrator/solution-orchestrator.js";
import type { SolutionContext } from "../../framework/core/contracts/context.js";
import type { ReferenceSolutionDefinition } from "./reference-solutions.js";

const REPO_ROOT = path.resolve(__dirname, "..", "..");

export async function runReferenceScenario(def: ReferenceSolutionDefinition): Promise<SolutionContext> {
  const inputPath = path.resolve(REPO_ROOT, def.input);
  const outputDir = path.resolve(REPO_ROOT, "output", "reference", def.id);
  const codebasePath = def.optionalCodebase ? path.resolve(REPO_ROOT, def.optionalCodebase.path) : undefined;
  const systemId = def.optionalCodebase?.systemId;
  return runSolutionPipeline(inputPath, outputDir, codebasePath, systemId, def.optionalExporter);
}

/**
 * Volatile fields, deliberately narrow — every other id in the system
 * (WF-001, INTEGRATION-001, RECIPE-001, ...) comes from a deterministic
 * `makeIdGenerator()` counter and is kept as a meaningful, stable value:
 *
 * - `generatedAt` (any object) — every capability's own section-level
 *   timestamp, plus ProjectMeta.generatedAt.
 * - `timestamp` (any object) — WorkflowApproval's embedded HumanApproval
 *   record timestamp.
 * - `startedAt`/`completedAt` (any object) — SolutionContext/WorkflowState's
 *   own run timestamps (the website capability embeds a full WorkflowState
 *   in its CapabilityExecutionResult.output).
 * - `durationMs` (any object) — CapabilityExecutionResult/WorkflowState's
 *   wall-clock execution time (framework/orchestrator/capability-runner.ts).
 * - `id` shaped like `artifact-<Date.now()>-<random>` — ImplementationArtifact.id
 *   (see framework/core/contracts/artifact.ts's `createArtifact()`).
 * - `id`/`projectId` shaped like `approval-<Date.now()>-<random>` or
 *   `run-<Date.now()>` — the embedded HumanApproval.id default (see
 *   framework/governance/approvals/human-approval.types.ts) and
 *   WorkflowState.projectId (framework/orchestrator/workflow-state.ts).
 * - ISO-8601 timestamps embedded INSIDE `content` string values —
 *   `ImplementationArtifact.content` for JSON-type artifacts is
 *   pre-serialized text (`JSON.stringify(...)`) that itself contains a
 *   `generatedAt` timestamp baked into the string, one level below where
 *   the object-property strip above can reach it.
 */
const VOLATILE_ID_PATTERN = /^(artifact|approval)-\d+-[a-z0-9]+$|^run-\d+$/;
const ISO_TIMESTAMP_PATTERN = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z/g;

function stripVolatile(node: unknown): void {
  if (Array.isArray(node)) {
    for (const item of node) stripVolatile(item);
    return;
  }
  if (node && typeof node === "object") {
    const record = node as Record<string, unknown>;
    if (typeof record.generatedAt === "string") delete record.generatedAt;
    if (typeof record.timestamp === "string") delete record.timestamp;
    if (typeof record.startedAt === "string") delete record.startedAt;
    if (typeof record.completedAt === "string") delete record.completedAt;
    if (typeof record.durationMs === "number") delete record.durationMs;
    if (typeof record.id === "string" && VOLATILE_ID_PATTERN.test(record.id)) delete record.id;
    if (typeof record.projectId === "string" && VOLATILE_ID_PATTERN.test(record.projectId)) delete record.projectId;
    if (typeof record.content === "string") record.content = record.content.replace(ISO_TIMESTAMP_PATTERN, "<timestamp>");
    for (const key of Object.keys(record)) stripVolatile(record[key]);
  }
}

/** Deep-clones and strips only the documented volatile fields above — nothing else is touched. */
export function normalizeReferenceOutput<T>(value: T): T {
  const clone = JSON.parse(JSON.stringify(value)) as T;
  stripVolatile(clone);
  return clone;
}

/** True if `outputDir/<dir>` exists and contains at least one file (recursively). */
export function checkArtifactDirs(outputDir: string, dirs: string[]): { dir: string; ok: boolean }[] {
  return dirs.map((dir) => {
    const abs = path.join(outputDir, dir);
    if (!fs.existsSync(abs)) return { dir, ok: false };
    const hasFile = (p: string): boolean =>
      fs.readdirSync(p, { withFileTypes: true }).some((entry) => (entry.isDirectory() ? hasFile(path.join(p, entry.name)) : true));
    return { dir, ok: hasFile(abs) };
  });
}

/**
 * True if every key path present in `expected` resolves to an equal value in
 * `actual` — a SUBSET match, not full deep-equal, since golden fixtures
 * intentionally hold only a stable subset of the real output (task section
 * 14). Arrays are compared element-by-element (same length, each element
 * itself subset-matched); anything in `actual` not mentioned in `expected`
 * is ignored.
 */
export function assertGoldenSubset(expected: unknown, actual: unknown, at = "$"): string[] {
  const errors: string[] = [];
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      errors.push(`${at}: expected array, got ${typeof actual}`);
      return errors;
    }
    if (expected.length !== actual.length) {
      errors.push(`${at}: expected array length ${expected.length}, got ${actual.length}`);
      return errors;
    }
    expected.forEach((item, i) => errors.push(...assertGoldenSubset(item, actual[i], `${at}[${i}]`)));
    return errors;
  }
  if (expected && typeof expected === "object") {
    if (!actual || typeof actual !== "object") {
      errors.push(`${at}: expected object, got ${typeof actual}`);
      return errors;
    }
    for (const key of Object.keys(expected as Record<string, unknown>)) {
      errors.push(
        ...assertGoldenSubset((expected as Record<string, unknown>)[key], (actual as Record<string, unknown>)[key], `${at}.${key}`)
      );
    }
    return errors;
  }
  if (expected !== actual) {
    errors.push(`${at}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
  return errors;
}

/** Recursively searches arrays/objects for a node matching `predicate` — used by invariants that only need to prove "this reference exists somewhere," not its exact path. */
export function deepFind(value: unknown, predicate: (node: Record<string, unknown>) => boolean): boolean {
  if (Array.isArray(value)) return value.some((item) => deepFind(item, predicate));
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (predicate(record)) return true;
    return Object.values(record).some((v) => deepFind(v, predicate));
  }
  return false;
}
