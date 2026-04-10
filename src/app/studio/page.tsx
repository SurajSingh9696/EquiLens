"use client";

import Link from "next/link";
import { ChangeEvent, useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Download,
  FileSpreadsheet,
  FlaskConical,
  Play,
  ShieldAlert,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import {
  getDistinctColumnValues,
  inferPositiveLabel,
  parseCsvFile,
  suggestColumns,
  type ParsedCsv,
} from "@/lib/csv";
import { runFairnessAudit } from "@/lib/fairness";
import { buildSampleDataset } from "@/lib/sample-data";
import type { AuditConfig, AuditResult, DataRow } from "@/lib/types";
import { formatPercent } from "@/lib/utils";
import { FairnessRadar } from "@/components/fairness-radar";
import { GapHeatmap } from "@/components/gap-heatmap";
import { GroupRateChart } from "@/components/group-rate-chart";
import { MetricCard } from "@/components/metric-card";
import { RiskGauge } from "@/components/risk-gauge";

const PREVIEW_ROWS_LIMIT = 8;
const PREVIEW_COLUMNS_LIMIT = 8;

const CONTROL_CLASSNAME =
  "mt-2 w-full rounded-2xl border border-black/10 bg-white/80 px-3 py-2.5 text-sm font-medium text-[color:var(--color-ink)] outline-none transition focus:border-[color:var(--color-accent)] focus:ring-2 focus:ring-[color:var(--color-accent-soft)]";

const EMPTY_CONFIG: AuditConfig = {
  protectedAttribute: "",
  outcomeAttribute: "",
  favorableOutcome: "",
  predictionAttribute: undefined,
  favorablePrediction: undefined,
  referenceGroup: undefined,
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "An unexpected error occurred while processing the dataset.";
}

function priorityClass(priority: "high" | "medium" | "low"): string {
  if (priority === "high") {
    return "bg-rose-100 text-rose-900";
  }

  if (priority === "medium") {
    return "bg-amber-100 text-amber-900";
  }

  return "bg-emerald-100 text-emerald-900";
}

function buildMarkdownReport(
  datasetName: string,
  config: AuditConfig,
  report: AuditResult
): string {
  const metricRows = report.metrics
    .map(
      (metric) =>
        `| ${metric.label} | ${metric.displayValue} | ${metric.target} | ${metric.severity.toUpperCase()} |`
    )
    .join("\n");

  const recommendationRows = report.recommendations
    .map(
      (recommendation, index) =>
        `${index + 1}. **${recommendation.title}** (${recommendation.priority.toUpperCase()})\n   - ${recommendation.detail}\n   - Suggested fix: ${recommendation.suggestedFix}`
    )
    .join("\n");

  const groupRows = report.groupStats
    .map(
      (group) =>
        `| ${group.group} | ${group.total} | ${formatPercent(group.selectionRate)} | ${formatPercent(
          group.actualPositiveRate
        )} | ${group.tpr === null ? "N/A" : formatPercent(group.tpr)} | ${
          group.fpr === null ? "N/A" : formatPercent(group.fpr)
        } |`
    )
    .join("\n");

  return `# EquiLens Fairness Audit Report

## Dataset
- Name: ${datasetName}
- Rows: ${report.profile.rowCount}
- Columns: ${report.profile.columnCount}
- Generated at: ${new Date(report.profile.generatedAt).toLocaleString()}

## Configuration
- Protected attribute: ${config.protectedAttribute}
- Outcome attribute: ${config.outcomeAttribute}
- Favorable outcome: ${config.favorableOutcome}
- Prediction attribute: ${config.predictionAttribute ?? "Not provided"}
- Favorable prediction: ${config.favorablePrediction ?? "Not provided"}

## Executive Summary
- Overall fairness risk score: **${report.overallRiskScore}/100**
- Reference group: **${report.referenceGroup}**
- Summary: ${report.quickSummary}

## Metrics
| Metric | Value | Target | Severity |
|---|---:|---|---|
${metricRows}

## Group Performance
| Group | Count | Selection Rate | Actual Outcome Rate | TPR | FPR |
|---|---:|---:|---:|---:|---:|
${groupRows}

## Recommendations
${recommendationRows}

## Notes
${report.analysisNotes.map((note) => `- ${note}`).join("\n")}
`;
}

function triggerDownload(content: string, type: string, fileName: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}

export default function StudioPage() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<DataRow[]>([]);
  const [previewRows, setPreviewRows] = useState<DataRow[]>([]);
  const [fileName, setFileName] = useState<string>("No dataset loaded");

  const [config, setConfig] = useState<AuditConfig>(EMPTY_CONFIG);
  const [protectedValues, setProtectedValues] = useState<string[]>([]);
  const [outcomeValues, setOutcomeValues] = useState<string[]>([]);
  const [predictionValues, setPredictionValues] = useState<string[]>([]);

  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string>("");
  const [isRunning, setIsRunning] = useState(false);

  const previewHeaders = headers.slice(0, PREVIEW_COLUMNS_LIMIT);

  const datasetStats = useMemo(() => {
    const groupCount = config.protectedAttribute
      ? new Set(
          rows.map((row) => String(row[config.protectedAttribute] ?? "Unknown").trim())
        ).size
      : 0;

    return {
      rowCount: rows.length,
      columnCount: headers.length,
      groupCount,
    };
  }, [config.protectedAttribute, headers.length, rows]);

  const canRunAudit =
    rows.length > 0 &&
    config.protectedAttribute.length > 0 &&
    config.outcomeAttribute.length > 0 &&
    config.favorableOutcome.length > 0;

  function applyDataset(parsed: ParsedCsv, datasetName: string): void {
    const inferredColumns = suggestColumns(parsed.headers);

    const defaultOutcome = inferredColumns.outcomeAttribute ?? parsed.headers[0] ?? "";
    const defaultPrediction = inferredColumns.predictionAttribute;
    const defaultProtected =
      inferredColumns.protectedAttribute ??
      parsed.headers.find(
        (header) => header !== defaultOutcome && header !== defaultPrediction
      ) ??
      parsed.headers[0] ??
      "";

    const nextProtectedValues = defaultProtected
      ? getDistinctColumnValues(parsed.rows, defaultProtected)
      : [];

    const nextOutcomeValues = defaultOutcome
      ? getDistinctColumnValues(parsed.rows, defaultOutcome)
      : [];

    const nextPredictionValues = defaultPrediction
      ? getDistinctColumnValues(parsed.rows, defaultPrediction)
      : [];

    const inferredOutcome = defaultOutcome
      ? inferPositiveLabel(parsed.rows, defaultOutcome, nextOutcomeValues[0] ?? "approved")
      : "";

    const inferredPrediction = defaultPrediction
      ? inferPositiveLabel(
          parsed.rows,
          defaultPrediction,
          nextPredictionValues[0] ?? inferredOutcome
        )
      : undefined;

    setHeaders(parsed.headers);
    setRows(parsed.rows);
    setPreviewRows(parsed.rows.slice(0, PREVIEW_ROWS_LIMIT));
    setFileName(datasetName);

    setProtectedValues(nextProtectedValues);
    setOutcomeValues(nextOutcomeValues);
    setPredictionValues(nextPredictionValues);

    setConfig({
      protectedAttribute: defaultProtected,
      outcomeAttribute: defaultOutcome,
      favorableOutcome: nextOutcomeValues.includes(inferredOutcome)
        ? inferredOutcome
        : nextOutcomeValues[0] ?? "",
      predictionAttribute: defaultPrediction,
      favorablePrediction: defaultPrediction
        ? nextPredictionValues.includes(inferredPrediction ?? "")
          ? inferredPrediction
          : nextPredictionValues[0] ?? inferredOutcome
        : undefined,
      referenceGroup: nextProtectedValues[0],
    });

    setResult(null);
    setError("");
  }

  async function handleFileUpload(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const parsed = await parseCsvFile(file);
      applyDataset(parsed, file.name);
    } catch (uploadError) {
      setError(getErrorMessage(uploadError));
      setResult(null);
    } finally {
      event.target.value = "";
    }
  }

  function handleLoadSample(): void {
    const sample = buildSampleDataset();
    const sampleHeaders = Object.keys(sample.rows[0] ?? {});

    applyDataset(
      {
        headers: sampleHeaders,
        rows: sample.rows,
      },
      sample.fileName
    );
  }

  function handleProtectedChange(value: string): void {
    const nextValues = value ? getDistinctColumnValues(rows, value) : [];
    setProtectedValues(nextValues);

    setConfig((previous) => ({
      ...previous,
      protectedAttribute: value,
      referenceGroup: nextValues.includes(previous.referenceGroup ?? "")
        ? previous.referenceGroup
        : nextValues[0],
    }));

    setResult(null);
  }

  function handleOutcomeChange(value: string): void {
    const nextValues = value ? getDistinctColumnValues(rows, value) : [];
    const inferred = value
      ? inferPositiveLabel(rows, value, nextValues[0] ?? "approved")
      : "";

    setOutcomeValues(nextValues);

    setConfig((previous) => ({
      ...previous,
      outcomeAttribute: value,
      favorableOutcome: nextValues.includes(previous.favorableOutcome)
        ? previous.favorableOutcome
        : nextValues.includes(inferred)
        ? inferred
        : nextValues[0] ?? "",
    }));

    setResult(null);
  }

  function handlePredictionChange(value: string): void {
    const normalizedValue = value || undefined;
    const nextValues = normalizedValue ? getDistinctColumnValues(rows, normalizedValue) : [];
    const inferred = normalizedValue
      ? inferPositiveLabel(rows, normalizedValue, nextValues[0] ?? config.favorableOutcome)
      : undefined;

    setPredictionValues(nextValues);

    setConfig((previous) => ({
      ...previous,
      predictionAttribute: normalizedValue,
      favorablePrediction: normalizedValue
        ? nextValues.includes(previous.favorablePrediction ?? "")
          ? previous.favorablePrediction
          : nextValues.includes(inferred ?? "")
          ? inferred
          : nextValues[0] ?? previous.favorableOutcome
        : undefined,
    }));

    setResult(null);
  }

  function handleRunAudit(): void {
    if (!canRunAudit) {
      setError("Upload a dataset and complete all required configuration fields first.");
      return;
    }

    setIsRunning(true);

    try {
      const nextResult = runFairnessAudit(rows, config);
      setResult(nextResult);
      setError("");
    } catch (auditError) {
      setResult(null);
      setError(getErrorMessage(auditError));
    } finally {
      setIsRunning(false);
    }
  }

  function handleExportJson(): void {
    if (!result) {
      return;
    }

    const cleanName = fileName.replace(/\.[^.]+$/, "") || "dataset";

    triggerDownload(
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          dataset: fileName,
          configuration: config,
          report: result,
        },
        null,
        2
      ),
      "application/json",
      `${cleanName}-equilens-report.json`
    );
  }

  function handleExportMarkdown(): void {
    if (!result) {
      return;
    }

    const cleanName = fileName.replace(/\.[^.]+$/, "") || "dataset";

    triggerDownload(
      buildMarkdownReport(fileName, config, result),
      "text/markdown;charset=utf-8",
      `${cleanName}-equilens-report.md`
    );
  }

  return (
    <main className="relative min-h-screen overflow-x-clip pb-16 pt-24 md:pb-20 md:pt-28">
      <div className="animate-float-slow pointer-events-none absolute -left-24 top-8 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(11,110,79,0.24),rgba(11,110,79,0)_70%)]" />
      <div className="animate-float-fast pointer-events-none absolute -right-16 top-12 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(245,158,11,0.2),rgba(245,158,11,0)_70%)]" />

      <div className="fixed inset-x-0 top-0 z-40 border-b border-black/10 bg-[color:var(--color-card)]/92 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1240px] items-center justify-between gap-3 px-4 py-2.5 md:px-8">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--color-muted)]">
              Quick Analyze
            </p>
            <p className="truncate text-xs font-semibold text-[color:var(--color-ink)] sm:text-sm">
              {result
                ? `Latest score ${result.overallRiskScore}/100 • ${fileName}`
                : `Dataset: ${fileName}`}
            </p>
          </div>

          <button
            type="button"
            onClick={handleRunAudit}
            disabled={!canRunAudit || isRunning}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[color:var(--color-ink)] px-3 py-2 text-xs font-semibold text-white transition enabled:hover:-translate-y-0.5 enabled:hover:bg-[#163d63] disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:text-sm"
          >
            <Play className="h-4 w-4" />
            {isRunning ? "Running..." : "Run Audit"}
          </button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1240px] px-4 md:px-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="section-kicker">Audit Studio</p>
            <h1 className="display-title mt-2 text-3xl font-black leading-tight text-[color:var(--color-ink)] sm:text-4xl md:text-5xl">
              EquiLens Bias Intelligence Hub
            </h1>
            <p className="mt-3 max-w-2xl text-base text-[color:var(--color-muted)] md:text-lg">
              Upload real hiring, lending, or healthcare decision data to expose hidden discrimination before systems impact real people.
            </p>
          </div>

          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-4 py-2 text-sm font-semibold text-[color:var(--color-ink)] transition hover:-translate-y-0.5 hover:bg-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Overview
          </Link>
        </header>

        <section className="glass-panel mb-6 p-4 md:p-5">
          <div className="flex flex-col gap-3">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--color-muted)]">
                Live Audit Context
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-black/10 bg-white/80 px-3 py-1 text-xs font-semibold text-[color:var(--color-ink)]">
                  Rows {datasetStats.rowCount}
                </span>
                <span className="rounded-full border border-black/10 bg-white/80 px-3 py-1 text-xs font-semibold text-[color:var(--color-ink)]">
                  Columns {datasetStats.columnCount}
                </span>
                <span className="rounded-full border border-black/10 bg-white/80 px-3 py-1 text-xs font-semibold text-[color:var(--color-ink)]">
                  Groups {datasetStats.groupCount}
                </span>
                {result ? (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
                    Risk Score {result.overallRiskScore}/100
                  </span>
                ) : null}
              </div>
              <p className="line-clamp-1 text-xs text-[color:var(--color-muted)]">
                Active dataset: {fileName}
              </p>
            </div>
          </div>

          {result ? (
            <div className="mt-3 rounded-2xl border border-black/10 bg-white/85 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">
                Latest Audit Answer
              </p>
              <p className="mt-1 text-sm font-semibold leading-relaxed text-[color:var(--color-ink)]">
                {result.quickSummary}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-xs text-[color:var(--color-muted)]">
              Upload data, confirm columns, then run the audit from here.
            </p>
          )}
        </section>

        <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="order-2 space-y-6 lg:order-1">
            <motion.section
              className="glass-panel p-5"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
            >
              <h2 className="text-lg font-bold text-[color:var(--color-ink)]">Dataset Ingestion</h2>
              <p className="mt-1 text-sm text-[color:var(--color-muted)]">
                Bring your own CSV or launch an intentionally biased demo dataset.
              </p>

              <label
                htmlFor="datasetUpload"
                className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-black/15 bg-white/60 px-4 py-7 text-center transition hover:border-[color:var(--color-accent)] hover:bg-white"
              >
                <UploadCloud className="h-5 w-5 text-[color:var(--color-accent)]" />
                <span className="text-sm font-semibold text-[color:var(--color-ink)]">
                  Upload CSV Dataset
                </span>
                <span className="text-xs text-[color:var(--color-muted)]">
                  Required columns: protected group + outcome. Optional: prediction.
                </span>
              </label>
              <input
                id="datasetUpload"
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={handleFileUpload}
              />

              <button
                type="button"
                onClick={handleLoadSample}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-black/10 bg-[color:var(--color-sand)] px-4 py-2.5 text-sm font-semibold text-[color:var(--color-ink)] transition hover:-translate-y-0.5"
              >
                <FlaskConical className="h-4 w-4" />
                Load Challenge Demo Data
              </button>

              <div className="mt-4 rounded-2xl border border-black/10 bg-white/75 p-3 text-xs text-[color:var(--color-muted)]">
                <p className="font-semibold text-[color:var(--color-ink)]">Current Dataset</p>
                <p className="mt-1 break-all">{fileName}</p>
              </div>
            </motion.section>

            <motion.section
              className="glass-panel p-5"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.07 }}
            >
              <h2 className="text-lg font-bold text-[color:var(--color-ink)]">Audit Configuration</h2>

              <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">
                Protected Attribute
                <select
                  className={CONTROL_CLASSNAME}
                  value={config.protectedAttribute}
                  onChange={(event) => handleProtectedChange(event.target.value)}
                >
                  <option value="">Select a column</option>
                  {headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </label>

              <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">
                Outcome Attribute
                <select
                  className={CONTROL_CLASSNAME}
                  value={config.outcomeAttribute}
                  onChange={(event) => handleOutcomeChange(event.target.value)}
                >
                  <option value="">Select a column</option>
                  {headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </label>

              <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">
                Favorable Outcome Value
                <select
                  className={CONTROL_CLASSNAME}
                  value={config.favorableOutcome}
                  onChange={(event) =>
                    setConfig((previous) => ({
                      ...previous,
                      favorableOutcome: event.target.value,
                    }))
                  }
                  disabled={outcomeValues.length === 0}
                >
                  {outcomeValues.length === 0 ? (
                    <option value="">Select outcome column first</option>
                  ) : null}
                  {outcomeValues.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>

              <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">
                Prediction Attribute (Optional)
                <select
                  className={CONTROL_CLASSNAME}
                  value={config.predictionAttribute ?? ""}
                  onChange={(event) => handlePredictionChange(event.target.value)}
                >
                  <option value="">No prediction column</option>
                  {headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </label>

              {config.predictionAttribute ? (
                <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">
                  Favorable Prediction Value
                  <select
                    className={CONTROL_CLASSNAME}
                    value={config.favorablePrediction ?? ""}
                    onChange={(event) =>
                      setConfig((previous) => ({
                        ...previous,
                        favorablePrediction: event.target.value,
                      }))
                    }
                    disabled={predictionValues.length === 0}
                  >
                    {predictionValues.length === 0 ? (
                      <option value="">No values detected</option>
                    ) : null}
                    {predictionValues.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <div className="mt-5 rounded-2xl border border-black/10 bg-white/80 px-3 py-2.5 text-xs font-medium text-[color:var(--color-muted)]">
                Use the fixed top action button to run your audit while staying anywhere on the page.
              </div>
            </motion.section>

            <motion.section
              className="glass-panel p-5"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.12 }}
            >
              <h2 className="text-lg font-bold text-[color:var(--color-ink)]">Dataset Profile</h2>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-black/10 bg-white/75 p-3 text-center">
                  <p className="text-xs uppercase tracking-[0.12em] text-[color:var(--color-muted)]">
                    Rows
                  </p>
                  <p className="mt-1 text-xl font-black text-[color:var(--color-ink)]">
                    {datasetStats.rowCount}
                  </p>
                </div>
                <div className="rounded-2xl border border-black/10 bg-white/75 p-3 text-center">
                  <p className="text-xs uppercase tracking-[0.12em] text-[color:var(--color-muted)]">
                    Columns
                  </p>
                  <p className="mt-1 text-xl font-black text-[color:var(--color-ink)]">
                    {datasetStats.columnCount}
                  </p>
                </div>
                <div className="rounded-2xl border border-black/10 bg-white/75 p-3 text-center">
                  <p className="text-xs uppercase tracking-[0.12em] text-[color:var(--color-muted)]">
                    Groups
                  </p>
                  <p className="mt-1 text-xl font-black text-[color:var(--color-ink)]">
                    {datasetStats.groupCount}
                  </p>
                </div>
              </div>
              {protectedValues.length > 0 ? (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--color-muted)]">
                    Detected Group Values
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {protectedValues.slice(0, 12).map((value) => (
                      <span
                        key={value}
                        className="rounded-full border border-black/10 bg-white/85 px-2.5 py-1 text-xs font-medium text-[color:var(--color-ink)]"
                      >
                        {value}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </motion.section>
          </aside>

          <section className="order-1 space-y-6 lg:order-2">
            {error ? (
              <div className="glass-panel border border-rose-200/90 bg-rose-50/80 p-4 text-sm text-rose-900">
                <div className="flex items-start gap-2">
                  <ShieldAlert className="mt-0.5 h-4 w-4" />
                  <p>{error}</p>
                </div>
              </div>
            ) : null}

            {result ? (
              <motion.div
                className="space-y-6"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45 }}
              >
                <section className="glass-panel p-5 md:p-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="section-kicker">Executive Signal</p>
                      <h2 className="display-title mt-2 text-2xl font-black text-[color:var(--color-ink)] sm:text-3xl md:text-4xl">
                        {result.quickSummary}
                      </h2>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {result.biasFlags.length === 0 ? (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                            No immediate fairness flags detected
                          </span>
                        ) : (
                          result.biasFlags.slice(0, 4).map((flag) => (
                            <span
                              key={flag}
                              className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800"
                            >
                              {flag}
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-start gap-3 md:items-center">
                      <RiskGauge score={result.overallRiskScore} />
                      <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:justify-center">
                        <button
                          type="button"
                          onClick={handleExportJson}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-black/10 bg-white px-3.5 py-2 text-xs font-semibold text-[color:var(--color-ink)] transition hover:-translate-y-0.5 sm:flex-none"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Export JSON
                        </button>
                        <button
                          type="button"
                          onClick={handleExportMarkdown}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-black/10 bg-white px-3.5 py-2 text-xs font-semibold text-[color:var(--color-ink)] transition hover:-translate-y-0.5 sm:flex-none"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Export MD
                        </button>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {result.metrics.map((metric) => (
                    <MetricCard key={metric.key} metric={metric} />
                  ))}
                </section>

                <section className="grid gap-6 xl:grid-cols-2">
                  <article className="glass-panel p-5">
                    <h3 className="text-lg font-bold text-[color:var(--color-ink)]">
                      Group Outcome vs Selection Rates
                    </h3>
                    <p className="mt-1 text-sm text-[color:var(--color-muted)]">
                      Compare model-selected outcomes with actual positive outcomes for each protected group.
                    </p>
                    <div className="mt-3">
                      <GroupRateChart groups={result.groupStats} />
                    </div>
                  </article>

                  <article className="glass-panel p-5">
                    <h3 className="text-lg font-bold text-[color:var(--color-ink)]">
                      Fairness Risk Surface
                    </h3>
                    <p className="mt-1 text-sm text-[color:var(--color-muted)]">
                      Higher radar points indicate larger fairness risk contribution from each metric.
                    </p>
                    <div className="mt-3">
                      <FairnessRadar metrics={result.metrics} />
                    </div>
                  </article>
                </section>

                <section className="glass-panel p-5">
                  <h3 className="text-lg font-bold text-[color:var(--color-ink)]">
                    Group Gap Matrix
                  </h3>
                  <p className="mt-1 text-sm text-[color:var(--color-muted)]">
                    Direct gap comparison against reference group <b>{result.referenceGroup}</b>.
                  </p>
                  <div className="mt-4">
                    <GapHeatmap
                      rows={result.groupComparisons}
                      referenceGroup={result.referenceGroup}
                    />
                  </div>
                </section>

                <section className="glass-panel p-5">
                  <h3 className="text-lg font-bold text-[color:var(--color-ink)]">
                    Actionable Mitigation Playbook
                  </h3>
                  <p className="mt-1 text-sm text-[color:var(--color-muted)]">
                    Prioritized actions generated from the fairness profile.
                  </p>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {result.recommendations.map((recommendation) => (
                      <article
                        key={recommendation.id}
                        className="rounded-2xl border border-black/10 bg-white/80 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <h4 className="text-sm font-bold text-[color:var(--color-ink)]">
                            {recommendation.title}
                          </h4>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${priorityClass(
                              recommendation.priority
                            )}`}
                          >
                            {recommendation.priority}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-[color:var(--color-muted)]">
                          {recommendation.detail}
                        </p>
                        <p className="mt-2 rounded-xl bg-[color:var(--color-sand)] px-3 py-2 text-xs font-semibold text-[color:var(--color-ink)]">
                          Suggested Fix: {recommendation.suggestedFix}
                        </p>
                      </article>
                    ))}
                  </div>

                  <div className="mt-5 rounded-2xl border border-black/10 bg-white/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">
                      Analysis Notes
                    </p>
                    <ul className="mt-2 space-y-2 text-sm text-[color:var(--color-ink)]">
                      {result.analysisNotes.map((note) => (
                        <li key={note} className="flex items-start gap-2">
                          <Sparkles className="mt-0.5 h-4 w-4 text-[color:var(--color-accent)]" />
                          <span>{note}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>
              </motion.div>
            ) : (
              <section className="glass-panel p-6 sm:p-8">
                <div className="mx-auto max-w-2xl text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[color:var(--color-sand)]">
                    <FileSpreadsheet className="h-6 w-6 text-[color:var(--color-accent)]" />
                  </div>
                  <h2 className="display-title mt-4 text-2xl font-black text-[color:var(--color-ink)] sm:text-3xl">
                    Ready to expose hidden bias?
                  </h2>
                  <p className="mt-2 text-base text-[color:var(--color-muted)]">
                    Upload a CSV or use the demo dataset, map your protected and outcome columns, then run a full fairness audit.
                  </p>
                </div>
              </section>
            )}

            {rows.length > 0 ? (
              <section className="glass-panel p-5">
                <h3 className="text-lg font-bold text-[color:var(--color-ink)]">Dataset Preview</h3>
                <p className="mt-1 text-sm text-[color:var(--color-muted)]">
                  Showing first {previewRows.length} rows and up to {previewHeaders.length} columns.
                </p>

                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full border-separate border-spacing-y-1 text-sm">
                    <thead>
                      <tr>
                        {previewHeaders.map((header) => (
                          <th
                            key={header}
                            className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--color-muted)]"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, rowIndex) => (
                        <tr
                          key={`preview_row_${rowIndex}`}
                          className="rounded-2xl bg-white/80 shadow-[0_8px_20px_-18px_rgba(16,42,67,0.48)]"
                        >
                          {previewHeaders.map((header) => (
                            <td
                              key={`${rowIndex}_${header}`}
                              className="px-3 py-2 text-[color:var(--color-ink)]"
                            >
                              {String(row[header] ?? "-")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}
