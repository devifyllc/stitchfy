/**
 * Pure orchestration function (task item 42's selection policy) — called
 * from solution-orchestrator.ts AFTER the full capabilities loop, because
 * SecurityArchitecture (security-governance) only exists once
 * security-governance has run, which happens after integrations in
 * default-capabilities.ts's registration order. See
 * docs/architecture/ARCHITECTURE.md "Integration Export Adapter Foundation
 * (Phase 5.5A)" for the full reasoning — this is NOT inside
 * integrations.capability.ts's own execute() for that reason.
 *
 * Policy: for each IntegrationDefinition, ask the registry for supported
 * exporters. Exactly one → assess readiness, export when ready/needs-review
 * (blocked still gets a diagnostic-only bundle; unsupported produces no
 * bundle at all). Zero or 2+ supported exporters → no export (multi-target
 * selection is deferred, undecided by this phase).
 */

import type { ImplementationArtifact } from "../../../core/contracts/artifact.js";
import type { SystemInventoryItem } from "../../../discovery/systems/system-inventory.types.js";
import type { WorkflowDefinition } from "../../workflow-automation/schemas/workflow-automation.types.js";
import type { SecurityArchitecture, GovernancePlan } from "../../security-governance/schemas/security-governance.types.js";
import type { IntegrationDefinition } from "../schemas/integrations.types.js";
import type { IntegrationExportBundle, IntegrationExportContext } from "./exporter.types.js";
import { createDefaultExporterRegistry } from "./default-exporters.js";

export async function generateIntegrationExports(
  integrations: IntegrationDefinition[],
  security: SecurityArchitecture | undefined,
  governance: GovernancePlan | undefined,
  workflows: WorkflowDefinition[],
  systems: SystemInventoryItem[]
): Promise<{ exports: IntegrationExportBundle[]; artifacts: ImplementationArtifact[]; notes: string[] }> {
  const registry = createDefaultExporterRegistry();
  const context: IntegrationExportContext = {
    securityArchitecture: security,
    governancePlan: governance,
    systems,
    workflows,
  };

  const exports: IntegrationExportBundle[] = [];
  const artifacts: ImplementationArtifact[] = [];
  const notes: string[] = [];

  for (const integration of integrations) {
    const supported = registry.findSupported(integration);

    if (supported.length === 0) continue;

    if (supported.length > 1) {
      notes.push(
        `Integration "${integration.name}" matches ${supported.length} export targets (${supported
          .map((e) => e.id)
          .join(", ")}) — explicit target selection is required and not yet implemented; no export generated.`
      );
      continue;
    }

    const exporter = supported[0];
    const bundle = await exporter.export(integration, context);

    exports.push(bundle);
    artifacts.push(...bundle.artifacts);
    notes.push(`Exported "${integration.name}" via ${exporter.id}: readiness ${bundle.readiness.status}.`);
  }

  return { exports, artifacts, notes };
}
