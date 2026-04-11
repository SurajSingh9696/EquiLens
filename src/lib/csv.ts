import Papa from "papaparse";
import type { DataRow, RawValue } from "@/lib/types";
import { normalizeToken } from "@/lib/utils";

export interface ParsedCsv {
  headers: string[];
  rows: DataRow[];
}

export interface ColumnSuggestions {
  protectedAttribute?: string;
  outcomeAttribute?: string;
  predictionAttribute?: string;
}

const POSITIVE_HINTS = new Set([
  "1",
  "true",
  "yes",
  "approved",
  "approve",
  "accepted",
  "accept",
  "selected",
  "hire",
  "hired",
  "eligible",
  "positive",
  "pass",
  "safe",
]);

const PROTECTED_HINTS = [
  /gender/i,
  /sex/i,
  /race/i,
  /ethnicity/i,
  /age/i,
  /region/i,
  /group/i,
  /community/i,
];

const OUTCOME_HINTS = [
  /outcome/i,
  /label/i,
  /actual/i,
  /target/i,
  /approved/i,
  /qualified/i,
  /decision/i,
  /status/i,
];

const PREDICTION_HINTS = [
  /prediction/i,
  /predicted/i,
  /model/i,
  /^pred$/i,
  /decision/i,
  /score/i,
  /ai_/i,
];

function normalizeCell(value: unknown): RawValue {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "boolean") {
    return value;
  }

  return String(value);
}

function isRowEmpty(row: DataRow, headers: string[]): boolean {
  return headers.every((header) => {
    const value = row[header];

    if (value === null || value === undefined) {
      return true;
    }

    return String(value).trim() === "";
  });
}

function findHeader(headers: string[], hints: RegExp[]): string | undefined {
  return headers.find((header) => hints.some((pattern) => pattern.test(header)));
}

export function suggestColumns(headers: string[]): ColumnSuggestions {
  const protectedAttribute = findHeader(headers, PROTECTED_HINTS);
  const outcomeAttribute = findHeader(headers, OUTCOME_HINTS);

  const predictionAttribute = headers.find((header) => {
    if (header === outcomeAttribute) {
      return false;
    }

    return PREDICTION_HINTS.some((pattern) => pattern.test(header));
  });

  return {
    protectedAttribute,
    outcomeAttribute,
    predictionAttribute,
  };
}

export function parseCsvContent(csvContent: string): ParsedCsv {
  const parsed = Papa.parse<Record<string, unknown>>(csvContent, {
    header: true,
    skipEmptyLines: "greedy",
    dynamicTyping: true,
    transformHeader: (header) => header.trim(),
  });

  if (parsed.errors.length > 0) {
    throw new Error(`CSV parsing failed: ${parsed.errors[0].message}`);
  }

  const headers = (parsed.meta.fields ?? [])
    .map((header) => header.trim())
    .filter((header) => header.length > 0);

  if (headers.length === 0) {
    throw new Error(
      "CSV headers were not detected. Ensure the first row contains column names."
    );
  }

  const rows = parsed.data
    .map((row) => {
      const normalized: DataRow = {};

      for (const header of headers) {
        normalized[header] = normalizeCell(row[header]);
      }

      return normalized;
    })
    .filter((row) => !isRowEmpty(row, headers));

  if (rows.length === 0) {
    throw new Error("No usable rows were found in the CSV file.");
  }

  return {
    headers,
    rows,
  };
}

export async function parseDatasetFile(file: File): Promise<ParsedCsv> {
  const name = file.name.toLowerCase();

  if (name.endsWith('.json')) {
    const textContent = await file.text();
    const data = JSON.parse(textContent);
    let rows: DataRow[] = [];
    
    if (Array.isArray(data)) {
      rows = data;
    } else if (data && typeof data === 'object' && Array.isArray((data as any).rows)) {
      rows = (data as any).rows;
    } else {
      throw new Error("JSON file must contain an array of objects.");
    }
    
    if (rows.length === 0) throw new Error("JSON file is empty.");
    
    // Normalize rows
    const headers = Object.keys(rows[0]);
    const normalizedRows = rows.map((row) => {
      const normalized: DataRow = {};
      for (const header of headers) {
        normalized[header] = normalizeCell(row[header]);
      }
      return normalized;
    }).filter(row => !isRowEmpty(row, headers));

    if (normalizedRows.length === 0) {
      throw new Error("No usable rows were found in the JSON file.");
    }

    return { headers, rows: normalizedRows };
  }

  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    throw new Error(
      "Excel uploads are disabled due to an unpatched dependency vulnerability. Convert the file to CSV or JSON and upload again."
    );
  }

  const textContent = await file.text();
  return parseCsvContent(textContent);
}

export function getDistinctColumnValues(
  rows: DataRow[],
  column: string,
  maxValues = 50
): string[] {
  const values: string[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const raw = row[column];

    if (raw === null || raw === undefined) {
      continue;
    }

    const value = String(raw).trim();

    if (!value || seen.has(value)) {
      continue;
    }

    seen.add(value);
    values.push(value);

    if (values.length >= maxValues) {
      break;
    }
  }

  return values;
}

export function inferPositiveLabel(
  rows: DataRow[],
  column: string,
  fallback = "approved"
): string {
  const frequencies = new Map<string, { count: number; raw: string }>();

  for (const row of rows) {
    const raw = row[column];

    if (raw === null || raw === undefined) {
      continue;
    }

    const cleaned = String(raw).trim();

    if (!cleaned) {
      continue;
    }

    const key = normalizeToken(cleaned);
    const current = frequencies.get(key);

    if (!current) {
      frequencies.set(key, { count: 1, raw: cleaned });
    } else {
      current.count += 1;
    }
  }

  if (frequencies.size === 0) {
    return fallback;
  }

  const ranked = Array.from(frequencies.entries()).sort(
    (left, right) => right[1].count - left[1].count
  );

  const hinted = ranked
    .filter(([token]) => POSITIVE_HINTS.has(token))
    .sort((left, right) => right[1].count - left[1].count);

  if (hinted.length > 0) {
    return hinted[0][1].raw;
  }

  if (frequencies.has("1")) {
    return frequencies.get("1")!.raw;
  }

  return ranked[0][1].raw;
}
