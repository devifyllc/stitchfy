/**
 * Provider contract — the seam between Stitchfy's domain logic and a
 * specific vendor technology (OpenAI, Gemini, Google Stitch, AWS, Azure, a
 * SaaS API, ...). Capability modules depend on this interface, never on a
 * concrete vendor SDK, so a provider can be swapped without touching the
 * capability that uses it.
 */

export type ProviderKind = "llm" | "design" | "cloud" | "integration";

export interface Provider<TConfig = unknown, TClient = unknown> {
  id: string;
  kind: ProviderKind;
  isConfigured(): boolean;
  getClient(config?: TConfig): TClient;
}
