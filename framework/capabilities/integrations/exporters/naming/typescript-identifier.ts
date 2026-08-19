/**
 * Deterministic domain-name → safe TypeScript identifier transformation
 * (task item 26). No vendor-specific logic — reused by every exporter.
 *
 * "Fulfillment API" → pascal → "FulfillmentApi"
 * "Submit approved order" → camel → "submitApprovedOrder"
 */

function toWords(text: string): string[] {
  return text
    // camelCase/PascalCase boundaries ("externalOrderId" -> "external Order Id")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    // an acronym followed by a new word ("XMLParser" -> "XML Parser")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function capitalize(word: string): string {
  const lower = word.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function toSafeTypeScriptIdentifier(text: string, style: "pascal" | "camel"): string {
  const words = toWords(text);
  if (words.length === 0) return style === "pascal" ? "Unnamed" : "unnamed";

  const capitalized = words.map(capitalize);
  const joined =
    style === "pascal"
      ? capitalized.join("")
      : words[0].toLowerCase() + capitalized.slice(1).join("");

  return /^[0-9]/.test(joined) ? `_${joined}` : joined;
}

export interface IdentifierCollision {
  identifier: string;
  sourceNames: string[];
}

/**
 * Detects two or more distinct source names normalizing to the same
 * identifier (task item 26: "do not silently overwrite one"). Callers
 * (export validation) turn this into a hard error rather than picking a
 * winner.
 */
export function detectIdentifierCollisions(
  entries: Array<{ sourceName: string; identifier: string }>
): IdentifierCollision[] {
  const byIdentifier = new Map<string, Set<string>>();
  for (const entry of entries) {
    const set = byIdentifier.get(entry.identifier) ?? new Set<string>();
    set.add(entry.sourceName);
    byIdentifier.set(entry.identifier, set);
  }

  return [...byIdentifier.entries()]
    .filter(([, sourceNames]) => sourceNames.size > 1)
    .map(([identifier, sourceNames]) => ({ identifier, sourceNames: [...sourceNames] }));
}
