/**
 * Renders ImplementationArtifacts strictly from an already-built
 * CodebaseAnalysisResult — no new inference here. Every artifact repeats
 * the two mandatory disclaimers (task items 57/58): Stitchfy performed
 * static, read-only analysis only, and observed framework/version
 * information carries no support/vulnerability/lifecycle evaluation.
 */

import { createArtifact } from "../../../core/contracts/artifact.js";
import type { ImplementationArtifact } from "../../../core/contracts/artifact.js";
import type { CodebaseAnalysisResult, DependencyManifest } from "../contracts/codebase-analysis-result.types.js";

const CAPABILITY_ID = "codebase-analysis";

const ANALYSIS_DISCLAIMER =
  "Stitchfy performed static, read-only analysis of selected repository files. It did not compile, execute, test, " +
  "deploy, or externally validate the application, and it did not query vulnerability or lifecycle databases.";

const FRAMEWORK_DISCLAIMER =
  "Observed framework/version information is repository evidence only. Stitchfy has not evaluated support status, " +
  "vulnerabilities, upgrade requirements, or vendor lifecycle information.";

function basePath(systemId?: string): string {
  return systemId ? `analysis/codebase/${systemId}` : "analysis/codebase";
}

function evidenceLine(count: number): string {
  return `${count} evidence reference(s)`;
}

// ─── Codebase Analysis Markdown ─────────────────────────────────────────────

function renderCodebaseAnalysisMarkdown(result: CodebaseAnalysisResult): string {
  const lines: string[] = [];
  lines.push("# Codebase Analysis", "", `_Status: **${result.status}**_`, "", `> ${ANALYSIS_DISCLAIMER}`, "");

  lines.push("## Repository Summary", "");
  lines.push(`- Name: ${result.repository.name}`);
  lines.push(`- Detected languages: ${result.repository.detectedLanguages.join(", ") || "none"}`);
  lines.push(`- Build descriptors: ${result.repository.buildDescriptors.join(", ") || "none"}`);
  lines.push(`- Modules: ${result.repository.moduleCount}`);
  lines.push(`- Files analyzed: ${result.repository.analyzedFileCount}, ignored: ${result.repository.ignoredFileCount}`);
  lines.push(`- Analyzers used: ${result.repository.analyzersUsed.join(", ") || "none"}`);
  lines.push("");

  lines.push("## Build Systems", "");
  if (result.buildSystems.length === 0) lines.push("None identified.");
  else
    for (const b of result.buildSystems) {
      const coords = b.coordinates ? [b.coordinates.group, b.coordinates.name, b.coordinates.version ?? "?"].filter(Boolean).join(":") : b.descriptorPath;
      lines.push(`- **${b.id}** _(${b.type})_ — ${coords}${b.packaging ? ` (${b.packaging})` : ""}`);
    }
  lines.push("");

  lines.push("## Modules", "");
  if (result.modules.length === 0) lines.push("None identified.");
  else for (const m of result.modules) lines.push(`- **${m.id}** — ${m.name} (\`${m.relativePath}\`)`);
  lines.push("");

  lines.push("## Runtime / Language Facts", "");
  if (result.runtimes.length === 0) lines.push("None identified.");
  else
    for (const r of result.runtimes) {
      const wording = r.detectionMethod === "compiler-config" ? `project compiler source level: ${r.version ?? "unresolved"}` : `${r.name ?? r.type}${r.version ? ` ${r.version}` : ""}`;
      lines.push(`- **${r.id}** _(${r.type}, ${r.detectionMethod})_ — ${wording}`);
    }
  lines.push("");

  lines.push("## Direct Dependencies", "");
  const direct = result.dependencies.filter((d) => d.direct === true);
  if (direct.length === 0) lines.push("None identified.");
  else for (const d of direct) lines.push(`- **${d.id}** _(${d.ecosystem})_ — ${d.group ? `${d.group}:` : ""}${d.name}@${d.version ?? "unresolved"}`);
  lines.push("");

  lines.push("## Framework Inventory", "");
  if (result.frameworks.length === 0) lines.push("None identified.");
  else for (const f of result.frameworks) lines.push(`- **${f.id}** — ${f.name}${f.version ? ` ${f.version}` : ""} _(${f.detectionMethod})_`);
  lines.push("");

  lines.push("## Source Structure", "");
  if (result.sourceStructure.length === 0) lines.push("None identified.");
  else
    for (const s of result.sourceStructure) {
      const parts = [s.packageName ? `package ${s.packageName}` : undefined, s.extends?.length ? `extends ${s.extends.join(", ")}` : undefined, s.implements?.length ? `implements ${s.implements.join(", ")}` : undefined]
        .filter(Boolean)
        .join("; ");
      lines.push(`- **${s.id}** — ${s.symbolKind} ${s.symbolName ?? "(unnamed)"}${parts ? ` (${parts})` : ""}${s.annotations.length ? ` [${s.annotations.map((a) => `@${a}`).join(", ")}]` : ""}`);
    }
  lines.push("");

  lines.push("## Configuration Inventory", "");
  if (result.configurationFacts.length === 0) lines.push("None identified.");
  else for (const c of result.configurationFacts) lines.push(`- \`${c.relativePath}\` _(${c.kind})_ — present`);
  lines.push("");

  lines.push("## Unresolved Facts", "");
  const unresolved = result.dependencies.filter((d) => d.version === "unresolved");
  if (unresolved.length === 0) lines.push("None.");
  else for (const d of unresolved) lines.push(`- **${d.id}** — ${d.group ? `${d.group}:` : ""}${d.name} version could not be resolved locally`);
  lines.push("");

  lines.push("## Analysis Limitations", "");
  if (result.informationGaps.length === 0 && result.diagnostics.length === 0) lines.push("None.");
  else {
    for (const g of result.informationGaps) lines.push(`- ${g.question}`);
    for (const d of result.diagnostics) lines.push(`- [${d.severity}] ${d.message}${d.filePath ? ` (\`${d.filePath}\`)` : ""}`);
  }
  lines.push("");

  lines.push("## Evidence", "");
  lines.push(evidenceLine(result.evidenceRefs.length), "");

  return lines.join("\n");
}

// ─── Dependency Manifest ────────────────────────────────────────────────────

function buildDependencyManifest(result: CodebaseAnalysisResult, systemId?: string): DependencyManifest {
  return {
    systemId,
    buildSystems: [...new Set(result.buildSystems.map((b) => b.type))],
    directDependencies: result.dependencies.filter((d) => d.direct === true),
    frameworks: result.frameworks,
    runtimes: result.runtimes,
    modules: result.modules,
    evidenceRefs: result.evidenceRefs,
  };
}

function renderDependencyManifestMarkdown(manifest: DependencyManifest): string {
  const lines: string[] = ["# Dependency Manifest", "", `> ${ANALYSIS_DISCLAIMER}`, ""];
  if (manifest.systemId) lines.push(`_Scoped to system: **${manifest.systemId}**_`, "");

  const maven = manifest.directDependencies.filter((d) => d.ecosystem === "maven");
  lines.push("## Maven Dependencies", "");
  if (maven.length === 0) lines.push("None identified.");
  else for (const d of maven) lines.push(`- ${d.group ?? "?"}:${d.name}:${d.version ?? "unresolved"}${d.scope ? ` (${d.scope})` : ""}`);
  lines.push("");

  const npm = manifest.directDependencies.filter((d) => d.ecosystem === "npm");
  lines.push("## npm Dependencies", "");
  if (npm.length === 0) lines.push("None identified.");
  else for (const d of npm) lines.push(`- ${d.name}@${d.version ?? "unresolved"}${d.scope ? ` (${d.scope})` : ""}`);
  lines.push("");

  lines.push("## Build Plugins", "");
  lines.push("See `codebase-analysis.md` → Build Systems for plugin coordinates recorded per descriptor.", "");

  lines.push("## Compiler / Runtime Settings", "");
  if (manifest.runtimes.length === 0) lines.push("None identified.");
  else for (const r of manifest.runtimes) lines.push(`- ${r.type}: ${r.name ?? r.version ?? "unresolved"}${r.name && r.version ? ` ${r.version}` : ""} _(${r.detectionMethod})_`);
  lines.push("");

  lines.push("## Modules / Workspaces", "");
  if (manifest.modules.length === 0) lines.push("None identified.");
  else for (const m of manifest.modules) lines.push(`- ${m.name} (\`${m.relativePath}\`)`);
  lines.push("");

  lines.push("## Unresolved Versions", "");
  const unresolved = manifest.directDependencies.filter((d) => d.version === "unresolved");
  if (unresolved.length === 0) lines.push("None.");
  else for (const d of unresolved) lines.push(`- ${d.group ? `${d.group}:` : ""}${d.name}`);
  lines.push("");

  lines.push("## Evidence", "");
  lines.push(evidenceLine(manifest.evidenceRefs.length), "");

  return lines.join("\n");
}

// ─── Framework Inventory ────────────────────────────────────────────────────

function renderFrameworkInventoryMarkdown(result: CodebaseAnalysisResult): string {
  const lines: string[] = ["# Framework Inventory", "", `> ${FRAMEWORK_DISCLAIMER}`, ""];

  lines.push("## Observed Frameworks", "");
  if (result.frameworks.length === 0) lines.push("None identified.");
  else for (const f of result.frameworks) lines.push(`- **${f.id}** — ${f.name}`);
  lines.push("");

  lines.push("## Detection Method", "");
  if (result.frameworks.length === 0) lines.push("None.");
  else for (const f of result.frameworks) lines.push(`- ${f.name}: ${f.detectionMethod}`);
  lines.push("");

  lines.push("## Observed Versions", "");
  const withVersion = result.frameworks.filter((f) => f.version);
  if (withVersion.length === 0) lines.push("None observed.");
  else for (const f of withVersion) lines.push(`- ${f.name}: ${f.version}`);
  lines.push("");

  lines.push("## Modules", "");
  const moduleNames = new Map(result.modules.map((m) => [m.id, m.name]));
  const withModules = result.frameworks.filter((f) => f.moduleIds.length > 0);
  if (withModules.length === 0) lines.push("Not module-scoped.");
  else for (const f of withModules) lines.push(`- ${f.name}: ${f.moduleIds.map((id) => moduleNames.get(id) ?? id).join(", ")}`);
  lines.push("");

  lines.push("## Evidence", "");
  lines.push(evidenceLine(result.frameworks.flatMap((f) => f.metadata.evidenceRefs).length), "");

  lines.push("## Important Limitations", "");
  lines.push(FRAMEWORK_DISCLAIMER, "");

  return lines.join("\n");
}

// ─── Artifact assembly ──────────────────────────────────────────────────────

export function buildCodebaseAnalysisArtifacts(result: CodebaseAnalysisResult, systemId?: string): ImplementationArtifact[] {
  const base = basePath(systemId);
  const manifest = buildDependencyManifest(result, systemId);

  return [
    createArtifact({ capabilityId: CAPABILITY_ID, type: "config", path: `${base}/codebase-analysis.json`, content: JSON.stringify(result, null, 2) }),
    createArtifact({ capabilityId: CAPABILITY_ID, type: "document", path: `${base}/codebase-analysis.md`, content: renderCodebaseAnalysisMarkdown(result) }),
    createArtifact({ capabilityId: CAPABILITY_ID, type: "config", path: `${base}/dependency-manifest.json`, content: JSON.stringify(manifest, null, 2) }),
    createArtifact({ capabilityId: CAPABILITY_ID, type: "document", path: `${base}/dependency-manifest.md`, content: renderDependencyManifestMarkdown(manifest) }),
    createArtifact({ capabilityId: CAPABILITY_ID, type: "config", path: `${base}/framework-inventory.json`, content: JSON.stringify(result.frameworks, null, 2) }),
    createArtifact({ capabilityId: CAPABILITY_ID, type: "document", path: `${base}/framework-inventory.md`, content: renderFrameworkInventoryMarkdown(result) }),
  ];
}
