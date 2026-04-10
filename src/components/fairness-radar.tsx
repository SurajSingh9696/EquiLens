"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { MetricScore } from "@/lib/types";

interface FairnessRadarProps {
  metrics: MetricScore[];
}

interface RadarRow {
  metric: string;
  risk: number;
}

function compactLabel(label: string): string {
  return label
    .replace("Difference", "Diff")
    .replace("Demographic", "Demo")
    .replace("Representation", "Rep")
    .replace("Predictive", "Pred");
}

function toChartData(metrics: MetricScore[]): RadarRow[] {
  return metrics.map((metric) => ({
    metric: compactLabel(metric.label),
    risk: Number((metric.riskContribution * 100).toFixed(1)),
  }));
}

export function FairnessRadar({ metrics }: FairnessRadarProps) {
  const data = toChartData(metrics);

  return (
    <div className="h-[260px] w-full sm:h-[300px] md:h-[320px]">
      <ResponsiveContainer>
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="rgba(16, 42, 67, 0.18)" />
          <PolarAngleAxis
            dataKey="metric"
            tick={{ fill: "#36506b", fontSize: 11, fontWeight: 600 }}
          />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Radar
            dataKey="risk"
            stroke="#b42318"
            fill="#f04438"
            fillOpacity={0.3}
            strokeWidth={2}
          />
          <Tooltip
            formatter={(value) => {
              const numeric = Array.isArray(value)
                ? Number(value[0] ?? 0)
                : Number(value ?? 0);
              const safeNumeric = Number.isFinite(numeric) ? numeric : 0;

              return `${safeNumeric.toFixed(1)} risk`;
            }}
            contentStyle={{
              borderRadius: 14,
              border: "1px solid rgba(16, 42, 67, 0.12)",
              boxShadow: "0 10px 30px -15px rgba(16, 42, 67, 0.45)",
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
