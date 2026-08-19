import type { ParsedProject } from "../../core/markdown-parser.js";
import { explicitMetadata } from "../../core/contracts/provenance.js";
import { findSection, sectionEntries, makeIdGenerator, SECTION_CANDIDATES } from "../shared/section-lookup.js";
import type { Constraint, ConstraintType } from "./constraint.types.js";

const TYPE_PATTERNS: Array<{ pattern: RegExp; type: ConstraintType }> = [
  { pattern: /budget|cost|price/i, type: "budget" },
  { pattern: /deadline|timeline|by \d|launch date/i, type: "timeline" },
  { pattern: /regulat|complian|gdpr|hipaa|law/i, type: "regulatory" },
  { pattern: /secur|encrypt|password|auth/i, type: "security" },
  { pattern: /\bdata\b|storage|retention/i, type: "data" },
  { pattern: /integrat|api|third-party/i, type: "integration" },
  { pattern: /staff|hours|operational|process/i, type: "operational" },
  { pattern: /technical|technology|platform|hosting/i, type: "technical" },
  { pattern: /business|policy|brand/i, type: "business" },
];

function classifyType(description: string): ConstraintType {
  for (const { pattern, type } of TYPE_PATTERNS) {
    if (pattern.test(description)) return type;
  }
  return "unknown";
}

export function extractConstraints(parsed: ParsedProject): Constraint[] {
  const nextId = makeIdGenerator("CONSTR");
  const entries = sectionEntries(findSection(parsed, SECTION_CANDIDATES.constraints));
  return entries.map((description) => ({
    id: nextId(),
    type: classifyType(description),
    description,
    metadata: explicitMetadata("constraints", description),
  }));
}
