/**
 * Intake Agent — Business Normalizer
 *
 * Owns: blueprint.project + blueprint.business
 *
 * Local mode: parses the Markdown project file using the structured
 * section/key-value format and extracts normalized business data.
 *
 * OpenAI mode (future): call the API with intake.prompt.md as the system
 * prompt and the raw Markdown as the user message. Parse the JSON response
 * and validate it against BusinessSchema before returning.
 *
 * OPENAI INTEGRATION POINT:
 *   const response = await openai.chat.completions.create({
 *     model: process.env.OPENAI_MODEL ?? "gpt-4o",
 *     messages: [
 *       { role: "system", content: readPrompt("intake.prompt.md") },
 *       { role: "user", content: state.markdown },
 *     ],
 *     response_format: { type: "json_object" },
 *   });
 *   return JSON.parse(response.choices[0].message.content);
 */

import type { AgentConfig } from "../orchestrator/agent-runner.js";
import type { WorkflowState } from "../orchestrator/workflow-state.js";
import type { WebsiteBlueprint, BusinessData, ProjectMeta } from "../schemas/blueprint.types.js";
import { getSection, extractHex } from "../core/markdown-parser.js";
import * as path from "path";

// ─── Compliance flag detection ────────────────────────────────────────────────

const COMPLIANCE_PATTERNS: Array<{ pattern: RegExp; flag: string }> = [
  { pattern: /\bhipaa\b|\bphi\b|\bpatient\s+record|\belectronic\s+health/i, flag: "hipaa-sensitive" },
  { pattern: /\bmedical\b|\bclinic\b|\bphysician\b|\bdental\b|\bhealthcare\b|\bpediatric/i, flag: "medical-context" },
  { pattern: /\bpayment\b|\bcheckout\b|\bcredit\s+card\b|\bpurchase\b|\be-commerce/i, flag: "payment-processing" },
  { pattern: /\blogin\b|\bregister\b|\buser\s+account\b|\bauthentication\b|\bsign\s+up/i, flag: "authentication" },
  { pattern: /\bchildren\b|\bminors\b|\bkids\b|\bcoppa/i, flag: "minor-audience" },
  { pattern: /\blegal\s+advice\b|\bfinancial\s+advice\b|\btax\s+advice\b/i, flag: "legal-financial-advice" },
  { pattern: /\bpersonal\s+information\b|\bssn\b|\bsocial\s+security/i, flag: "personal-data" },
];

function detectComplianceFlags(markdown: string): string[] {
  // Filter out negation lines ("Do NOT include payments", "no booking engine", etc.)
  // so we don't flag things the spec explicitly says to exclude.
  const positiveLines = markdown
    .split("\n")
    .filter((l) => !/\b(do\s+not|don't|no\s+real|without|exclud|not\s+include|not\s+support)\b/i.test(l))
    .join("\n");

  const flags = new Set<string>();
  for (const { pattern, flag } of COMPLIANCE_PATTERNS) {
    if (pattern.test(positiveLines)) flags.add(flag);
  }
  return [...flags];
}

// ─── Address + location extraction ───────────────────────────────────────────

function extractAddress(locationSection: ReturnType<typeof getSection>): { address: string; location: string; serviceAreas: string[] } {
  if (!locationSection) return { address: "", location: "", serviceAreas: [] };

  const kv = locationSection.keyValues;
  const items = locationSection.items;

  const address = kv["Address"] ?? kv["address"] ?? "";
  const neighborhood = kv["Neighborhood"] ?? kv["neighborhood"] ?? "";
  const city = address.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*[A-Z]{2}/)?.[1] ?? "";
  const state = address.match(/,\s*([A-Z]{2})\s/)?.[1] ?? "";

  const location = city && state ? `${city}, ${state}` : (neighborhood || items[0] || address);
  const serviceAreas = city ? [`${city}, ${state}`] : [];

  return { address, location, serviceAreas };
}

// ─── Hours extraction ─────────────────────────────────────────────────────────

function extractHours(hoursSection: ReturnType<typeof getSection>): Record<string, string> {
  if (!hoursSection) return {};
  const hours: Record<string, string> = {};
  // Key-values like { "Monday–Friday": "9:00 AM – 7:00 PM" }
  for (const [k, v] of Object.entries(hoursSection.keyValues)) {
    hours[k] = v;
  }
  // Plain items like "Closed on major holidays"
  for (const item of hoursSection.items) {
    if (item.toLowerCase().startsWith("closed")) {
      hours["Note"] = item;
    }
  }
  return hours;
}

// ─── Social links normalization ───────────────────────────────────────────────

function normalizeSocialHandle(platform: string, handle: string): string {
  const p = platform.toLowerCase();
  const h = handle.trim();
  if (h.startsWith("http")) return h;

  const at = h.startsWith("@") ? h.slice(1) : h.replace(/^\//, "");
  const bases: Record<string, string> = {
    instagram: "https://instagram.com/",
    facebook: "https://facebook.com/",
    tiktok: "https://tiktok.com/@",
    twitter: "https://twitter.com/",
    youtube: "https://youtube.com/",
    linkedin: "https://linkedin.com/company/",
    pinterest: "https://pinterest.com/",
  };
  return bases[p] ? `${bases[p]}${at}` : h;
}

// ─── Missing information detection ───────────────────────────────────────────

function detectMissingInfo(biz: Partial<BusinessData>): string[] {
  const missing: string[] = [];
  if (!biz.phone) missing.push("phone number");
  if (!biz.email) missing.push("email address");
  if (!biz.address) missing.push("physical address");
  if (!biz.description) missing.push("business description");
  if (!biz.operatingHours || Object.keys(biz.operatingHours).length === 0) missing.push("operating hours");
  if (!biz.services || biz.services.length === 0) missing.push("services list");
  return missing;
}

// ─── Main run ─────────────────────────────────────────────────────────────────

async function run(state: WorkflowState): Promise<Partial<WebsiteBlueprint>> {
  const { parsed, markdown, inputPath } = state;

  // ── Business section ──────────────────────────────────────────────────────

  const bizSection = getSection(parsed, "business");
  const contactSection = getSection(parsed, "contact");
  const hoursSection = getSection(parsed, "hours");
  const servicesSection = getSection(parsed, "services");
  const locationSection = getSection(parsed, "location");
  const socialSection = getSection(parsed, "social");
  const bookingSection = getSection(parsed, "booking");

  const name =
    bizSection?.keyValues["Business Name"] ??
    bizSection?.keyValues["Name"] ??
    parsed.title.replace(/^Project:\s*/i, "").trim();

  const industry =
    bizSection?.keyValues["Industry"] ??
    bizSection?.keyValues["Type"] ??
    "";

  const description =
    bizSection?.keyValues["Description"] ??
    bizSection?.keyValues["About"] ??
    "";

  const phone =
    contactSection?.keyValues["Phone"] ??
    contactSection?.keyValues["Tel"] ??
    contactSection?.keyValues["Telephone"] ??
    bizSection?.keyValues["Phone"] ??
    "";

  const email =
    contactSection?.keyValues["Email"] ??
    bizSection?.keyValues["Email"] ??
    "";

  const { address, location, serviceAreas } = extractAddress(locationSection);
  const operatingHours = extractHours(hoursSection);
  const services = servicesSection?.items ?? [];

  const rawSocialLinks = socialSection?.keyValues ?? {};
  const socialLinks: Record<string, string> = {};
  for (const [platform, handle] of Object.entries(rawSocialLinks)) {
    socialLinks[platform] = normalizeSocialHandle(platform, handle);
  }

  const bookingItems = [...(bookingSection?.items ?? []), ...Object.values(bookingSection?.keyValues ?? {})];
  const booking = bookingItems.join("; ");

  const complianceFlags = detectComplianceFlags(markdown);

  const partialBiz: Partial<BusinessData> = { name, industry, description, phone, email, address, location, serviceAreas, operatingHours, services, socialLinks, booking };
  const missingInformation = detectMissingInfo(partialBiz);

  const business: BusinessData = {
    name,
    industry,
    description,
    location,
    address,
    serviceAreas,
    phone,
    email,
    operatingHours,
    socialLinks,
    booking,
    services,
    complianceFlags,
    missingInformation,
  };

  // ── Project meta ──────────────────────────────────────────────────────────

  const project: ProjectMeta = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    sourceFile: path.basename(inputPath),
    frameworkVersion: "2.0.0",
  };

  console.log(`  ✓  Extracted: ${name} (${industry || "unknown industry"})`);
  if (complianceFlags.length > 0) console.log(`  ⚑  Compliance flags: ${complianceFlags.join(", ")}`);
  if (missingInformation.length > 0) console.log(`  ⚠  Missing: ${missingInformation.join(", ")}`);

  return { project, business };
}

export const intakeAgent: AgentConfig = {
  name: "IntakeAgent",
  stage: "intake",
  run,
};
