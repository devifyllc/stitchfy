/**
 * Deterministic absence checks — no LLM involved. Each gap points back to
 * why it was raised so a future capability (or a human) can decide what to
 * do about it. This is the mechanism that will eventually let Stitchfy ask
 * better questions before generating architecture (see item 7 of the Phase
 * 1 task) — no interactive questionnaire is implemented yet.
 */

import { makeIdGenerator } from "../shared/section-lookup.js";
import type { DiscoveryResult } from "../discovery-result.types.js";
import type { InformationGap } from "./information-gap.types.js";

type GapInput = Omit<DiscoveryResult, "informationGaps" | "traceability">;

const CUSTOMER_DATA_HINT = /customer information|personal (data|information)|\bhealth\b|\bmedical\b|\brecord(ed|s)?\b/i;

export function extractInformationGaps(result: GapInput): InformationGap[] {
  const nextId = makeIdGenerator("GAP");
  const gaps: InformationGap[] = [];

  if (result.goals.length === 0) {
    gaps.push({
      id: nextId(),
      topic: "Business goals",
      question: "What are the primary goals for this solution?",
      importance: "high",
      blocking: true,
      relatedCapabilityIds: [],
    });
  }

  if (result.actors.length === 0) {
    gaps.push({
      id: nextId(),
      topic: "Users / actors",
      question: "Who are the people or roles involved in using or running this solution?",
      importance: "medium",
      blocking: false,
      relatedCapabilityIds: ["workflow-automation", "ai-agents"],
    });
  }

  if (result.painPoints.length === 0) {
    gaps.push({
      id: nextId(),
      topic: "Pain points",
      question: "What current problems is this solution meant to solve?",
      importance: "medium",
      blocking: false,
      relatedCapabilityIds: [],
    });
  }

  if (result.systems.length === 0) {
    gaps.push({
      id: nextId(),
      topic: "Existing systems",
      question: "What systems or tools are currently used to run this business?",
      importance: "medium",
      blocking: false,
      relatedCapabilityIds: ["integrations", "modernization"],
    });
  }

  if (result.constraints.length === 0) {
    gaps.push({
      id: nextId(),
      topic: "Constraints",
      question: "Are there budget, timeline, regulatory, or technical constraints to account for?",
      importance: "low",
      blocking: false,
      relatedCapabilityIds: [],
    });
  }

  if (result.businessRules.length === 0) {
    gaps.push({
      id: nextId(),
      topic: "Business rules",
      question: "Are there rules that must always hold (e.g. no double-booking, approval thresholds)?",
      importance: "low",
      blocking: false,
      relatedCapabilityIds: ["workflow-automation"],
    });
  }

  const mentionsCustomerData = [
    ...result.painPoints.map((p) => p.description),
    ...result.processes.map((p) => `${p.description} ${p.steps.join(" ")}`),
  ].some((text) => CUSTOMER_DATA_HINT.test(text));

  if (result.dataEntities.length === 0 && mentionsCustomerData) {
    gaps.push({
      id: nextId(),
      topic: "Customer data",
      question:
        "Does this process store sensitive customer data (e.g. health information, payment details) that needs special handling?",
      importance: "high",
      blocking: true,
      relatedCapabilityIds: ["security-governance"],
    });
  } else if (result.dataEntities.length === 0) {
    gaps.push({
      id: nextId(),
      topic: "Data",
      question: "What data does this solution create, store, or rely on?",
      importance: "medium",
      blocking: false,
      relatedCapabilityIds: ["security-governance", "cloud"],
    });
  }

  const requirementsAllDerived = result.requirements.length > 0 && result.requirements.every((r) => r.metadata.inferred === false && r.metadata.sources[0]?.sourceType === "derived");
  if (requirementsAllDerived) {
    gaps.push({
      id: nextId(),
      topic: "Requirements",
      question: "No explicit requirements were provided — the requirements above were derived from desired outcomes. Can you confirm or refine them?",
      importance: "medium",
      blocking: false,
      relatedCapabilityIds: [],
    });
  }

  return gaps;
}
