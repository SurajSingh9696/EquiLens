import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function formatPercent(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatRatio(value: number, digits = 2): string {
  return value.toFixed(digits);
}

export function normalizeToken(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim().toLowerCase();
}

export function titleCase(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((chunk) => chunk[0].toUpperCase() + chunk.slice(1).toLowerCase())
    .join(" ");
}
