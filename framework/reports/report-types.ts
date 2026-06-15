/**
 * Shared TypeScript types for QA reports, matching qa-report.schema.json.
 */

export interface ReportFinding {
  rule: string;
  message: string;
  element?: string;
}

export interface ReportCheck {
  rule: string;
  status: "pass" | "warn" | "fail" | "skip";
  detail?: string;
}

export interface AccessibilitySection {
  passed: boolean;
  score?: number;
  warnings: ReportFinding[];
  errors: ReportFinding[];
  checks: ReportCheck[];
}

export interface SEOSection {
  passed: boolean;
  score?: number;
  warnings: ReportFinding[];
  errors: ReportFinding[];
}

export interface ReportSummary {
  overallPassed: boolean;
  totalErrors: number;
  totalWarnings: number;
  recommendation?: string;
}

export interface QAReport {
  generatedAt: string;
  inputBlueprint: string;
  accessibility: AccessibilitySection;
  seo: SEOSection;
  summary: ReportSummary;
}
