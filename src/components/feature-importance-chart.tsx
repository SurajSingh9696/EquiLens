"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import type { FeatureImportanceScore } from "@/lib/types";

interface Props {
  scores: FeatureImportanceScore[];
  protectedAttribute: string;
}

export function FeatureImportanceChart({ scores, protectedAttribute }: Props) {
  const chartData = useMemo(() => {
    return scores.map((score) => ({
      feature: score.feature,
      importance: Math.max(0.5, score.importance), // Ensure it's visually present
      isProtected: score.feature === protectedAttribute,
    }));
  }, [scores, protectedAttribute]);

  if (scores.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center rounded-2xl border border-dashed border-black/15 bg-white/50 text-sm text-[color:var(--color-muted)]">
        Not enough varied features to compute importance.
      </div>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#00000010" />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="feature"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--color-ink)", fontSize: 12, fontWeight: 500 }}
            width={120}
          />
          <Tooltip
            cursor={{ fill: "rgba(0,0,0,0.04)" }}
            contentStyle={{
              borderRadius: "12px",
              border: "1px solid rgba(0,0,0,0.1)",
              boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)",
            }}
            formatter={(value: number) => [`${value.toFixed(1)}% influence`, "Influence"]}
            labelStyle={{ color: "var(--color-ink)", fontWeight: 700 }}
          />
          <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.isProtected ? "var(--color-accent)" : "rgb(156 163 175)"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
