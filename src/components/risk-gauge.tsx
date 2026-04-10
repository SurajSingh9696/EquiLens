import { clamp } from "@/lib/utils";

interface RiskGaugeProps {
  score: number;
}

function getRiskTone(score: number): { color: string; label: string } {
  if (score >= 70) {
    return { color: "#b42318", label: "High Risk" };
  }

  if (score >= 40) {
    return { color: "#b54708", label: "Moderate Risk" };
  }

  return { color: "#027a48", label: "Low Risk" };
}

export function RiskGauge({ score }: RiskGaugeProps) {
  const safeScore = clamp(score, 0, 100);
  const tone = getRiskTone(safeScore);
  const radius = 82;
  const circumference = 2 * Math.PI * radius;
  const progress = (safeScore / 100) * circumference;
  const strokeDashoffset = circumference - progress;

  return (
    <div className="relative flex h-40 w-40 items-center justify-center rounded-full sm:h-44 sm:w-44 md:h-48 md:w-48">
      <svg
        className="absolute inset-0 -rotate-90"
        viewBox="0 0 200 200"
        aria-hidden="true"
      >
        <circle
          cx="100"
          cy="100"
          r={radius}
          fill="transparent"
          stroke="rgba(16, 42, 67, 0.14)"
          strokeWidth="14"
        />
        <circle
          cx="100"
          cy="100"
          r={radius}
          fill="transparent"
          stroke={tone.color}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />
      </svg>

      <div className="absolute inset-2 rounded-full bg-[color:var(--color-card)]" />

      <div className="relative z-10 flex flex-col items-center gap-1">
        <span className="text-5xl font-black tracking-tight text-[color:var(--color-ink)]">
          {safeScore}
        </span>
        <span className="rounded-full border border-black/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--color-muted)]">
          {tone.label}
        </span>
      </div>
    </div>
  );
}
