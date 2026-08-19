/**
 * AI Agents capability — migrated off legacy keyword matching (Phase 6).
 * supports()/assess() delegate to the same assessAIAgents() — one source of
 * truth for selection. execute() reads Workflow Automation's and
 * Integrations' sibling output (registry order now places both before
 * ai-agents — see docs/architecture/ARCHITECTURE.md "AI Agent Architecture")
 * purely to derive tools from real operations/steps; the selection decision
 * itself never depends on them. `implemented: true` means Stitchfy
 * generated and validated one or more vendor-neutral AI Agent architecture
 * specifications — never that an LLM was executed, a tool was invoked, or
 * the agent is safe/compliant/production-ready.
 */

import type { StitchfyCapability } from "../../core/contracts/capability.js";
import type { SolutionContext } from "../../core/contracts/context.js";
import type { ValidationResult } from "../../schemas/common/validation-result.js";
import { validationOk, validationFail } from "../../schemas/common/validation-result.js";
import type { CapabilityAssessment } from "../../planning/capability-assessment/capability-assessment.types.js";
import { assessAIAgents, AI_AGENTS_CAPABILITY_ID } from "./ai-agents.assessor.js";
import { buildAIAgentPlan } from "./ai-agents.planner.js";
import { buildAIAgentDefinitions } from "./generators/ai-agent-definition.generator.js";
import { buildAIAgentArtifacts } from "./generators/ai-agent-artifact.generator.js";
import { validateAIAgentDefinition, detectOrphanTools } from "./validators/ai-agent-definition.validator.js";
import type { AIAgentsSection, AIAgentDefinition, AIAgentToolSpecification } from "./schemas/ai-agents.types.js";
import type { ImplementationArtifact } from "../../core/contracts/artifact.js";
import type { WorkflowAutomationSection } from "../workflow-automation/schemas/workflow-automation.types.js";
import type { IntegrationsSection } from "../integrations/schemas/integrations.types.js";

function supports(context: SolutionContext): boolean {
  const assessment = assessAIAgents(context);
  return assessment.status === "recommended" || assessment.status === "needs-review";
}

function assess(context: SolutionContext): CapabilityAssessment {
  return assessAIAgents(context);
}

async function plan(context: SolutionContext): Promise<CapabilityAssessment> {
  return assessAIAgents(context);
}

async function execute(assessment: CapabilityAssessment, context: SolutionContext): Promise<AIAgentsSection> {
  const agentPlan = buildAIAgentPlan(context, assessment);
  const discovery = context.discoveryResult;

  const notes: string[] = [
    `Status: ${assessment.status} (confidence: ${assessment.confidence}, method: ${assessment.method}).`,
    ...assessment.reasons.map((r) => r.description),
  ];

  if (!discovery || agentPlan.agentCandidates.length === 0) {
    notes.push("No AI Agent Need identified to specify an agent for.");
    return { implemented: false, plan: agentPlan, agents: [], toolCatalog: [], artifacts: [], notes };
  }

  const workflowResult = context.capabilityResults.find((r) => r.capabilityId === "workflow-automation");
  const workflowOutput = workflowResult?.output as WorkflowAutomationSection | undefined;
  const workflows = workflowOutput?.workflows ?? [];

  const integrationsResult = context.capabilityResults.find((r) => r.capabilityId === "integrations");
  const integrationsOutput = integrationsResult?.output as IntegrationsSection | undefined;
  const integrations = integrationsOutput?.integrations ?? [];

  if (workflows.length > 0) notes.push(`Analyzed ${workflows.length} Workflow Automation workflow(s).`);
  if (integrations.length > 0) notes.push(`Analyzed ${integrations.length} Integration(s).`);

  const candidateAgents = buildAIAgentDefinitions(discovery, agentPlan, workflows, integrations);

  const agents: AIAgentDefinition[] = [];
  const artifacts: ImplementationArtifact[] = [];

  for (const agent of candidateAgents) {
    const validation = validateAIAgentDefinition(agent, discovery, workflows, integrations);
    if (!validation.ok) {
      notes.push(
        `Agent "${agent.name}" failed validation: ${validation.issues
          .filter((i) => i.severity === "error")
          .map((i) => i.message)
          .join("; ")}`
      );
      continue;
    }
    agents.push(agent);
  }

  const toolCatalog: AIAgentToolSpecification[] = agents.flatMap((a) => a.tools);
  const orphanIssues = detectOrphanTools(agents, toolCatalog);
  if (orphanIssues.length > 0) {
    notes.push(`Tool catalog integrity issue(s): ${orphanIssues.map((i) => i.message).join("; ")}`);
  }

  if (agents.length > 0) {
    artifacts.push(...buildAIAgentArtifacts(agents));
  }

  notes.push(
    agents.length > 0
      ? `Generated and validated ${agents.length} vendor-neutral AI Agent architecture specification(s), ${toolCatalog.length} tool(s). This means Stitchfy can produce and validate the spec — not that an LLM was executed, a tool was invoked, or the agent is safe, compliant, or production-ready.`
      : "No AI Agent specification could be validated for this business context."
  );

  return { implemented: agents.length > 0, plan: agentPlan, agents, toolCatalog, artifacts, notes };
}

async function validate(output: AIAgentsSection): Promise<ValidationResult<AIAgentsSection>> {
  if (output.implemented && output.agents.length === 0) {
    return validationFail(["implemented is true but no agents were produced"]);
  }
  return validationOk(output);
}

export const aiAgentsCapability: StitchfyCapability<CapabilityAssessment, AIAgentsSection> = {
  id: AI_AGENTS_CAPABILITY_ID,
  name: "AI Agents",
  version: "0.2.0",
  supports,
  assess,
  plan,
  execute,
  validate,
};
