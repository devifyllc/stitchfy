/**
 * Deterministic export-readiness assessment (task items 5/6) — no numeric
 * score. Security & Governance output is consumed (via
 * IntegrationExportContext.securityArchitecture), never regenerated: a
 * SecurityRequirement/RiskAssessment already exists or it doesn't.
 */

import type { IntegrationDefinition } from "../../schemas/integrations.types.js";
import type {
  ExportReadiness,
  ExportReadinessReason,
  IntegrationExportContext,
} from "../exporter.types.js";
import { DATA_SENSITIVITY_GAP_TOPIC } from "../../generators/integration-definition.generator.js";
import { supportsGenericRestTypeScript } from "./generic-rest-typescript.exporter.js";

function integrationRef(integrationId: string) {
  return [{ entityType: "integration" as const, entityId: integrationId }];
}

export function assessGenericRestTypeScriptReadiness(
  integration: IntegrationDefinition,
  context: IntegrationExportContext,
  exporterId: string
): ExportReadiness {
  const base = {
    integrationId: integration.id,
    exporterId,
  };

  if (!supportsGenericRestTypeScript(integration)) {
    return {
      ...base,
      status: "unsupported",
      reasons: [
        {
          code: "no-explicit-rest-contract",
          description:
            "This IntegrationDefinition has no explicit REST contract with a known method and path — the generic REST TypeScript exporter does not apply.",
          severity: "info",
          architectureRefs: integrationRef(integration.id),
        },
      ],
      informationGapIds: [],
      securityRequirementIds: [],
      riskIds: [],
    };
  }

  const securityRequirements = (context.securityArchitecture?.requirements ?? []).filter((r) =>
    r.appliesTo.some((ref) => ref.entityType === "integration" && ref.entityId === integration.id)
  );
  const risks = (context.securityArchitecture?.risks ?? []).filter((r) =>
    r.relatedArchitectureRefs.some((ref) => ref.entityType === "integration" && ref.entityId === integration.id)
  );

  const reasons: ExportReadinessReason[] = [];

  const blockingRequirements = securityRequirements.filter(
    (r) => r.status === "needs-information" && r.priority === "required"
  );
  for (const req of blockingRequirements) {
    reasons.push({
      code: "security-requirement-blocking",
      description: `Security requirement "${req.description}" is required and still needs information before this integration can be safely exported.`,
      severity: "blocking",
      architectureRefs: integrationRef(integration.id),
    });
  }

  if (blockingRequirements.length > 0) {
    return {
      ...base,
      status: "blocked",
      reasons,
      informationGapIds: integration.informationGaps.map((g) => g.id),
      securityRequirementIds: securityRequirements.map((r) => r.id),
      riskIds: risks.map((r) => r.id),
    };
  }

  const mechanism = integration.authentication?.mechanism ?? "unknown";
  if (mechanism === "unknown") {
    reasons.push({
      code: "authentication-mechanism-unresolved",
      description: "The authentication mechanism for this integration is unresolved.",
      severity: "warning",
      architectureRefs: integrationRef(integration.id),
    });
  } else if (mechanism !== "none" && !integration.authentication?.placement) {
    reasons.push({
      code: "authentication-placement-unresolved",
      description: `Authentication mechanism "${mechanism}" is known, but exactly how the credential is applied (header/query/cookie name) is unresolved.`,
      severity: "warning",
      architectureRefs: integrationRef(integration.id),
    });
  }

  const dataSensitivityGap = integration.informationGaps.find((g) => g.topic === DATA_SENSITIVITY_GAP_TOPIC);
  if (dataSensitivityGap) {
    reasons.push({
      code: "data-sensitivity-unresolved",
      description: `Data sensitivity for this integration is unresolved (${dataSensitivityGap.id}).`,
      severity: "warning",
      architectureRefs: integrationRef(integration.id),
    });
  }

  if (!integration.restContract?.baseUrl) {
    reasons.push({
      code: "base-url-unresolved",
      description: "No base URL was supplied; it will be represented as required external configuration.",
      severity: "info",
      architectureRefs: integrationRef(integration.id),
    });
  }

  const unresolvedRequiredFields = integration.dataContracts
    .flatMap((c) => c.fields)
    .filter((f) => f.required === undefined);
  if (unresolvedRequiredFields.length > 0) {
    reasons.push({
      code: "field-requiredness-unresolved",
      description: `${unresolvedRequiredFields.length} data contract field(s) have unresolved requiredness; represented as optional per the documented convention.`,
      severity: "info",
      architectureRefs: integrationRef(integration.id),
    });
  }

  const status = reasons.some((r) => r.severity === "warning") ? "needs-review" : "ready";

  return {
    ...base,
    status,
    reasons,
    informationGapIds: integration.informationGaps.map((g) => g.id),
    securityRequirementIds: securityRequirements.map((r) => r.id),
    riskIds: risks.map((r) => r.id),
  };
}
