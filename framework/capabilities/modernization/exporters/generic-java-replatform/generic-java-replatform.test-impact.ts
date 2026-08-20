/**
 * TestImpactSpecification + MigrationValidationPlan — every area connects
 * to a real PreservationRequirement or a direct, non-fabricated
 * consequence of the runtime change itself (build/startup/Servlet API
 * compatibility). No numeric acceptance criteria, no database-migration
 * step, no automatic deployment/cutover gate (task items 36-43/87-88).
 */

import { makeIdGenerator } from "../../../../discovery/shared/section-lookup.js";
import type { CodebaseAnalysisResult } from "../../../../analysis/codebase/contracts/codebase-analysis-result.types.js";
import type { ArchitectureReference } from "../../../../core/contracts/architecture-reference.js";
import type { ModernizationArchitecture, MigrationCandidate } from "../../schemas/modernization.types.js";
import type { TestImpactArea, TestImpactSpecification, MigrationValidationGate, MigrationValidationPlan } from "../test-impact.types.js";
import type { ModernizationExportReadiness } from "../exporter.types.js";

function systemRef(systemId: string): ArchitectureReference {
  return { entityType: "system", entityId: systemId };
}

export function buildTestImpactSpecification(candidate: MigrationCandidate, architecture: ModernizationArchitecture, codebase: CodebaseAnalysisResult): TestImpactSpecification {
  const nextAreaId = makeIdGenerator("TESTIMPACT");
  const testAreas: TestImpactArea[] = [];

  const mavenBuild = codebase.buildSystems.find((b) => b.type === "maven");
  testAreas.push({
    id: nextAreaId(),
    category: "build",
    description: "Validate that the project builds successfully with the target runtime's dependency set.",
    affectedArchitectureRefs: [systemRef(candidate.systemId)],
    affectedFiles: mavenBuild ? [mavenBuild.descriptorPath] : [],
    evidenceRefs: mavenBuild?.metadata.evidenceRefs ?? [],
  });

  const appServerRuntime = codebase.runtimes.find((r) => r.type === "application-server");
  testAreas.push({
    id: nextAreaId(),
    category: "startup",
    description: "Validate that the application starts successfully under the target runtime.",
    affectedArchitectureRefs: [systemRef(candidate.systemId)],
    affectedFiles: appServerRuntime?.metadata.evidenceRefs.map((r) => r.filePath) ?? [],
    evidenceRefs: appServerRuntime?.metadata.evidenceRefs ?? [],
  });

  const servletFrameworks = codebase.frameworks.filter((f) => f.name.startsWith("Servlet API"));
  if (servletFrameworks.length > 0) {
    testAreas.push({
      id: nextAreaId(),
      category: "runtime",
      description: "Validate Servlet API compatibility under the target runtime.",
      affectedArchitectureRefs: [systemRef(candidate.systemId)],
      affectedFiles: servletFrameworks.flatMap((f) => f.metadata.evidenceRefs.map((r) => r.filePath)),
      evidenceRefs: servletFrameworks.flatMap((f) => f.metadata.evidenceRefs),
    });
  }

  const preservationRequirements = architecture.preservationRequirements.filter((p) => p.systemId === candidate.systemId);
  for (const preservation of preservationRequirements) {
    if (preservation.type === "business-behavior") {
      testAreas.push({
        id: nextAreaId(),
        category: "business-behavior",
        description: `Behavioral regression validation: ${preservation.description}`,
        affectedArchitectureRefs: preservation.sourceArchitectureRefs,
        affectedFiles: [],
        evidenceRefs: [],
      });
    } else if (preservation.type === "integration-contract") {
      testAreas.push({
        id: nextAreaId(),
        category: "integration",
        description: `Integration compatibility validation: ${preservation.description}`,
        affectedArchitectureRefs: preservation.sourceArchitectureRefs,
        affectedFiles: [],
        evidenceRefs: [],
      });
    } else if (preservation.type === "data") {
      testAreas.push({
        id: nextAreaId(),
        category: "data",
        description: `Data/technology preservation validation: ${preservation.description} — no database migration is proposed as part of this export.`,
        affectedArchitectureRefs: preservation.sourceArchitectureRefs,
        affectedFiles: [],
        evidenceRefs: [],
      });
    } else if (preservation.type === "security" || preservation.relatedSecurityRequirementIds?.length) {
      testAreas.push({
        id: nextAreaId(),
        category: "security",
        description: `Validate that existing credential-protection/security requirements remain satisfied: ${preservation.description}`,
        affectedArchitectureRefs: preservation.sourceArchitectureRefs,
        affectedFiles: [],
        evidenceRefs: [],
      });
    } else if (preservation.type === "operational" || preservation.relatedObservabilityObjectiveIds?.length) {
      testAreas.push({
        id: nextAreaId(),
        category: "observability",
        description: `Validate that existing operational visibility remains satisfied: ${preservation.description}`,
        affectedArchitectureRefs: preservation.sourceArchitectureRefs,
        affectedFiles: [],
        evidenceRefs: [],
      });
    }
  }

  const preservationRequirementIds = preservationRequirements.map((p) => p.id);
  const migrationValidationRequirementIds = architecture.validationRequirements.filter((v) => v.preservationRequirementIds.some((id) => preservationRequirementIds.includes(id))).map((v) => v.id);

  return {
    id: "TESTIMPACTSPEC-001",
    modernizationCandidateId: candidate.id,
    testAreas,
    preservationRequirementIds,
    migrationValidationRequirementIds,
    informationGapIds: architecture.informationGaps.map((g) => g.id),
    evidenceRefs: testAreas.flatMap((a) => a.evidenceRefs),
  };
}

const GATE_CATEGORY_LABELS: Partial<Record<TestImpactArea["category"], string>> = {
  build: "Build verification",
  startup: "Runtime startup verification",
  "business-behavior": "Business behavior validation",
  integration: "Integration compatibility validation",
  security: "Security requirement validation",
  observability: "Operational visibility validation",
};

export function buildMigrationValidationPlan(candidate: MigrationCandidate, testImpact: TestImpactSpecification, readiness: ModernizationExportReadiness): MigrationValidationPlan {
  const nextGateId = makeIdGenerator("VALGATE");
  const validationGates: MigrationValidationGate[] = [];

  for (const [category, name] of Object.entries(GATE_CATEGORY_LABELS)) {
    const areas = testImpact.testAreas.filter((a) => a.category === category);
    if (areas.length === 0) continue;
    validationGates.push({
      id: nextGateId(),
      name: name!,
      description: `${name} covering: ${areas.map((a) => a.description).join(" ")}`,
      testImpactAreaIds: areas.map((a) => a.id),
      status: "defined",
    });
  }

  const unresolvedCriteria = readiness.reasons.filter((r) => r.severity !== "info").map((r) => r.description);

  return {
    candidateId: candidate.id,
    existingValidationRequirementIds: testImpact.migrationValidationRequirementIds,
    testImpactSpecificationId: testImpact.id,
    validationGates,
    unresolvedCriteria,
  };
}
