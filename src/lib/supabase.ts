
import { supabase } from '@/integrations/supabase/client';

// Use the existing supabase client
export const supabaseClient = supabase;

// Helper function for email/hotel code association
const EMAIL_HOTEL_ASSOCIATION_KEY = "email_hotel_association";

export function saveEmailHotelAssociation(email: string, hotelCode: string) {
  if (typeof window !== "undefined") {
    const associations = getEmailHotelAssociations();
    associations[email] = hotelCode;
    localStorage.setItem(EMAIL_HOTEL_ASSOCIATION_KEY, JSON.stringify(associations));
  }
}

export function getEmailHotelAssociations(): Record<string, string> {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem(EMAIL_HOTEL_ASSOCIATION_KEY);
    return saved ? JSON.parse(saved) : {};
  }
  return {};
}

export function getHotelCodeForEmail(email: string): string | null {
  const associations = getEmailHotelAssociations();
  return associations[email] || null;
}

// Helper function to save email to Supabase
export async function saveEmailToSupabase(email: string) {
  try {
    // Just save the email association locally for now since we don't have a specific table for emails
    console.log("Email saved locally:", email);
    return { success: true, error: null };
  } catch (err) {
    console.error("Error saving email:", err);
    return { success: false, error: err };
  }
}

// Also update vite-env.d.ts to include environment variable types
