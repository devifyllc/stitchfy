/**
 * Semantic validation for a generated export bundle (task item 35) — same
 * {ok, issues} shape as every other validator in this codebase
 * (integration-definition.validator.ts, security-architecture.validator.ts).
 */

import type { IntegrationDefinition } from "../../schemas/integrations.types.js";
import type { IntegrationExportBundle } from "../exporter.types.js";
import { toSafeTypeScriptIdentifier, detectIdentifierCollisions } from "../naming/typescript-identifier.js";
import { supportsGenericRestTypeScript } from "./generic-rest-typescript.exporter.js";

export interface ExportValidationIssue {
  code: string;
  message: string;
  severity: "error" | "warning";
}

export interface ExportValidationResult {
  ok: boolean;
  issues: ExportValidationIssue[];
}

/** Not a real secret scanner — a deterministic reject-list guarding against Stitchfy itself accidentally embedding a credential-looking literal (task item 36). */
const SECRET_LITERAL_PATTERN = /\b(apiKey|api_key|password|clientSecret|client_secret|secret|token)\s*[:=]\s*["'][^"'\s]{4,}["']/i;

export function validateExportBundle(
  bundle: IntegrationExportBundle,
  integration: IntegrationDefinition
): ExportValidationResult {
  const issues: ExportValidationIssue[] = [];

  if (!supportsGenericRestTypeScript(integration)) {
    issues.push({ code: "unsupported-target", message: `IntegrationDefinition "${integration.id}" has no explicit REST contract for the generic-rest-typescript target`, severity: "error" });
  }

  const paths = bundle.files.map((f) => f.path);
  const duplicatePaths = paths.filter((p, i) => paths.indexOf(p) !== i);
  for (const path of new Set(duplicatePaths)) {
    issues.push({ code: "duplicate-file-path", message: `Generated file path "${path}" appears more than once`, severity: "error" });
  }

  const methodEntries = (integration.restContract?.operations ?? []).map((op) => ({
    sourceName: op.integrationOperationId
      ? integration.operations.find((o) => o.id === op.integrationOperationId)?.name ?? `${op.method} ${op.path}`
      : `${op.method} ${op.path}`,
    identifier: toSafeTypeScriptIdentifier(
      op.integrationOperationId
        ? integration.operations.find((o) => o.id === op.integrationOperationId)?.name ?? `${op.method} ${op.path}`
        : `${op.method} ${op.path}`,
      "camel"
    ),
  }));
  for (const collision of detectIdentifierCollisions(methodEntries)) {
    issues.push({
      code: "method-name-collision",
      message: `Operations [${collision.sourceNames.join(", ")}] all normalize to method name "${collision.identifier}"`,
      severity: "error",
    });
  }

  const knownContractIds = new Set(integration.dataContracts.map((c) => c.id));
  for (const op of integration.operations) {
    if (op.requestContractId && !knownContractIds.has(op.requestContractId)) {
      issues.push({ code: "unknown-contract", message: `Operation "${op.id}" requestContractId "${op.requestContractId}" does not exist`, severity: "error" });
    }
    if (op.responseContractId && !knownContractIds.has(op.responseContractId)) {
      issues.push({ code: "unknown-contract", message: `Operation "${op.id}" responseContractId "${op.responseContractId}" does not exist`, severity: "error" });
    }
  }

  const manifestArtifact = bundle.artifacts.find((a) => a.path?.endsWith("integration.manifest.json"));
  if (manifestArtifact && typeof manifestArtifact.content === "string") {
    const manifest = JSON.parse(manifestArtifact.content) as { generatedFiles: string[] };
    const bundlePaths = new Set(paths);
    for (const path of manifest.generatedFiles) {
      const filename = path.split("/").pop();
      if (!bundlePaths.has(filename ?? path)) {
        issues.push({ code: "manifest-file-missing", message: `Manifest lists "${path}" which is not present in the bundle's generated files`, severity: "error" });
      }
    }
  }

  const knownGapIds = new Set(integration.informationGaps.map((g) => g.id));
  for (const gapId of bundle.readiness.informationGapIds) {
    if (!knownGapIds.has(gapId)) {
      issues.push({ code: "unknown-information-gap", message: `Readiness references unknown information gap "${gapId}"`, severity: "error" });
    }
  }

  for (const artifact of bundle.artifacts) {
    if (typeof artifact.content === "string" && SECRET_LITERAL_PATTERN.test(artifact.content)) {
      issues.push({ code: "possible-secret-literal", message: `Generated artifact "${artifact.path}" contains what looks like a credential literal`, severity: "error" });
    }
  }

  const restPaths = new Set((integration.restContract?.operations ?? []).map((op) => `${op.method} ${op.path}`));
  for (const artifact of bundle.artifacts) {
    if (typeof artifact.content !== "string" || !artifact.path?.endsWith("client.ts")) continue;
    const matches = [...artifact.content.matchAll(/REST (GET|POST|PUT|PATCH|DELETE) (\S+)\./g)];
    for (const match of matches) {
      const stated = `${match[1]} ${match[2]}`;
      if (!restPaths.has(stated)) {
        issues.push({ code: "fabricated-endpoint", message: `Generated client references "${stated}" which does not match the IntegrationDefinition's restContract`, severity: "error" });
      }
    }
  }

  return { ok: !issues.some((i) => i.severity === "error"), issues };
}
