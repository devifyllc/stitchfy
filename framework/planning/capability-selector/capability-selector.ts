/**
 * Shared keyword-heuristic used by capability supports() checks — the same
 * technique already used for industry-aware defaults in the UX/SEO agents
 * (see CLAUDE.md "Industry-aware defaults" and intake.agent.ts's
 * detectComplianceFlags). Centralized here so each capability doesn't
 * reimplement substring matching.
 */

export function matchesKeywords(text: string, keywords: string[]): boolean {
  if (!text) return false;
  const haystack = text.toLowerCase();
  return keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
}
