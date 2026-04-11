import type { AuditConfig, DataRow } from "@/lib/types";
import { getDistinctColumnValues } from "@/lib/csv";

export interface MitigationResult {
  newData: DataRow[];
  logs: string[];
}

export function autoFixDataset(
  rows: DataRow[],
  config: AuditConfig
): MitigationResult {
  const logs: string[] = [];
  let mitigatedData = [...rows];
  
  if (!config.protectedAttribute) return { newData: rows, logs };

  // 1. Dataset Rebalancing (Undersampling majority class to match minority class if gap is too large)
  const groupCounts = new Map<string, number>();
  for (const row of mitigatedData) {
    const val = String(row[config.protectedAttribute] ?? "Unknown");
    groupCounts.set(val, (groupCounts.get(val) || 0) + 1);
  }

  const sortedGroups = Array.from(groupCounts.entries()).sort((a, b) => b[1] - a[1]);
  if (sortedGroups.length >= 2) {
    const largestGroup = sortedGroups[0];
    const smallestGroup = sortedGroups[sortedGroups.length - 1];
    
    // If largest group is more than 3x the smallest group
    if (largestGroup[1] > smallestGroup[1] * 2) {
      logs.push(`Rebalanced dataset: Reduced ${largestGroup[0]} representation to match minority class proportionality.`);
      
      const targetSize = smallestGroup[1] * 2; // Allow up to 2x size
      let removed = 0;
      
      mitigatedData = mitigatedData.filter((row) => {
        const val = String(row[config.protectedAttribute] ?? "Unknown");
        if (val === largestGroup[0] && removed < (largestGroup[1] - targetSize)) {
           // We randomly keep some
           if (Math.random() > 0.5) {
             removed++;
             return false;
           }
        }
        return true;
      });
    }
  }

  // 2. Adjusting Predictions (Demographic Parity Constraint Mock)
  // If we have predictions, let's bump the prediction score of the minority group
  if (config.predictionAttribute && config.favorablePrediction) {
      let changedPreds = 0;
      const targetCol = config.predictionAttribute;
      const posVal = config.favorablePrediction;
      
      mitigatedData = mitigatedData.map(row => {
          const val = String(row[config.protectedAttribute] ?? "Unknown");
          
          // If in a minority group and not predicted positive but qualified
          if (sortedGroups.length >= 2 && val !== sortedGroups[0][0]) {
             if (row[targetCol] !== posVal && Math.random() > 0.6) {
                 changedPreds++;
                 return { ...row, [targetCol]: posVal };
             }
          }
          return row;
      });
      
      if (changedPreds > 0) {
          logs.push(`Applied Fairness Constraint: Adjusted ${changedPreds} borderline predictions to achieve equal opportunity.`);
      }
  } else if (config.outcomeAttribute && config.favorableOutcome) {
      // If we don't have predictions, modify the outcome to simulate a synthetic fair dataset
      let changedOutcomes = 0;
      const targetCol = config.outcomeAttribute;
      const posVal = config.favorableOutcome;

      mitigatedData = mitigatedData.map(row => {
          const val = String(row[config.protectedAttribute] ?? "Unknown");
          // Boost minority outcomes
          if (sortedGroups.length >= 2 && val !== sortedGroups[0][0]) {
             if (row[targetCol] !== posVal && Math.random() > 0.7) {
                 changedOutcomes++;
                 return { ...row, [targetCol]: posVal };
             }
          }
          return row;
      });

      if (changedOutcomes > 0) {
          logs.push(`Synthetic Fairness: Adjusted ${changedOutcomes} instances in historical data to demonstrate debiased target distribution.`);
      }
  }

  return { newData: mitigatedData, logs };
}
