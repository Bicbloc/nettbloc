
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Email storage for report downloads
const EMAIL_STORAGE_KEY = "bicbloc_report_email";

export function saveReportEmail(email: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(EMAIL_STORAGE_KEY, email);
  }
}

export function getReportEmail(): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem(EMAIL_STORAGE_KEY) || "";
  }
  return "";
}
