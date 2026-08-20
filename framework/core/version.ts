/**
 * Single source of truth for version metadata — replaces the hardcoded
 * `frameworkVersion` strings that used to drift independently in the
 * website pipeline (framework/agents/intake.agent.ts) and the solution
 * pipeline (framework/orchestrator/solution-orchestrator.ts).
 *
 * Reads package.json directly via fs (not a JSON import) so this works
 * identically under `tsx` and `tsc --noEmit` without relying on
 * Node-version-specific import-attribute syntax.
 *
 * STITCHFY_VERSION (the package/framework version) is a distinct concept
 * from the two schema versions below — a framework patch release must
 * never require a schema-version bump, and vice versa. See
 * docs/architecture/COMPATIBILITY.md.
 */

import * as fs from "fs";
import * as path from "path";

const packageJsonPath = path.resolve(__dirname, "..", "..", "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8")) as { version: string };

/** The Stitchfy package/framework version (currently from package.json's "version"). */
export const STITCHFY_VERSION = packageJson.version;

/** WebsiteBlueprint's serialized schema version — see docs/architecture/COMPATIBILITY.md. */
export const WEBSITE_BLUEPRINT_SCHEMA_VERSION = "1.0";

/** SolutionBlueprint's serialized schema version — see docs/architecture/COMPATIBILITY.md. */
export const SOLUTION_BLUEPRINT_SCHEMA_VERSION = "1.0";
