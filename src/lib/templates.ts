import type { DataRow } from "@/lib/types";
import { type ParsedCsv } from "@/lib/csv";

export interface Template {
  id: string;
  name: string;
  description: string;
  dataset: ParsedCsv;
}

export const TEMPLATES: Template[] = [
  {
    id: "hiring",
    name: "Hiring Bias (Tech Roles)",
    description: "Simulates an ATS screening model with gender bias towards male applicants.",
    dataset: generateHiringData(),
  },
  {
    id: "loan",
    name: "Loan Approval (Mortgage)",
    description: "Simulates a mortgage approval model with geographic/racial bias against minority neighborhoods.",
    dataset: generateLoanData(),
  },
  {
    id: "healthcare",
    name: "Healthcare Care Triage",
    description: "Simulates risk assignment displaying racial bias underestimating health severity.",
    dataset: generateHealthcareData(),
  }
];

function generateHiringData(): ParsedCsv {
  const rows: DataRow[] = [];
  const roles = ["Software Engineer", "Data Scientist", "Product Manager", "Designer"];
  for (let i = 0; i < 500; i++) {
    const isMale = Math.random() > 0.35; // 65% male
    const gender = isMale ? "Male" : "Female";
    const experience = Math.floor(Math.random() * 10) + 1;
    const role = roles[Math.floor(Math.random() * roles.length)];
    
    // Bias: baseline approval is 30%. Men get +15% boost.
    let baseScore = (experience * 0.05) + 0.1;
    if (isMale) baseScore += 0.15;
    
    const trueQualified = Math.random() < ((experience * 0.05) + 0.15) ? "Yes" : "No";
    const aiDecision = Math.random() < baseScore ? "Yes" : "No";

    rows.push({
      Applicant_ID: `APP-${1000 + i}`,
      Gender: gender,
      Years_Experience: String(experience),
      Role: role,
      Actually_Qualified: trueQualified,
      AI_Screening_Decision: aiDecision,
    });
  }
  return { headers: Object.keys(rows[0]), rows };
}

function generateLoanData(): ParsedCsv {
  const rows: DataRow[] = [];
  const neighborhoods = ["Northside", "Southside", "Eastside", "Westville"];
  for (let i = 0; i < 500; i++) {
    // Bias against Southside
    const neighborhood = neighborhoods[Math.floor(Math.random() * neighborhoods.length)];
    const income = Math.floor(Math.random() * 80000) + 40000;
    
    const isSouthside = neighborhood === "Southside";
    let baseScore = (income / 120000) * 0.5;
    if (isSouthside) baseScore -= 0.20; // AI penalty for Southside
    
    const truePayback = Math.random() < ((income / 120000) * 0.5) ? "Approved" : "Rejected";
    const aiDecision = Math.random() < baseScore ? "Approved" : "Rejected";

    rows.push({
      Applicant_ID: `LOAN-${1000 + i}`,
      Neighborhood: neighborhood,
      Annual_Income: String(income),
      Actual_Repayment_Ability: truePayback,
      AI_Loan_Decision: aiDecision,
    });
  }
  return { headers: Object.keys(rows[0]), rows };
}

function generateHealthcareData(): ParsedCsv {
  const rows: DataRow[] = [];
  const groups = ["Non-Minority", "Minority"];
  for (let i = 0; i < 500; i++) {
    const group = groups[Math.floor(Math.random() * groups.length)];
    const chronicConditions = Math.floor(Math.random() * 5);
    
    const isMinority = group === "Minority";
    // AI uses healthcare cost as proxy for need, underestimating minority need
    let baseScore = (chronicConditions * 0.15);
    if (isMinority) baseScore -= 0.15; // Penalty

    const trueNeed = Math.random() < (chronicConditions * 0.15 + 0.1) ? "High Risk" : "Low Risk";
    const aiDecision = Math.random() < baseScore ? "High Risk" : "Low Risk";

    rows.push({
      Patient_ID: `PT-${1000 + i}`,
      Demographic_Group: group,
      Chronic_Conditions: String(chronicConditions),
      True_Health_Need: trueNeed,
      AI_Triage_Score: aiDecision,
    });
  }
  return { headers: Object.keys(rows[0]), rows };
}
