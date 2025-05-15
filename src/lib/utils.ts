
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

/**
 * Gets the first digit from a room number
 * @param roomNumber The room number (e.g., "101", "R102", etc.)
 * @returns The first digit as a number
 */
export function getFirstDigitFromRoomNumber(roomNumber: string): number {
  const digit = roomNumber.replace(/^\D+/, '').charAt(0);
  return parseInt(digit, 10) || 0;
}
