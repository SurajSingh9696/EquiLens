import type {
  AuditConfig,
  AuditResult,
  DataRow,
  GroupComparison,
  GroupStat,
  MetricScore,
  Recommendation,
  RecommendationPriority,
  Severity,
} from "@/lib/types";
import { clamp, formatPercent, formatRatio, normalizeToken } from "@/lib/utils";
import { calculateFeatureImportance } from "@/lib/xai";

interface MutableGroupStat {
  total: number;
  actualPositive: number;
  predictedPositive: number;
  truePositive: number;
  falsePositive: number;
  trueNegative: number;
  falseNegative: number;
}

interface LowerMetricInput {
  key: string;
  label: string;
  description: string;
  target: string;
  value: number;
  goodUpper: number;
  warningUpper: number;
  weight: number;
  displayValue?: string;
}

interface HigherMetricInput {
  key: string;
  label: string;
  description: string;
  target: string;
  value: number;
  goodLower: number;
  warningLower: number;
  weight: number;
  displayValue?: string;
}

interface BandMetricInput {
  key: string;
  label: string;
  description: string;
  target: string;
  value: number;
  goodMin: number;
  goodMax: number;
  warningMin: number;
  warningMax: number;
  weight: number;
  displayValue?: string;
}

function safeDivide(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 0;
  }

  return numerator / denominator;
}

function toGroupValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "Unknown";
  }

  const cleaned = String(value).trim();
  return cleaned.length > 0 ? cleaned : "Unknown";
}

function isPositiveValue(value: unknown, positiveLabel: string): boolean {
  return normalizeToken(value) === normalizeToken(positiveLabel);
}

function severityForLower(value: number, goodUpper: number, warningUpper: number): Severity {
  if (value <= goodUpper) {
    return "good";
  }

  if (value <= warningUpper) {
    return "warning";
  }

  return "critical";
}

function severityForHigher(value: number, goodLower: number, warningLower: number): Severity {
  if (value >= goodLower) {
    return "good";
  }

  if (value >= warningLower) {
    return "warning";
  }

  return "critical";
}

function severityForBand(
  value: number,
  goodMin: number,
  goodMax: number,
  warningMin: number,
  warningMax: number
): Severity {
  if (value >= goodMin && value <= goodMax) {
    return "good";
  }

  if (value >= warningMin && value <= warningMax) {
    return "warning";
  }

  return "critical";
}

function riskForLower(value: number, goodUpper: number, warningUpper: number): number {
  if (value <= goodUpper) {
    return 0;
  }

  const scale = warningUpper - goodUpper;

  if (scale <= 0) {
    return 1;
  }

  return clamp((value - goodUpper) / scale, 0, 1);
}

function riskForHigher(value: number, goodLower: number, warningLower: number): number {
  if (value >= goodLower) {
    return 0;
  }

  const scale = goodLower - warningLower;

  if (scale <= 0) {
    return 1;
  }

  return clamp((goodLower - value) / scale, 0, 1);
}

function riskForBand(value: number, warningMin: number, warningMax: number): number {
  if (value >= warningMin && value <= warningMax) {
    return 0;
  }

  if (value < warningMin) {
    return clamp((warningMin - value) / warningMin, 0, 1);
  }

  const distance = value - warningMax;
  const denominator = 2 - warningMax;
  return clamp(distance / denominator, 0, 1);
}

function maxMinDiff(values: number[]): number {
  if (values.length <= 1) {
    return 0;
  }

  return Math.max(...values) - Math.min(...values);
}

function createLowerMetric(input: LowerMetricInput): MetricScore {
  return {
    key: input.key,
    label: input.label,
    description: input.description,
    target: input.target,
    value: input.value,
    displayValue: input.displayValue ?? formatPercent(input.value),
    severity: severityForLower(input.value, input.goodUpper, input.warningUpper),
    riskContribution: riskForLower(input.value, input.goodUpper, input.warningUpper),
    weight: input.weight,
  };
}

function createHigherMetric(input: HigherMetricInput): MetricScore {
  return {
    key: input.key,
    label: input.label,
    description: input.description,
    target: input.target,
    value: input.value,
    displayValue: input.displayValue ?? formatRatio(input.value),
    severity: severityForHigher(input.value, input.goodLower, input.warningLower),
    riskContribution: riskForHigher(input.value, input.goodLower, input.warningLower),
    weight: input.weight,
  };
}

function createBandMetric(input: BandMetricInput): MetricScore {
  return {
    key: input.key,
    label: input.label,
    description: input.description,
    target: input.target,
    value: input.value,
    displayValue: input.displayValue ?? formatRatio(input.value),
    severity: severityForBand(
      input.value,
      input.goodMin,
      input.goodMax,
      input.warningMin,
      input.warningMax
    ),
    riskContribution: riskForBand(input.value, input.warningMin, input.warningMax),
    weight: input.weight,
  };
}

function chooseReferenceGroup(
  groupStats: GroupStat[],
  preferredReference?: string
): string {
  if (preferredReference) {
    const match = groupStats.find(
      (group) => normalizeToken(group.group) === normalizeToken(preferredReference)
    );

    if (match) {
      return match.group;
    }
  }

  return groupStats[0]?.group ?? "Unknown";
}

function buildMetrics(groupStats: GroupStat[], hasPredictions: boolean): MetricScore[] {
  const selectionRates = groupStats.map((group) => group.selectionRate);
  const tprRates = groupStats
    .map((group) => group.tpr)
    .filter((value): value is number => value !== null);
  const fprRates = groupStats
    .map((group) => group.fpr)
    .filter((value): value is number => value !== null);
  const precisionRates = groupStats
    .map((group) => group.precision)
    .filter((value): value is number => value !== null);

  const minSelectionRate = Math.min(...selectionRates);
  const maxSelectionRate = Math.max(...selectionRates);
  const demographicParityDiff = maxSelectionRate - minSelectionRate;
  const disparateImpact = maxSelectionRate === 0 ? 1 : minSelectionRate / maxSelectionRate;

  const counts = groupStats.map((group) => group.total);
  const representationRatio = Math.min(...counts) / Math.max(...counts);

  const metrics: MetricScore[] = [
    createLowerMetric({
      key: "demographic_parity_diff",
      label: "Demographic Parity Difference",
      description: "Gap between highest and lowest selection rates across groups.",
      target: "<= 10%",
      value: demographicParityDiff,
      goodUpper: 0.1,
      warningUpper: 0.2,
      weight: 0.24,
    }),
    createBandMetric({
      key: "disparate_impact_ratio",
      label: "Disparate Impact Ratio",
      description: "The 80% rule ratio (min selection rate divided by max selection rate).",
      target: "0.80 - 1.25",
      value: disparateImpact,
      goodMin: 0.8,
      goodMax: 1.25,
      warningMin: 0.65,
      warningMax: 1.35,
      weight: 0.18,
      displayValue: formatRatio(disparateImpact),
    }),
    createHigherMetric({
      key: "representation_balance",
      label: "Representation Balance",
      description: "Smallest-to-largest group size ratio in the dataset.",
      target: ">= 0.75",
      value: representationRatio,
      goodLower: 0.75,
      warningLower: 0.55,
      weight: 0.14,
      displayValue: formatRatio(representationRatio),
    }),
  ];

  if (hasPredictions && tprRates.length >= 2) {
    metrics.push(
      createLowerMetric({
        key: "equal_opportunity_diff",
        label: "Equal Opportunity Difference",
        description: "Spread of true-positive rates (TPR) across groups.",
        target: "<= 10%",
        value: maxMinDiff(tprRates),
        goodUpper: 0.1,
        warningUpper: 0.2,
        weight: 0.18,
      })
    );
  }

  if (hasPredictions && fprRates.length >= 2) {
    metrics.push(
      createLowerMetric({
        key: "false_positive_rate_diff",
        label: "False Positive Rate Difference",
        description: "Spread of false-positive rates (FPR) across groups.",
        target: "<= 10%",
        value: maxMinDiff(fprRates),
        goodUpper: 0.1,
        warningUpper: 0.2,
        weight: 0.14,
      })
    );
  }

  if (hasPredictions && precisionRates.length >= 2) {
    metrics.push(
      createLowerMetric({
        key: "predictive_parity_diff",
        label: "Predictive Parity Difference",
        description: "Spread of precision across groups.",
        target: "<= 10%",
        value: maxMinDiff(precisionRates),
        goodUpper: 0.1,
        warningUpper: 0.2,
        weight: 0.12,
      })
    );
  }

  return metrics;
}

function buildGroupComparisons(
  groupStats: GroupStat[],
  referenceGroup: string
): GroupComparison[] {
  const reference =
    groupStats.find(
      (group) => normalizeToken(group.group) === normalizeToken(referenceGroup)
    ) ?? groupStats[0];

  return groupStats
    .map((group) => {
      const selectionRateGap = Math.abs(group.selectionRate - reference.selectionRate);
      const representationGap = Math.abs(group.populationShare - reference.populationShare);
      const tprGap =
        group.tpr === null || reference.tpr === null
          ? null
          : Math.abs(group.tpr - reference.tpr);
      const fprGap =
        group.fpr === null || reference.fpr === null
          ? null
          : Math.abs(group.fpr - reference.fpr);
      const precisionGap =
        group.precision === null || reference.precision === null
          ? null
          : Math.abs(group.precision - reference.precision);

      const gaps: number[] = [selectionRateGap, representationGap];

      if (tprGap !== null) {
        gaps.push(tprGap);
      }

      if (fprGap !== null) {
        gaps.push(fprGap);
      }

      if (precisionGap !== null) {
        gaps.push(precisionGap);
      }

      const overallGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;

      return {
        group: group.group,
        selectionRateGap,
        representationGap,
        tprGap,
        fprGap,
        precisionGap,
        overallGap,
        severity: severityForLower(overallGap, 0.08, 0.16),
      };
    })
    .sort((left, right) => right.overallGap - left.overallGap);
}

function toPriorityScore(priority: RecommendationPriority): number {
  if (priority === "high") {
    return 3;
  }

  if (priority === "medium") {
    return 2;
  }

  return 1;
}

function pushRecommendation(
  recommendations: Recommendation[],
  recommendation: Omit<Recommendation, "id">
): void {
  recommendations.push({
    id: `rec_${recommendations.length + 1}`,
    ...recommendation,
  });
}

function buildRecommendations(
  metrics: MetricScore[],
  groupStats: GroupStat[],
  rowCount: number,
  hasPredictions: boolean
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const metricByKey = new Map(metrics.map((metric) => [metric.key, metric]));

  const demographicParity = metricByKey.get("demographic_parity_diff");
  if (demographicParity && demographicParity.severity !== "good") {
    pushRecommendation(recommendations, {
      title: "Rebalance decision thresholds",
      detail:
        "Selection rates are diverging heavily between groups. Threshold tuning or post-processing constraints can reduce this drift.",
      suggestedFix:
        "Run threshold search with fairness constraints and compare quality trade-offs before deployment.",
      priority: demographicParity.severity === "critical" ? "high" : "medium",
    });
  }

  const equalOpportunity = metricByKey.get("equal_opportunity_diff");
  if (equalOpportunity && equalOpportunity.severity !== "good") {
    pushRecommendation(recommendations, {
      title: "Audit false negatives by group",
      detail:
        "Uneven true-positive rates indicate some groups are missing opportunities despite being qualified.",
      suggestedFix:
        "Inspect group-specific confusion matrices and rebalance training examples for under-served groups.",
      priority: equalOpportunity.severity === "critical" ? "high" : "medium",
    });
  }

  const falsePositiveRate = metricByKey.get("false_positive_rate_diff");
  if (falsePositiveRate && falsePositiveRate.severity !== "good") {
    pushRecommendation(recommendations, {
      title: "Reduce harmful false positives",
      detail:
        "A high FPR gap means one group receives incorrect positive outcomes much more often than others.",
      suggestedFix:
        "Tune model calibration per group and inspect noisy labels in high-error segments.",
      priority: falsePositiveRate.severity === "critical" ? "high" : "medium",
    });
  }

  const representation = metricByKey.get("representation_balance");
  if (representation && representation.severity !== "good") {
    pushRecommendation(recommendations, {
      title: "Improve dataset representativeness",
      detail:
        "Protected-group sample sizes are imbalanced, making model behavior less reliable for minority populations.",
      suggestedFix:
        "Collect additional records for smaller groups and apply stratified sampling during training.",
      priority: representation.severity === "critical" ? "high" : "medium",
    });
  }

  const smallestGroup = [...groupStats].sort((left, right) => left.total - right.total)[0];
  if (smallestGroup && smallestGroup.total < Math.max(30, rowCount * 0.08)) {
    pushRecommendation(recommendations, {
      title: "Increase minimum group sample size",
      detail:
        `${smallestGroup.group} has very few records, which may inflate fairness uncertainty.`,
      suggestedFix:
        "Set a minimum per-group sample target before approving model deployment.",
      priority: "high",
    });
  }

  if (!hasPredictions) {
    pushRecommendation(recommendations, {
      title: "Add model prediction logs",
      detail:
        "Prediction labels were not provided, so error-rate fairness metrics could not be computed.",
      suggestedFix:
        "Include model output columns to unlock equal opportunity and false-positive analysis.",
      priority: "medium",
    });
  }

  if (recommendations.length === 0) {
    pushRecommendation(recommendations, {
      title: "Maintain continuous fairness monitoring",
      detail: "Current signals look stable, but fairness can drift over time as data changes.",
      suggestedFix:
        "Schedule automated weekly audits and set alert thresholds for parity and error gaps.",
      priority: "low",
    });
  }

  return recommendations.sort(
    (left, right) => toPriorityScore(right.priority) - toPriorityScore(left.priority)
  );
}

function buildAnalysisNotes(
  metrics: MetricScore[],
  rowCount: number,
  hasPredictions: boolean,
  groupCount: number
): string[] {
  const criticalCount = metrics.filter((metric) => metric.severity === "critical").length;
  const warningCount = metrics.filter((metric) => metric.severity === "warning").length;

  const notes: string[] = [
    `${rowCount} records analyzed across ${groupCount} protected groups.`,
    `${criticalCount} critical and ${warningCount} warning fairness indicators detected.`,
  ];

  if (rowCount < 120) {
    notes.push(
      "Dataset is relatively small. Consider collecting more samples before making policy decisions."
    );
  }

  if (!hasPredictions) {
    notes.push("Only outcome-level parity checks are available without model prediction labels.");
  }

  return notes;
}

export function runFairnessAudit(rows: DataRow[], config: AuditConfig): AuditResult {
  const sanitizedRows = rows.filter((row) => Object.keys(row).length > 0);

  if (sanitizedRows.length === 0) {
    throw new Error("No rows are available for auditing.");
  }

  if (!config.protectedAttribute || !config.outcomeAttribute || !config.favorableOutcome) {
    throw new Error("Protected attribute, outcome attribute, and favorable outcome are required.");
  }

  const availableColumns = new Set<string>();
  for (const row of sanitizedRows) {
    for (const column of Object.keys(row)) {
      availableColumns.add(column);
    }
  }

  if (!availableColumns.has(config.protectedAttribute)) {
    throw new Error(`Column '${config.protectedAttribute}' is not present in the dataset.`);
  }

  if (!availableColumns.has(config.outcomeAttribute)) {
    throw new Error(`Column '${config.outcomeAttribute}' is not present in the dataset.`);
  }

  if (config.predictionAttribute && !availableColumns.has(config.predictionAttribute)) {
    throw new Error(`Column '${config.predictionAttribute}' is not present in the dataset.`);
  }

  if (config.predictionAttribute && !config.favorablePrediction) {
    throw new Error("Favorable prediction value is required when prediction column is provided.");
  }

  const hasPredictions = Boolean(config.predictionAttribute && config.favorablePrediction);

  const groups = new Map<string, MutableGroupStat>();

  for (const row of sanitizedRows) {
    const groupValue = toGroupValue(row[config.protectedAttribute]);
    const actualPositive = isPositiveValue(
      row[config.outcomeAttribute],
      config.favorableOutcome
    );
    const predictedPositive = hasPredictions
      ? isPositiveValue(row[config.predictionAttribute!], config.favorablePrediction!)
      : actualPositive;

    const current = groups.get(groupValue) ?? {
      total: 0,
      actualPositive: 0,
      predictedPositive: 0,
      truePositive: 0,
      falsePositive: 0,
      trueNegative: 0,
      falseNegative: 0,
    };

    current.total += 1;

    if (actualPositive) {
      current.actualPositive += 1;
    }

    if (predictedPositive) {
      current.predictedPositive += 1;
    }

    if (hasPredictions) {
      if (predictedPositive && actualPositive) {
        current.truePositive += 1;
      } else if (predictedPositive && !actualPositive) {
        current.falsePositive += 1;
      } else if (!predictedPositive && !actualPositive) {
        current.trueNegative += 1;
      } else {
        current.falseNegative += 1;
      }
    }

    groups.set(groupValue, current);
  }

  if (groups.size < 2) {
    throw new Error(
      "At least two groups are required in the protected attribute column for fairness analysis."
    );
  }

  const rowCount = sanitizedRows.length;

  const groupStats = Array.from(groups.entries())
    .map(([group, stat]): GroupStat => {
      const tprDenominator = stat.truePositive + stat.falseNegative;
      const fprDenominator = stat.falsePositive + stat.trueNegative;
      const precisionDenominator = stat.truePositive + stat.falsePositive;

      return {
        group,
        total: stat.total,
        populationShare: safeDivide(stat.total, rowCount),
        actualPositive: stat.actualPositive,
        predictedPositive: stat.predictedPositive,
        actualPositiveRate: safeDivide(stat.actualPositive, stat.total),
        selectionRate: safeDivide(stat.predictedPositive, stat.total),
        tpr: hasPredictions ? safeDivide(stat.truePositive, tprDenominator) : null,
        fpr: hasPredictions ? safeDivide(stat.falsePositive, fprDenominator) : null,
        precision: hasPredictions
          ? safeDivide(stat.truePositive, precisionDenominator)
          : null,
      };
    })
    .sort((left, right) => right.total - left.total);

  const metrics = buildMetrics(groupStats, hasPredictions);
  const totalWeight = metrics.reduce((sum, metric) => sum + metric.weight, 0);
  const weightedRisk = metrics.reduce(
    (sum, metric) => sum + metric.riskContribution * metric.weight,
    0
  );
  const overallRiskScore = Math.round(safeDivide(weightedRisk, totalWeight) * 100);

  const referenceGroup = chooseReferenceGroup(groupStats, config.referenceGroup);
  const groupComparisons = buildGroupComparisons(groupStats, referenceGroup);
  const recommendations = buildRecommendations(metrics, groupStats, rowCount, hasPredictions);
  const biasFlags = metrics
    .filter((metric) => metric.severity !== "good")
    .map((metric) => `${metric.label}: ${metric.displayValue} (${metric.severity})`);

  const analysisNotes = buildAnalysisNotes(
    metrics,
    rowCount,
    hasPredictions,
    groupStats.length
  );

  const criticalCount = metrics.filter((metric) => metric.severity === "critical").length;
  const warningCount = metrics.filter((metric) => metric.severity === "warning").length;

  const quickSummary =
    overallRiskScore >= 70
      ? `High fairness risk detected (${overallRiskScore}/100) with ${criticalCount} critical indicators.`
      : overallRiskScore >= 40
      ? `Moderate fairness risk detected (${overallRiskScore}/100) with ${warningCount} warning indicators.`
      : `Low fairness risk detected (${overallRiskScore}/100). Continue monitoring for drift.`;

  return {
    profile: {
      rowCount,
      columnCount: availableColumns.size,
      groupsAnalyzed: groupStats.length,
      hasPredictions,
      generatedAt: new Date().toISOString(),
    },
    referenceGroup,
    overallRiskScore,
    metrics,
    groupStats,
    groupComparisons,
    recommendations,
    biasFlags,
    analysisNotes,
    quickSummary,
    featureImportance: calculateFeatureImportance(sanitizedRows, config),
  };
}
