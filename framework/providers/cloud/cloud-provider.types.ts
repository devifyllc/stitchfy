/**
 * Vendor-neutral cloud provider contract. No AWS/Azure/GCP implementation
 * exists yet — the Cloud Architecture capability depends on this interface,
 * never on a vendor SDK directly.
 */

import type { Provider } from "../../core/contracts/provider.js";

export interface CloudDeployRequest {
  environment: string;
  artifactPath: string;
}

export interface CloudDeployResult {
  ok: boolean;
  url?: string;
  logs: string[];
}

export interface CloudProvider extends Provider {
  deploy(request: CloudDeployRequest): Promise<CloudDeployResult>;
}
