/**
 * Generic entity index — walks the already-validated SolutionBlueprint once
 * and records every object carrying a string `id` field, keyed by that id.
 *
 * This is what lets the report treat ids like REQ-001, SYS-001, GAP-001 and
 * STEP-001 as real navigation anchors instead of opaque strings, and lets it degrade
 * gracefully as new capabilities add new id-bearing arrays: nothing here is
 * hardcoded to one capability's shape (see docs/architecture/ARCHITECTURE.md
 * "Schema Evolution").
 */

import type { SolutionBlueprint } from "../../schemas/solution-blueprint/solution-blueprint.types.js";
import type { EntityIndexEntry } from "./types.js";

const KNOWN_KIND_LABELS: Record<string, string> = {
  requirements: "Requirement",
  processes: "Process",
  actors: "Actor",
  systems: "System",
  constraints: "Constraint",
  businessRules: "Business Rule",
  informationGaps: "Information Gap",
  decisions: "Architecture Decision",
  risks: "Risk",
  workflows: "Workflow",
  steps: "Workflow Step",
  integrations: "Integration",
  agents: "AI Agent",
  toolCatalog: "AI Tool",
  trustBoundaries: "Trust Boundary",
  dataProtection: "Data Protection Requirement",
  requirements_security: "Security Requirement",
  profiles: "System Modernization Profile",
  technicalDebt: "Technical Debt Finding",
  dependencies: "System Dependency",
  preservationRequirements: "Preservation Requirement",
  seams: "Modernization Seam",
  migrationConstraints: "Migration Constraint",
  migrationCandidates: "Architecture Decision",
  modernizationDeltas: "Modernization Delta",
  targetStateRequirements: "Target-State Requirement",
  validationRequirements: "Validation Requirement",
  workstreams: "Workstream",
  deploymentUnits: "Deployment Unit",
  runtimeRequirements: "Runtime Requirement",
  connectivityRequirements: "Connectivity Requirement",
  environmentRequirements: "Environment Requirement",
  telemetryRequirements: "Telemetry Requirement",
  signals: "Observability Signal",
  logRequirements: "Log Requirement",
  metricRequirements: "Metric Requirement",
  healthRequirements: "Health Requirement",
  alertRequirements: "Alert Requirement",
  dashboardSpecifications: "Dashboard Specification",
  operationalObjectives: "Operational Objective",
};

function humanizeKey(key: string): string {
  const withSpaces = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

function labelFor(obj: Record<string, unknown>, fallbackId: string): string {
  for (const field of ["description", "name", "topic", "title", "purpose", "objective", "question", "role", "event"]) {
    const value = obj[field];
    if (typeof value === "string" && value.trim().length > 0) return value;
  }
  return fallbackId;
}

function walk(node: unknown, parentKey: string | undefined, index: Map<string, EntityIndexEntry>): void {
  if (Array.isArray(node)) {
    for (const item of node) walk(item, parentKey, index);
    return;
  }
  if (node === null || typeof node !== "object") return;

  const obj = node as Record<string, unknown>;
  const id = obj["id"];
  if (typeof id === "string" && id.length > 0 && !index.has(id)) {
    const kind = (parentKey && KNOWN_KIND_LABELS[parentKey]) || (parentKey ? humanizeKey(parentKey) : "Entity");
    index.set(id, { id, label: labelFor(obj, id), kind });
  }

  for (const [key, value] of Object.entries(obj)) {
    walk(value, key, index);
  }
}

/** Builds an id → {label, kind} lookup by walking the entire blueprint once. First occurrence wins (discovery-layer fields are declared first on SolutionBlueprint, so they take priority over any coincidental id reuse deeper in a capability output). */
export function buildEntityIndex(blueprint: SolutionBlueprint): Record<string, EntityIndexEntry> {
  const index = new Map<string, EntityIndexEntry>();
  walk(blueprint, undefined, index);
  return Object.fromEntries(index);
}
