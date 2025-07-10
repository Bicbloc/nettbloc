
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

/**
 * Générer un UUID v4 valide et déterministe basé sur le code hôtel
 * @param hotelCode Le code de l'hôtel
 * @returns Un UUID v4 valide basé sur le code
 */
export function generateHotelId(hotelCode: string): string {
  if (!hotelCode) return '';
  
  // Créer un hash déterministe du code hôtel
  let hash = 0;
  for (let i = 0; i < hotelCode.length; i++) {
    const char = hotelCode.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convertir en 32 bits
  }
  
  // Convertir en UUID v4 valide format avec version et variant bits corrects
  const abs = Math.abs(hash);
  const hex = abs.toString(16).padStart(8, '0').repeat(4).slice(0, 32);
  
  // Format UUID v4: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  // où y est 8, 9, a, ou b
  const uuid = [
    hex.slice(0, 8),
    hex.slice(8, 12),
    '4' + hex.slice(13, 16),  // Version 4
    (parseInt(hex[16], 16) & 0x3 | 0x8).toString(16) + hex.slice(17, 20), // Variant bits
    hex.slice(20, 32)
  ].join('-');
  
  console.log(`🆔 UUID v4 valide généré pour ${hotelCode}:`, uuid);
  return uuid;
}

/**
 * Nettoyer les anciens IDs d'hôtel non-UUID du localStorage
 */
export function cleanupInvalidHotelIds(): void {
  const keys = ['selectedHotelId', 'hotelId', 'selectedHotelCode'];
  
  keys.forEach(key => {
    const value = localStorage.getItem(key);
    if (value && value.startsWith('hotel-') && !isValidUUID(value)) {
      console.log(`🧹 Nettoyage ancien ID invalide (${key}):`, value);
      localStorage.removeItem(key);
    }
  });
}

/**
 * Valider qu'une chaîne est un UUID valide
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}
