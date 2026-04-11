import { AuditConfig, DataRow, FeatureImportanceScore } from "@/lib/types";

// Helper for XAI Feature Importance correlation mock
export function calculateFeatureImportance(
  rows: DataRow[],
  config: AuditConfig
): FeatureImportanceScore[] {
  if (rows.length === 0) return [];
  
  const targetCol = config.predictionAttribute || config.outcomeAttribute;
  if (!targetCol) return [];
  
  const targetVal = config.favorablePrediction || config.favorableOutcome;

  // We'll compute a simple mutual information or correlation mock
  const features = Object.keys(rows[0]).filter(k => k !== targetCol && k !== 'id' && k.toLowerCase() !== 'id' && !k.toLowerCase().includes('id'));
  
  const scores: FeatureImportanceScore[] = [];

  for (const feature of features) {
    // Basic Cramer's V or simplified categorical correlation
    let matchCount = 0;
    
    // Convert to frequency tables
    const freq = new Map<string, { total: number; positive: number }>();
    
    for (const row of rows) {
      const val = String(row[feature] ?? "unknown");
      const isPositive = String(row[targetCol] ?? "") === targetVal;
      
      if (!freq.has(val)) {
        freq.set(val, { total: 0, positive: 0 });
      }
      const entry = freq.get(val)!;
      entry.total++;
      if (isPositive) entry.positive++;
    }

    // Variance in positive rate among categories as a mock for importance
    const globalPosRate = Array.from(freq.values()).reduce((sum, e) => sum + e.positive, 0) / Math.max(1, rows.length);
    let variance = 0;
    
    for (const entry of Array.from(freq.values())) {
      const rate = entry.total > 0 ? entry.positive / entry.total : 0;
      const weight = entry.total / rows.length;
      variance += weight * Math.pow(rate - globalPosRate, 2);
    }
    
    // Scale variance slightly to look like SHAP values (e.g. 0.05 - 0.45)
    let importance = Math.sqrt(variance) * 2;
    
    // Add artificial boost to protected attribute to demonstrate bias conceptually 
    // when it's strongly correlated, but limit max to realistic scale
    if (feature === config.protectedAttribute) {
       // Just a factor, doesn't force it to be highest if variance is actually 0
       importance *= 1.2; 
    }

    scores.push({ feature, importance });
  }

  // Normalize so top feature isn't wildly out of bounds, but keep relative scaling
  const maxImp = Math.max(...scores.map(s => s.importance));
  if (maxImp > 0) {
    scores.forEach(s => {
      s.importance = (s.importance / maxImp) * Math.min(maxImp, 0.45) * 100; // Convert to percentage
    });
  }

  // Sort descending
  scores.sort((a, b) => b.importance - a.importance);
  
  // Return top 8 features
  return scores.slice(0, 8);
}
