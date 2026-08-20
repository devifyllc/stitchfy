export type GapImportance = "low" | "medium" | "high";

export interface InformationGap {
  id: string;
  topic: string;
  question: string;
  importance: GapImportance;
  blocking: boolean;
  relatedCapabilityIds: string[];
}
