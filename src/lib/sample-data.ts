import type { DataRow } from "@/lib/types";

export interface SampleDataset {
  rows: DataRow[];
  csv: string;
  fileName: string;
}

interface WeightedChoice {
  label: string;
  weight: number;
}

interface DemographicChoice extends WeightedChoice {
  bias: number;
}

interface RegionChoice extends WeightedChoice {
  boost: number;
}

const DEMOGRAPHICS: DemographicChoice[] = [
  { label: "women", weight: 0.44, bias: -0.09 },
  { label: "men", weight: 0.45, bias: 0.08 },
  { label: "non_binary", weight: 0.11, bias: -0.14 },
];

const REGIONS: RegionChoice[] = [
  { label: "north", weight: 0.32, boost: 0.12 },
  { label: "south", weight: 0.23, boost: -0.08 },
  { label: "east", weight: 0.27, boost: 0.04 },
  { label: "west", weight: 0.18, boost: -0.05 },
];

const INCOME_TIERS: WeightedChoice[] = [
  { label: "low", weight: 0.3 },
  { label: "middle", weight: 0.5 },
  { label: "high", weight: 0.2 },
];

const AGE_BANDS: WeightedChoice[] = [
  { label: "18-24", weight: 0.17 },
  { label: "25-34", weight: 0.38 },
  { label: "35-44", weight: 0.28 },
  { label: "45-54", weight: 0.12 },
  { label: "55+", weight: 0.05 },
];

function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickByWeight<T extends WeightedChoice>(
  values: T[],
  random: () => number
): T {
  const total = values.reduce((sum, value) => sum + value.weight, 0);
  let threshold = random() * total;

  for (const item of values) {
    threshold -= item.weight;

    if (threshold <= 0) {
      return item;
    }
  }

  return values[values.length - 1];
}

function logistic(value: number): number {
  return 1 / (1 + Math.exp(-value));
}

function toDecision(value: boolean): "approved" | "rejected" {
  return value ? "approved" : "rejected";
}

function escapeCsvCell(value: unknown): string {
  const raw = value === null || value === undefined ? "" : String(value);
  const escaped = raw.replaceAll('"', '""');

  if (/[,"\n]/.test(escaped)) {
    return `"${escaped}"`;
  }

  return escaped;
}

function toCsv(rows: DataRow[]): string {
  if (rows.length === 0) {
    return "";
  }

  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];

  for (const row of rows) {
    const values = headers.map((header) => escapeCsvCell(row[header]));
    lines.push(values.join(","));
  }

  return lines.join("\n");
}

export function buildSampleDataset(size = 240): SampleDataset {
  const random = mulberry32(2026);
  const rows: DataRow[] = [];

  for (let index = 0; index < size; index += 1) {
    const demographic = pickByWeight(DEMOGRAPHICS, random);
    const region = pickByWeight(REGIONS, random);
    const incomeTier = pickByWeight(INCOME_TIERS, random);
    const ageBand = pickByWeight(AGE_BANDS, random);

    const experienceYears = Math.max(0, Math.floor(random() * 15 + random() * 2));
    const creditScore = Math.round(540 + random() * 260 + region.boost * 18);
    const interviewScore = Math.round(42 + random() * 50 + experienceYears * 2.2);

    const incomeBoost =
      incomeTier.label === "high" ? 0.08 : incomeTier.label === "middle" ? 0.03 : -0.07;
    const ageBoost = ageBand.label === "25-34" || ageBand.label === "35-44" ? 0.05 : -0.02;

    const latentScore = logistic(
      (experienceYears - 6) * 0.16 +
        (creditScore - 650) * 0.012 +
        (interviewScore - 72) * 0.038 +
        region.boost * 0.6 +
        incomeBoost +
        ageBoost +
        (random() - 0.5) * 0.7
    );

    const actualOutcome = latentScore > 0.52;

    const modelScore = latentScore + demographic.bias + (random() - 0.5) * 0.2;
    const modelDecision = modelScore > 0.53;

    rows.push({
      applicant_id: `APP-${1000 + index}`,
      gender: demographic.label,
      region: region.label,
      age_band: ageBand.label,
      income_tier: incomeTier.label,
      experience_years: experienceYears,
      credit_score: creditScore,
      interview_score: interviewScore,
      actual_outcome: toDecision(actualOutcome),
      model_decision: toDecision(modelDecision),
    });
  }

  return {
    rows,
    csv: toCsv(rows),
    fileName: "equilens-sample-bias-dataset.csv",
  };
}
