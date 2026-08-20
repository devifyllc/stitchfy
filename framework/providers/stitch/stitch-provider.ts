/**
 * Adapts the existing StitchClient (framework/core/stitch-client.ts, used
 * today by build:site:stitch) to the generic Provider contract, so future
 * capabilities can depend on `Provider<...>` instead of importing
 * StitchClient directly.
 */

import type { Provider } from "../../core/contracts/provider.js";
import { StitchClient } from "../../core/stitch-client.js";

export interface StitchProviderConfig {
  apiKey?: string;
}

export const stitchProvider: Provider<StitchProviderConfig, StitchClient> = {
  id: "google-stitch",
  kind: "design",

  isConfigured(): boolean {
    return Boolean(process.env.STITCH_API_KEY);
  },

  getClient(config?: StitchProviderConfig): StitchClient {
    const apiKey = config?.apiKey ?? process.env.STITCH_API_KEY;
    if (!apiKey) {
      throw new Error("stitchProvider: STITCH_API_KEY is not set (see .env.example)");
    }
    return new StitchClient(apiKey);
  },
};
