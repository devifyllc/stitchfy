/**
 * Wires the 8 built-in capabilities into a fresh registry. This is the only
 * file that needs to change when a new capability module is added.
 */

import { CapabilityRegistry } from "./capability-registry.js";
import { websiteCapability } from "../../capabilities/website/website.capability.js";
import { workflowAutomationCapability } from "../../capabilities/workflow-automation/workflow-automation.capability.js";
import { aiAgentsCapability } from "../../capabilities/ai-agents/ai-agents.capability.js";
import { integrationsCapability } from "../../capabilities/integrations/integrations.capability.js";
import { cloudCapability } from "../../capabilities/cloud/cloud.capability.js";
import { securityGovernanceCapability } from "../../capabilities/security-governance/security-governance.capability.js";
import { observabilityCapability } from "../../capabilities/observability/observability.capability.js";
import { modernizationCapability } from "../../capabilities/modernization/modernization.capability.js";

export function createDefaultRegistry(): CapabilityRegistry {
  const registry = new CapabilityRegistry();

  for (const capability of [
    websiteCapability,
    workflowAutomationCapability,
    aiAgentsCapability,
    integrationsCapability,
    cloudCapability,
    securityGovernanceCapability,
    observabilityCapability,
    modernizationCapability,
  ]) {
    registry.register(capability);
  }

  return registry;
}
