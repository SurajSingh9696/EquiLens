"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface RunHistory {
  run: number;
  score: number;
  timestamp: string;
}

interface Props {
  history: RunHistory[];
}

export function BiasTimeline({ history }: Props) {
  if (history.length <= 1) {
    return (
      <div className="flex h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-black/15 bg-white/50 text-sm text-[color:var(--color-muted)]">
        <p>Run more audits to generate a timeline.</p>
        <span className="mt-1 text-xs text-black/40">Tracking {history.length} run(s)</span>
      </div>
    );
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#00000010" />
          <XAxis 
            dataKey="run" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: "var(--color-muted)", fontSize: 12 }} 
            tickFormatter={(value) => `Run ${value}`}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: "var(--color-muted)", fontSize: 12 }} 
            domain={[0, 100]}
          />
          <Tooltip
            contentStyle={{
              borderRadius: "12px",
              border: "1px solid rgba(0,0,0,0.1)",
              boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)",
            }}
            labelStyle={{ display: "none" }}
            formatter={(value, _name, item) => {
              const numericValue = Array.isArray(value)
                ? Number(value[0] ?? 0)
                : Number(value ?? 0);
              const safeValue = Number.isFinite(numericValue) ? numericValue : 0;
              const payload = item?.payload;
              const runLabel =
                payload && typeof payload === "object" && "run" in payload
                  ? String((payload as { run?: unknown }).run ?? "?")
                  : "?";

              return [`${safeValue}/100 Risk Score`, `Run ${runLabel}`];
            }}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="var(--color-accent)"
            strokeWidth={3}
            dot={{ r: 4, strokeWidth: 2, fill: "#fff" }}
            activeDot={{ r: 6, fill: "var(--color-accent)" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
