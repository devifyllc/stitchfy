/**
 * Markdown parser for Stitchfy project specification files.
 *
 * Understands the structured format used by input/project.md and examples/:
 *   # Project: Business Name
 *   ## Section Heading
 *   - **Bold Key:** Value        ← explicit key-value
 *   - ShortKey: Value            ← inferred key-value (key ≤ 4 words)
 *   - Plain list item text       ← list item
 */

export interface ParsedSection {
  heading: string;
  keyValues: Record<string, string>;
  items: string[];
  raw: string;
}

export interface ParsedProject {
  title: string;
  sections: Record<string, ParsedSection>;
  raw: string;
}

function normalizeHeading(heading: string): string {
  return heading
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

function parseBulletLine(rawLine: string): { type: "kv"; key: string; value: string } | { type: "item"; text: string } {
  const line = rawLine.replace(/^-\s+/, "");

  // Bold key-value: **Key:** Value  (colon is inside the bold markers)
  const boldMatch = line.match(/^\*\*([^*:]+):\*\*\s*(.*)$/);
  if (boldMatch) {
    return { type: "kv", key: boldMatch[1].trim(), value: boldMatch[2].trim() };
  }

  // Inferred key-value: Key: Value — only if key is ≤ 4 words
  const colonIdx = line.indexOf(":");
  if (colonIdx > 0 && colonIdx < line.length - 1) {
    const beforeColon = line.slice(0, colonIdx).trim();
    const afterColon = line.slice(colonIdx + 1).trim();
    const wordCount = beforeColon.split(/\s+/).length;
    // Exclude lines where the colon is clearly mid-sentence (e.g. "Note: this long thing...")
    // Allow if key is short and value is non-empty
    if (wordCount <= 4 && afterColon.length > 0 && !beforeColon.includes("**")) {
      return { type: "kv", key: beforeColon, value: afterColon };
    }
  }

  return { type: "item", text: line };
}

function parseSection(heading: string, body: string): ParsedSection {
  const keyValues: Record<string, string> = {};
  const items: string[] = [];

  const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    if (!line.startsWith("-")) continue;
    const parsed = parseBulletLine(line);
    if (parsed.type === "kv") {
      keyValues[parsed.key] = parsed.value;
    } else {
      items.push(parsed.text);
    }
  }

  return { heading, keyValues, items, raw: body };
}

export function parseMarkdown(content: string): ParsedProject {
  const raw = content;

  // Extract project title from # heading
  const titleMatch = content.match(/^#\s+(?:Project:\s*)?(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : "Untitled Project";

  // Split into sections by ## headings
  const sectionRegex = /^##\s+(.+)$/gm;
  const sections: Record<string, ParsedSection> = {};

  let match: RegExpExecArray | null;
  const sectionMatches: Array<{ heading: string; start: number }> = [];

  while ((match = sectionRegex.exec(content)) !== null) {
    sectionMatches.push({ heading: match[1].trim(), start: match.index + match[0].length });
  }

  for (let i = 0; i < sectionMatches.length; i++) {
    const { heading, start } = sectionMatches[i];
    const end = i + 1 < sectionMatches.length ? sectionMatches[i + 1].start - sectionMatches[i + 1].heading.length - 4 : content.length;
    const body = content.slice(start, end);
    const key = normalizeHeading(heading);
    sections[key] = parseSection(heading, body);
  }

  return { title, sections, raw };
}

// ─── Helpers for agents to read sections by alias ────────────────────────────

const SECTION_ALIASES: Record<string, string[]> = {
  "business": ["business-information", "business-info", "business", "company-information"],
  "hours": ["operating-hours", "hours", "business-hours", "hours-of-operation"],
  "services": ["services", "service-list", "what-we-offer", "our-services"],
  "location": ["location", "where-we-are", "our-location"],
  "contact": ["contact-information", "contact-info", "contact", "reach-us"],
  "social": ["social-networks", "social-media", "social", "socials", "follow-us"],
  "booking": ["booking-preference", "booking", "appointments", "how-to-book"],
  "pages": ["desired-pages", "pages", "site-pages", "page-list"],
  "tone": ["brand-tone", "tone", "voice", "brand-voice", "brand"],
  "colors": ["color-preferences", "colours", "color-palette", "colors", "colour-preferences"],
  "notes": ["special-notes", "notes", "additional-notes", "additional-information"],
};

export function getSection(parsed: ParsedProject, alias: keyof typeof SECTION_ALIASES): ParsedSection | undefined {
  const candidates = SECTION_ALIASES[alias] ?? [alias];
  for (const key of candidates) {
    if (parsed.sections[key]) return parsed.sections[key];
  }
  return undefined;
}

export function extractHex(value: string): string {
  const match = value.match(/#[0-9A-Fa-f]{6}(?:[0-9A-Fa-f]{2})?/);
  return match ? match[0] : value;
}
