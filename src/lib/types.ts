export type RawValue = string | number | boolean | null | undefined;
export type DataRow = Record<string, RawValue>;

export type Severity = "good" | "warning" | "critical";
export type RecommendationPriority = "high" | "medium" | "low";

export interface AuditConfig {
  protectedAttribute: string;
  outcomeAttribute: string;
  favorableOutcome: string;
  predictionAttribute?: string;
  favorablePrediction?: string;
  referenceGroup?: string;
}

export interface DatasetProfile {
  rowCount: number;
  columnCount: number;
  groupsAnalyzed: number;
  hasPredictions: boolean;
  generatedAt: string;
}

export interface GroupStat {
  group: string;
  total: number;
  populationShare: number;
  actualPositive: number;
  predictedPositive: number;
  actualPositiveRate: number;
  selectionRate: number;
  tpr: number | null;
  fpr: number | null;
  precision: number | null;
}

export interface MetricScore {
  key: string;
  label: string;
  description: string;
  target: string;
  value: number;
  displayValue: string;
  severity: Severity;
  riskContribution: number;
  weight: number;
}

export interface GroupComparison {
  group: string;
  selectionRateGap: number;
  representationGap: number;
  tprGap: number | null;
  fprGap: number | null;
  precisionGap: number | null;
  overallGap: number;
  severity: Severity;
}

export interface Recommendation {
  id: string;
  title: string;
  detail: string;
  suggestedFix: string;
  priority: RecommendationPriority;
}

export interface FeatureImportanceScore {
  feature: string;
  importance: number;
}

export interface AuditResult {
  profile: DatasetProfile;
  referenceGroup: string;
  overallRiskScore: number;
  metrics: MetricScore[];
  groupStats: GroupStat[];
  groupComparisons: GroupComparison[];
  recommendations: Recommendation[];
  biasFlags: string[];
  analysisNotes: string[];
  quickSummary: string;
  featureImportance: FeatureImportanceScore[];
}
