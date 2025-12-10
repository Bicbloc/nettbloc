/**
 * Types unifiés pour le système PMS
 */

export type CleaningType = 'full' | 'quick' | 'none';

export interface ExtractedRoom {
  roomNumber: string;
  status: string;
  cleaningType: CleaningType;
  arrivalDate?: string;
  departureDate?: string;
  guestName?: string;
  confidence?: number;
  isConnected?: boolean;
  linkedRooms?: string[];
  originalText?: string;
  validated?: boolean;
}

export interface StatusMapping {
  status: string;
  cleaning: CleaningType;
  priority?: number;
}

export interface CombinationRule {
  conditions: string[];
  result: { status: string; cleaning: CleaningType };
}

export interface PmsConfig {
  pmsType: string;
  keywords: string[];
  roomNumberRegex: string;
  statusMappings: Record<string, StatusMapping>;
  combinationRules: CombinationRule[];
  dateFormats: string[];
}

export interface PmsDetectionResult {
  pmsType: string;
  confidence: number;
  matchedKeywords: string[];
}

export interface PmsCredentials {
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
  propertyId?: string;
  baseUrl?: string;
}

export interface PmsApiRoom {
  roomNumber: string;
  status: string;
  cleaningType: CleaningType;
  guestName?: string;
  checkIn?: string;
  checkOut?: string;
}
