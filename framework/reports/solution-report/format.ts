/** Simple English pluralizer for this module's fixed set of known-singular labels — not a general-purpose implementation. */
export function pluralize(singular: string, count: number): string {
  if (count === 1) return singular;
  if (/[^aeiou]y$/.test(singular)) return singular.replace(/y$/, "ies");
  return `${singular}s`;
}
