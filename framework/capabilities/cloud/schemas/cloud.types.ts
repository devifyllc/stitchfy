export interface ComputeResource {
  id: string;
  type: string;
  description: string;
}

export interface StorageResource {
  id: string;
  type: string;
  description: string;
}

export interface DatabaseResource {
  id: string;
  engine: string;
  description: string;
}

export interface NetworkingConfig {
  vpcNeeded: boolean;
  publicEndpoints: string[];
  notes: string[];
}

export type CloudProviderKind = "unspecified" | "aws" | "azure" | "gcp" | "other";

export interface CloudArchitectureSection {
  implemented: boolean;
  provider: CloudProviderKind;
  compute: ComputeResource[];
  storage: StorageResource[];
  databases: DatabaseResource[];
  networking: NetworkingConfig;
  deploymentStrategy: string;
  scalability: string[];
  resilience: string[];
  environments: string[];
  notes: string[];
}
