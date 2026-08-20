/**
 * Shared risk-level primitive used by governance, risk-assessment, and any
 * capability output that needs to flag human review.
 */

export type RiskLevel = "low" | "medium" | "high" | "critical";

export const RISK_LEVELS: RiskLevel[] = ["low", "medium", "high", "critical"];
