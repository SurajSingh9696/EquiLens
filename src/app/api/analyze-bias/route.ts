import { NextResponse } from "next/server";
import { runFairnessAudit } from "@/lib/fairness";
import type { AuditConfig, DataRow } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { rows, config } = body as { rows: DataRow[]; config: AuditConfig };

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: "Invalid or empty 'rows' provided." },
        { status: 400 }
      );
    }

    if (!config || !config.protectedAttribute || !config.outcomeAttribute || !config.favorableOutcome) {
      return NextResponse.json(
        { error: "Missing required configuration fields (protectedAttribute, outcomeAttribute, favorableOutcome)." },
        { status: 400 }
      );
    }

    const result = runFairnessAudit(rows, config);

    return NextResponse.json({
      success: true,
      biasScore: result.overallRiskScore,
      warning: result.biasFlags.length > 0 ? result.biasFlags[0] : null,
      fairnessResult: result,
    });
  } catch (error) {
    console.error("Bias analysis error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unexpected error occurred during bias analysis." },
      { status: 500 }
    );
  }
}
