import type { GroupComparison } from "@/lib/types";
import { formatPercent } from "@/lib/utils";

interface GapHeatmapProps {
  rows: GroupComparison[];
  referenceGroup: string;
}

function cellTone(value: number): string {
  if (value <= 0.08) {
    return "bg-emerald-50 text-emerald-900";
  }

  if (value <= 0.16) {
    return "bg-amber-50 text-amber-900";
  }

  return "bg-rose-50 text-rose-900";
}

function renderCell(value: number | null): string {
  if (value === null) {
    return "N/A";
  }

  return formatPercent(value);
}

export function GapHeatmap({ rows, referenceGroup }: GapHeatmapProps) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-y-2 text-left text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-[0.16em] text-[color:var(--color-muted)]">
            <th className="px-3 py-1">Group</th>
            <th className="px-3 py-1">Selection Gap</th>
            <th className="px-3 py-1">TPR Gap</th>
            <th className="px-3 py-1">FPR Gap</th>
            <th className="px-3 py-1">Precision Gap</th>
            <th className="px-3 py-1">Overall</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.group} className="rounded-2xl bg-white/75 shadow-[0_8px_26px_-18px_rgba(16,42,67,0.4)]">
              <td className="rounded-l-2xl px-3 py-3 font-bold text-[color:var(--color-ink)]">
                <div className="flex items-center gap-2">
                  <span>{row.group}</span>
                  {row.group === referenceGroup ? (
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-sky-700">
                      Reference
                    </span>
                  ) : null}
                </div>
              </td>
              <td className="px-3 py-3">
                <span className={`rounded-full px-2.5 py-1 font-semibold ${cellTone(row.selectionRateGap)}`}>
                  {formatPercent(row.selectionRateGap)}
                </span>
              </td>
              <td className="px-3 py-3">
                <span
                  className={`rounded-full px-2.5 py-1 font-semibold ${
                    row.tprGap === null ? "bg-slate-100 text-slate-700" : cellTone(row.tprGap)
                  }`}
                >
                  {renderCell(row.tprGap)}
                </span>
              </td>
              <td className="px-3 py-3">
                <span
                  className={`rounded-full px-2.5 py-1 font-semibold ${
                    row.fprGap === null ? "bg-slate-100 text-slate-700" : cellTone(row.fprGap)
                  }`}
                >
                  {renderCell(row.fprGap)}
                </span>
              </td>
              <td className="px-3 py-3">
                <span
                  className={`rounded-full px-2.5 py-1 font-semibold ${
                    row.precisionGap === null
                      ? "bg-slate-100 text-slate-700"
                      : cellTone(row.precisionGap)
                  }`}
                >
                  {renderCell(row.precisionGap)}
                </span>
              </td>
              <td className="rounded-r-2xl px-3 py-3">
                <span className={`rounded-full px-2.5 py-1 font-semibold ${cellTone(row.overallGap)}`}>
                  {formatPercent(row.overallGap)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
