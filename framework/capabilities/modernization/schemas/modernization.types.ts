export interface MigrationCandidate {
  systemId: string;
  name: string;
  recommendedStrategy: string;
  rationale: string;
}

export interface ModernizationSection {
  implemented: boolean;
  systemInventory: string[];
  dependencies: string[];
  applications: string[];
  integrations: string[];
  technicalDebt: string[];
  migrationCandidates: MigrationCandidate[];
  migrationStrategies: string[];
  recommendations: string[];
  notes: string[];
}
