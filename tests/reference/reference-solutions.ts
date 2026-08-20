/**
 * The canonical reference-solution manifest — test/support infrastructure
 * (task section 12), never a production domain model. Declares WHAT each
 * of the three canonical scenarios (examples/reference/) is expected to
 * produce; tests/reference-solutions.test.ts and scripts/reference-validate.ts
 * both consume this file rather than re-declaring expectations twice.
 */

import type { SolutionContext } from "../../framework/core/contracts/context.js";
import type { SolutionBlueprint } from "../../framework/schemas/solution-blueprint/solution-blueprint.types.js";
import { deepFind } from "./reference-runner.js";

export interface ReferenceInvariant {
  id: string;
  description: string;
  /** Returns `true` on success, or a human-readable failure reason string. */
  check(context: SolutionContext): true | string;
}

export interface ReferenceSolutionDefinition {
  /** Also the output subfolder name: output/reference/<id>/ */
  id: string;
  name: string;
  /** Repo-relative path to the input Markdown. */
  input: string;
  expectedSelectedCapabilities: string[];
  expectedNotSelectedCapabilities: string[];
  /** Repo-relative-to-this-scenario's-own-output-dir directories that must exist and be non-empty. */
  expectedArtifactDirs: string[];
  expectedInvariants: ReferenceInvariant[];
  optionalCodebase?: { path: string; systemId: string };
  optionalExporter?: string;
  /** Repo-relative path to a golden subset fixture (tests/fixtures/reference-expected/*.json). */
  expectedFixturePath: string;
}

function blueprintOf(context: SolutionContext): Partial<SolutionBlueprint> {
  return context.solutionBlueprint;
}

// ─── Appointment Automation & AI ────────────────────────────────────────

const appointmentInvariants: ReferenceInvariant[] = [
  {
    id: "appointment-hitl-exists",
    description: "Workflow Automation preserves at least one required human approval for conflicting appointments",
    check(context) {
      const workflows = blueprintOf(context).automation?.workflows ?? [];
      const hasApproval = workflows.some((w) => w.approvals.some((a) => a.approval.approvalRequired === true));
      return hasApproval || "no WorkflowDefinition.approvals[].approval.approvalRequired === true found";
    },
  },
  {
    id: "appointment-agent-supervised",
    description: "The generated AI agent is not autonomous",
    check(context) {
      const agents = blueprintOf(context).ai?.agents ?? [];
      if (agents.length === 0) return "no AIAgentDefinition generated";
      const autonomous = agents.filter((a) => a.autonomy === "autonomous");
      return autonomous.length === 0 || `agent(s) marked autonomous: ${autonomous.map((a) => a.id).join(", ")}`;
    },
  },
  {
    id: "appointment-session-memory",
    description: "The agent's memory is session-scoped, never assumed persistent",
    check(context) {
      const agents = blueprintOf(context).ai?.agents ?? [];
      const sessionOnly = agents.some((a) => a.memory?.mode === "session");
      return sessionOnly || "no AIAgentDefinition.memory.mode === \"session\" found";
    },
  },
  {
    id: "appointment-tool-maps-to-integration",
    description: "The agent's availability-check tool maps to a real IntegrationDefinition, not an invented one",
    check(context) {
      const agents = blueprintOf(context).ai?.agents ?? [];
      const integrationIds = new Set((blueprintOf(context).integrations?.integrations ?? []).map((i) => i.id));
      const tool = agents.flatMap((a) => a.tools).find((t) => t.kind === "integration-operation");
      if (!tool) return "no integration-operation-kind AI tool found";
      if (!tool.integrationId || !integrationIds.has(tool.integrationId)) {
        return `tool "${tool.id}" references integrationId "${tool.integrationId}" which does not resolve to a real IntegrationDefinition`;
      }
      return true;
    },
  },
  {
    id: "appointment-approval-cannot-be-bypassed",
    description: "A guardrail explicitly forbids bypassing conflict approval",
    check(context) {
      const agents = blueprintOf(context).ai?.agents ?? [];
      const has = agents.some((a) => a.guardrails.some((g) => /approval/i.test(g.description)));
      return has || "no AIGuardrail mentioning approval found";
    },
  },
  {
    id: "appointment-security-references-real-entities",
    description: "Security requirements exist and reference real architecture entities",
    check(context) {
      const requirements = blueprintOf(context).security?.requirements ?? [];
      if (requirements.length === 0) return "no SecurityRequirement generated";
      const allReferenceSomething = requirements.every((r) => r.appliesTo.length > 0);
      return allReferenceSomething || "at least one SecurityRequirement has an empty appliesTo[]";
    },
  },
  {
    id: "appointment-observability-covers-workflow-agent",
    description: "Observability signals cover both workflow and AI-agent/tool activity",
    check(context) {
      const signals = blueprintOf(context).observability?.architecture.signals ?? [];
      if (signals.length === 0) return "no ObservabilitySignal generated";
      const hasWorkflowRef = deepFind(signals, (n) => n.entityType === "workflow");
      const hasAgentRef = deepFind(signals, (n) => n.entityType === "ai-agent" || n.entityType === "ai-tool");
      if (!hasWorkflowRef) return "no signal references a workflow entity";
      if (!hasAgentRef) return "no signal references an ai-agent/ai-tool entity";
      return true;
    },
  },
];

// ─── Operational Order Platform ─────────────────────────────────────────

const orderPlatformInvariants: ReferenceInvariant[] = [
  {
    id: "order-rest-contract-preserved",
    description: "The REST method and path from the input document are preserved verbatim",
    check(context) {
      const integrations = blueprintOf(context).integrations?.integrations ?? [];
      const op = integrations.flatMap((i) => i.restContract?.operations ?? []).find((o) => o.method && o.path);
      if (!op) return "no RestOperation with both method and path found";
      if (op.method !== "POST" || op.path !== "/v1/orders") {
        return `expected POST /v1/orders, got ${op.method} ${op.path}`;
      }
      return true;
    },
  },
  {
    id: "order-deployment-units-reflect-ownership",
    description: "Only solution-managed components become deployment units — the external Fulfillment API never does",
    check(context) {
      const units = blueprintOf(context).architecture?.architecture.deploymentUnits ?? [];
      if (units.length === 0) return "no DeploymentUnit generated";
      const allSolutionManaged = units.every((u) => u.responsibility === "solution-managed");
      if (!allSolutionManaged) return "at least one DeploymentUnit is not solution-managed";
      const namesFulfillment = units.some((u) => /fulfillment/i.test(u.name));
      return !namesFulfillment || 'a DeploymentUnit named after the external "Fulfillment API" was generated';
    },
  },
  {
    id: "order-provider-unspecified",
    description: "No cloud provider is invented when none was stated",
    check(context) {
      const provider = blueprintOf(context).architecture?.architecture.providerRequirement;
      if (!provider) return "no ProviderRequirement generated";
      return provider.provider === "unspecified" || `expected provider "unspecified", got "${provider.provider}"`;
    },
  },
  {
    id: "order-integration-export-generated",
    description: "generic-rest-typescript generates an export bundle at readiness ready or needs-review",
    check(context) {
      const exportsList = blueprintOf(context).integrations?.exports ?? [];
      if (exportsList.length === 0) return "no IntegrationExportBundle generated";
      const bundle = exportsList[0];
      if (bundle.readiness.status !== "ready" && bundle.readiness.status !== "needs-review") {
        return `expected readiness ready/needs-review, got "${bundle.readiness.status}"`;
      }
      return true;
    },
  },
];

// ─── Legacy Java Modernization ──────────────────────────────────────────

const javaModernizationInvariants: ReferenceInvariant[] = [
  {
    id: "java-strategy-remains-replatform",
    description: "The migration strategy stays the explicit replatform Phase 8 decided — never re-derived",
    check(context) {
      const candidates = blueprintOf(context).modernization?.architecture.migrationCandidates ?? [];
      const hasExplicitReplatform = candidates.some((c) =>
        c.strategyOptions.some((s) => s.strategy === "replatform" && s.status === "explicit")
      );
      return hasExplicitReplatform || "no MigrationCandidate with an explicit replatform strategy option found";
    },
  },
  {
    id: "java-websphere-to-tomcat-preserved",
    description: "The current/target runtime delta is preserved verbatim, with no invented version",
    check(context) {
      const deltas = blueprintOf(context).modernization?.architecture.modernizationDeltas ?? [];
      const delta = deltas.find((d) => d.category === "runtime");
      if (!delta) return "no runtime-category ModernizationDelta found";
      if (delta.currentState !== "IBM WebSphere" || delta.targetState !== "Apache Tomcat") {
        return `expected IBM WebSphere -> Apache Tomcat, got ${delta.currentState} -> ${delta.targetState}`;
      }
      if (/\d/.test(delta.targetState)) return `targetState "${delta.targetState}" unexpectedly contains a version number`;
      return true;
    },
  },
  {
    id: "java-database-preservation-exists",
    description: "A preservation requirement protects the Order Database technology",
    check(context) {
      const preservation = blueprintOf(context).modernization?.architecture.preservationRequirements ?? [];
      const has = preservation.some((p) => /database/i.test(p.description));
      return has || "no PreservationRequirement mentioning \"database\" found";
    },
  },
  {
    id: "java-codebase-mapped-to-sys-001",
    description: "Repository evidence is mapped to the correct, explicitly-named system id",
    check(context) {
      if (!context.codebaseAnalysis) return "no CodebaseAnalysisResult on context";
      return context.codebaseSystemId === "SYS-001" || `expected codebaseSystemId "SYS-001", got "${context.codebaseSystemId}"`;
    },
  },
  {
    id: "java-exporter-generates-recipe",
    description: "generic-java-replatform generates a MigrationRecipe",
    check(context) {
      const exportsList = blueprintOf(context).modernization?.exports ?? [];
      if (exportsList.length === 0) return "no ModernizationExportBundle generated";
      return Boolean(exportsList[0].recipe) || "ModernizationExportBundle has no recipe";
    },
  },
  {
    id: "java-no-target-version-invented",
    description: "The exporter reports the target version as unresolved rather than inventing one",
    check(context) {
      const exportsList = blueprintOf(context).modernization?.exports ?? [];
      const bundle = exportsList[0];
      if (!bundle) return "no ModernizationExportBundle generated";
      const hasUnresolvedVersionReason = bundle.readiness.reasons.some((r) => r.code === "target-version-unresolved");
      return hasUnresolvedVersionReason || "readiness reasons do not include \"target-version-unresolved\"";
    },
  },
];

export const REFERENCE_SOLUTIONS: ReferenceSolutionDefinition[] = [
  {
    id: "appointment-automation-ai",
    name: "Appointment Automation & AI",
    input: "examples/reference/appointment-automation-ai.md",
    expectedSelectedCapabilities: ["website", "workflow-automation", "integrations", "ai-agents", "security-governance", "observability", "cloud"],
    expectedNotSelectedCapabilities: ["modernization"],
    expectedArtifactDirs: [
      "artifacts/workflow-automation",
      "artifacts/integrations",
      "artifacts/ai-agents",
      "artifacts/security-governance",
      "artifacts/observability",
      "artifacts/cloud",
    ],
    expectedInvariants: appointmentInvariants,
    expectedFixturePath: "tests/fixtures/reference-expected/appointment-automation-ai.expected.json",
  },
  {
    id: "order-platform",
    name: "Operational Order Platform",
    input: "examples/reference/order-platform.md",
    expectedSelectedCapabilities: ["website", "workflow-automation", "integrations", "security-governance", "observability", "cloud"],
    expectedNotSelectedCapabilities: ["ai-agents", "modernization"],
    expectedArtifactDirs: [
      "artifacts/workflow-automation",
      "artifacts/integrations",
      "artifacts/integrations/exporters",
      "artifacts/security-governance",
      "artifacts/observability",
      "artifacts/cloud",
    ],
    expectedInvariants: orderPlatformInvariants,
    expectedFixturePath: "tests/fixtures/reference-expected/order-platform.expected.json",
  },
  {
    id: "legacy-java-modernization",
    name: "Legacy Java Modernization",
    input: "examples/reference/legacy-java-modernization.md",
    expectedSelectedCapabilities: ["website", "integrations", "security-governance", "observability", "modernization"],
    expectedNotSelectedCapabilities: ["workflow-automation", "ai-agents", "cloud"],
    expectedArtifactDirs: [
      "artifacts/integrations",
      "artifacts/security-governance",
      "artifacts/observability",
      "artifacts/modernization",
      "artifacts/modernization/exporters",
      "analysis/codebase",
    ],
    expectedInvariants: javaModernizationInvariants,
    optionalCodebase: { path: "tests/fixtures/codebases/legacy-java-maven", systemId: "SYS-001" },
    optionalExporter: "generic-java-replatform",
    expectedFixturePath: "tests/fixtures/reference-expected/legacy-java-modernization.expected.json",
  },
];
