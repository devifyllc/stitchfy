/**
 * Placeholder — mirrors the "OPENAI INTEGRATION POINT" convention already
 * used in framework/agents/*.agent.ts. No SDK dependency is added; this only
 * establishes where a real OpenAI client would be constructed once
 * OPENAI_API_KEY is provided and a capability actually needs it.
 */

import type { Provider } from "../../core/contracts/provider.js";

export interface OpenAIProviderConfig {
  apiKey?: string;
  model?: string;
}

export const openaiProvider: Provider<OpenAIProviderConfig, unknown> = {
  id: "openai",
  kind: "llm",

  isConfigured(): boolean {
    return Boolean(process.env.OPENAI_API_KEY);
  },

  getClient(): unknown {
    throw new Error(
      "openaiProvider: not yet implemented — see OPENAI INTEGRATION POINT comments in framework/agents/*.agent.ts"
    );
  },
};
