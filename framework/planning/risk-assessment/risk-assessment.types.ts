import type { RiskLevel } from "../../schemas/common/risk-level.js";

export interface RiskAssessment {
  id: string;
  capabilityId?: string;
  description: string;
  level: RiskLevel;
  mitigation?: string;
}
