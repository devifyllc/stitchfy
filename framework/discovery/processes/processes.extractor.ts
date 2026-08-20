/**
 * Parses the "Business Processes"/"Workflows" section into structured
 * BusinessProcess objects. Not BPMN — a domain representation only.
 *
 * ParsedSection.raw (the section's original text, before markdown-parser.ts's
 * bullet-line parsing) is split on blank lines into chunks. A chunk whose
 * first line matches a known label ("Trigger:", "Actors:", "Current systems:"/
 * "Systems:", "Steps:", "Inputs:", "Outputs:", "Pain points:", "Business
 * rules:", "Manual steps:", "Automation candidates:") contributes its
 * content lines to the process currently being built; a chunk that matches
 * no label starts a NEW process (its first line is the title). This is
 * general for any number of processes with any subset of labels present —
 * see docs/architecture/ARCHITECTURE.md "Discovery Model" for a worked
 * example. Never touches framework/core/markdown-parser.ts.
 */

import type { ParsedProject } from "../../core/markdown-parser.js";
import { explicitMetadata } from "../../core/contracts/provenance.js";
import { findSection, SECTION_CANDIDATES, stripListPrefix } from "../shared/section-lookup.js";
import type { BusinessProcess } from "./business-process.types.js";
import type { BusinessActor } from "../actors/business-actor.types.js";
import { makeProcessActor } from "../actors/actors.extractor.js";
import type { SystemInventoryItem } from "../systems/system-inventory.types.js";
import { makeProcessSystem } from "../systems/systems.extractor.js";
import type { PainPoint } from "../business/pain-point.types.js";
import { makeProcessPainPoint } from "../business/goals-outcomes.extractor.js";
import type { BusinessRule } from "../business-rules/business-rule.types.js";
import { makeProcessBusinessRule } from "../business-rules/business-rules.extractor.js";

type ProcessField =
  | "trigger"
  | "actors"
  | "systems"
  | "inputs"
  | "outputs"
  | "steps"
  | "painPoints"
  | "businessRules"
  | "manualSteps"
  | "automationCandidates";

const LABELS: Array<{ field: ProcessField; aliases: string[] }> = [
  { field: "trigger", aliases: ["trigger"] },
  { field: "actors", aliases: ["actors"] },
  { field: "systems", aliases: ["current systems", "systems"] },
  { field: "inputs", aliases: ["inputs"] },
  { field: "outputs", aliases: ["outputs"] },
  { field: "steps", aliases: ["steps"] },
  { field: "painPoints", aliases: ["pain points"] },
  { field: "businessRules", aliases: ["business rules"] },
  { field: "manualSteps", aliases: ["manual steps"] },
  { field: "automationCandidates", aliases: ["automation candidates"] },
];

function matchLabel(line: string): { field: ProcessField; inline: string } | undefined {
  const m = line.match(/^([a-zA-Z ]+?)\s*:\s*(.*)$/);
  if (!m) return undefined;
  const headerText = m[1].trim().toLowerCase();
  const label = LABELS.find(({ aliases }) => aliases.includes(headerText));
  return label ? { field: label.field, inline: m[2].trim() } : undefined;
}

interface ProcessBuilder {
  title: string;
  descriptionLines: string[];
  trigger: string[];
  actorNames: string[];
  systemNames: string[];
  inputs: string[];
  outputs: string[];
  steps: string[];
  painPointDescs: string[];
  businessRuleDescs: string[];
  manualSteps: string[];
  automationCandidates: string[];
}

const FIELD_KEY: Record<ProcessField, keyof ProcessBuilder> = {
  trigger: "trigger",
  actors: "actorNames",
  systems: "systemNames",
  inputs: "inputs",
  outputs: "outputs",
  steps: "steps",
  painPoints: "painPointDescs",
  businessRules: "businessRuleDescs",
  manualSteps: "manualSteps",
  automationCandidates: "automationCandidates",
};

function newBuilder(title: string): ProcessBuilder {
  return {
    title,
    descriptionLines: [],
    trigger: [],
    actorNames: [],
    systemNames: [],
    inputs: [],
    outputs: [],
    steps: [],
    painPointDescs: [],
    businessRuleDescs: [],
    manualSteps: [],
    automationCandidates: [],
  };
}

function appendToField(builder: ProcessBuilder, field: ProcessField, lines: string[]): void {
  const key = FIELD_KEY[field];
  (builder[key] as string[]).push(...lines.map(stripListPrefix).filter(Boolean));
}

function extractProcessBuilders(parsed: ParsedProject): ProcessBuilder[] {
  const section = findSection(parsed, SECTION_CANDIDATES.processes);
  if (!section) return [];

  const chunks = section.raw
    .split(/\n\s*\n+/)
    .map((c) => c.trim())
    .filter(Boolean);

  const builders: ProcessBuilder[] = [];
  let current: ProcessBuilder | undefined;

  for (const chunk of chunks) {
    const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    const label = matchLabel(lines[0]);
    if (label) {
      if (!current) continue; // a label with no title yet — malformed input, skip
      appendToField(current, label.field, [label.inline, ...lines.slice(1)].filter(Boolean));
    } else {
      if (current) builders.push(current);
      current = newBuilder(lines[0]);
      if (lines.length > 1) current.descriptionLines.push(...lines.slice(1));
    }
  }
  if (current) builders.push(current);

  return builders;
}

export interface ProcessIdGenerators {
  process: () => string;
  actor: () => string;
  system: () => string;
  painPoint: () => string;
  rule: () => string;
}

export interface ProcessExtractionResult {
  processes: BusinessProcess[];
  additionalActors: BusinessActor[];
  additionalSystems: SystemInventoryItem[];
  additionalPainPoints: PainPoint[];
  additionalBusinessRules: BusinessRule[];
}

export function extractProcesses(
  parsed: ParsedProject,
  knownActors: BusinessActor[],
  knownSystems: SystemInventoryItem[],
  knownPainPoints: PainPoint[],
  idGen: ProcessIdGenerators
): ProcessExtractionResult {
  const builders = extractProcessBuilders(parsed);

  const additionalActors: BusinessActor[] = [];
  const additionalSystems: SystemInventoryItem[] = [];
  const additionalPainPoints: PainPoint[] = [];
  const additionalBusinessRules: BusinessRule[] = [];

  const resolveActor = (name: string): string => {
    const existing = [...knownActors, ...additionalActors].find((a) => a.description.toLowerCase() === name.toLowerCase());
    if (existing) return existing.id;
    const created = makeProcessActor(name, idGen.actor);
    additionalActors.push(created);
    return created.id;
  };

  const resolveSystem = (name: string): string => {
    const existing = [...knownSystems, ...additionalSystems].find((s) => s.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing.id;
    const created = makeProcessSystem(name, idGen.system);
    additionalSystems.push(created);
    return created.id;
  };

  const processes: BusinessProcess[] = builders.map((builder) => {
    const processId = idGen.process();

    const actorIds = builder.actorNames.map(resolveActor);
    const systemIds = builder.systemNames.map(resolveSystem);

    const painPointIds = builder.painPointDescs.map((desc) => {
      const existing = [...knownPainPoints, ...additionalPainPoints].find(
        (p) => p.description.toLowerCase() === desc.toLowerCase()
      );
      if (existing) {
        if (!existing.relatedProcessIds.includes(processId)) existing.relatedProcessIds.push(processId);
        return existing.id;
      }
      const created = makeProcessPainPoint(desc, processId, idGen.painPoint);
      additionalPainPoints.push(created);
      return created.id;
    });

    const businessRuleIds = builder.businessRuleDescs.map((desc) => {
      const created = makeProcessBusinessRule(desc, processId, idGen.rule);
      additionalBusinessRules.push(created);
      return created.id;
    });

    return {
      id: processId,
      name: builder.title,
      description: builder.descriptionLines.join(" "),
      actorIds,
      trigger: builder.trigger.join(" "),
      steps: builder.steps,
      systemIds,
      inputs: builder.inputs,
      outputs: builder.outputs,
      painPointIds,
      businessRuleIds,
      manualSteps: builder.manualSteps,
      automationCandidates: builder.automationCandidates,
      metadata: explicitMetadata("business-processes", builder.title),
    };
  });

  return { processes, additionalActors, additionalSystems, additionalPainPoints, additionalBusinessRules };
}
