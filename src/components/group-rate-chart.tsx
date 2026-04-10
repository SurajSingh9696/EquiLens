"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { GroupStat } from "@/lib/types";

interface GroupRateChartProps {
  groups: GroupStat[];
}

interface ChartRow {
  group: string;
  selectionRate: number;
  actualRate: number;
}

function toChartData(groups: GroupStat[]): ChartRow[] {
  return groups.map((group) => ({
    group: group.group,
    selectionRate: Number((group.selectionRate * 100).toFixed(2)),
    actualRate: Number((group.actualPositiveRate * 100).toFixed(2)),
  }));
}

export function GroupRateChart({ groups }: GroupRateChartProps) {
  const data = toChartData(groups);

  return (
    <div className="h-[260px] w-full sm:h-[300px] md:h-[320px]">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="4 4" stroke="rgba(16, 42, 67, 0.12)" />
          <XAxis
            dataKey="group"
            tick={{ fill: "#36506b", fontSize: 12, fontWeight: 600 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(value) => `${value}%`}
            tick={{ fill: "#36506b", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 14,
              border: "1px solid rgba(16, 42, 67, 0.12)",
              boxShadow: "0 10px 30px -15px rgba(16, 42, 67, 0.45)",
            }}
            formatter={(value) => {
              const numeric = Array.isArray(value)
                ? Number(value[0] ?? 0)
                : Number(value ?? 0);
              const safeNumeric = Number.isFinite(numeric) ? numeric : 0;

              return `${safeNumeric.toFixed(2)}%`;
            }}
          />
          <Legend />
          <Bar
            dataKey="selectionRate"
            name="Selection Rate"
            fill="#f79009"
            radius={[8, 8, 0, 0]}
          />
          <Bar
            dataKey="actualRate"
            name="Actual Outcome Rate"
            fill="#1570ef"
            radius={[8, 8, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
