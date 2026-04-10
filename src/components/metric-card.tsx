import {
  AlertTriangle,
  CircleCheckBig,
  Siren,
  type LucideIcon,
} from "lucide-react";
import type { MetricScore, Severity } from "@/lib/types";

interface MetricCardProps {
  metric: MetricScore;
}

const severityStyle: Record<
  Severity,
  {
    container: string;
    badge: string;
    icon: LucideIcon;
    tone: string;
  }
> = {
  good: {
    container: "border-emerald-200/80 bg-emerald-50/70",
    badge: "bg-emerald-100 text-emerald-800",
    icon: CircleCheckBig,
    tone: "Good",
  },
  warning: {
    container: "border-amber-200/80 bg-amber-50/70",
    badge: "bg-amber-100 text-amber-900",
    icon: AlertTriangle,
    tone: "Warning",
  },
  critical: {
    container: "border-rose-200/80 bg-rose-50/70",
    badge: "bg-rose-100 text-rose-900",
    icon: Siren,
    tone: "Critical",
  },
};

export function MetricCard({ metric }: MetricCardProps) {
  const style = severityStyle[metric.severity];
  const Icon = style.icon;

  return (
    <article
      className={`flex h-full flex-col gap-3 rounded-3xl border p-5 shadow-[0_10px_30px_-18px_rgba(16,42,67,0.45)] ${style.container}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="rounded-xl bg-white/75 p-2">
            <Icon className="h-4 w-4 text-[color:var(--color-ink)]" />
          </span>
          <h3 className="text-sm font-bold text-[color:var(--color-ink)]">{metric.label}</h3>
        </div>
        <span
          className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${style.badge}`}
        >
          {style.tone}
        </span>
      </div>

      <p className="text-sm leading-relaxed text-[color:var(--color-muted)]">{metric.description}</p>

      <div className="mt-auto flex items-end justify-between gap-3">
        <span className="text-3xl font-black tracking-tight text-[color:var(--color-ink)]">
          {metric.displayValue}
        </span>
        <span className="rounded-full border border-black/10 px-2.5 py-1 text-xs font-semibold text-[color:var(--color-muted)]">
          Target {metric.target}
        </span>
      </div>
    </article>
  );
}
