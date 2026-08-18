/**
 * Split into two SolutionBlueprint-facing sections (security, governance)
 * even though they're implemented as a single capability module — mirrors
 * the field list in the Solution Blueprint spec (docs/architecture/ARCHITECTURE.md).
 */

export interface SecuritySection {
  implemented: boolean;
  authentication: string[];
  authorization: string[];
  secretsManagement: string[];
  encryption: string[];
  piiHandling: string[];
  dataClassification: string[];
  notes: string[];
}

export interface GovernanceSection {
  implemented: boolean;
  auditability: string[];
  responsibleAI: string[];
  humanOversight: string[];
  policies: string[];
  notes: string[];
}

export interface SecurityGovernanceOutput {
  security: SecuritySection;
  governance: GovernanceSection;
}
