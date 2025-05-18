
import { createClient } from '@supabase/supabase-js';

// Get environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if environment variables are available
if (!supabaseUrl) {
  console.error("Missing VITE_SUPABASE_URL environment variable");
}

if (!supabaseKey) {
  console.error("Missing VITE_SUPABASE_ANON_KEY environment variable");
}

// Create a mock client if URL or key is missing
const isMissingCredentials = !supabaseUrl || !supabaseKey;

// Create client or placeholder with properly chained mock methods
export const supabaseClient = isMissingCredentials 
  ? {
      from: () => ({
        insert: () => ({ error: new Error("Supabase credentials not configured") }),
        select: () => ({
          data: [],
          error: new Error("Supabase credentials not configured"),
          order: () => ({ data: [], error: new Error("Supabase credentials not configured") })
        }),
      }),
      auth: {
        signIn: () => ({ error: new Error("Supabase credentials not configured") }),
        signOut: () => ({ error: new Error("Supabase credentials not configured") }),
      }
    }
  : createClient(supabaseUrl, supabaseKey);

// Helper function to save email to Supabase
export async function saveEmailToSupabase(email: string) {
  try {
    // If we're missing credentials, log but don't crash
    if (isMissingCredentials) {
      console.warn("Cannot save email: Supabase credentials not configured");
      return { success: false, error: "Supabase credentials not configured" };
    }
    
    const { error } = await supabaseClient
      .from('report_emails')
      .insert([{ email, created_at: new Date().toISOString() }]);
      
    return { success: !error, error };
  } catch (err) {
    console.error("Error saving email to Supabase:", err);
    return { success: false, error: err };
  }
}

// Helper function to get emails from Supabase
export async function getEmailsFromSupabase() {
  try {
    // If we're missing credentials, log and return empty array
    if (isMissingCredentials) {
      console.warn("Cannot fetch emails: Supabase credentials not configured");
      return { success: false, data: [], error: "Supabase credentials not configured" };
    }
    
    // Execute the query with proper chaining
    const { data, error } = await supabaseClient
      .from('report_emails')
      .select('email, created_at')
      .order('created_at', { ascending: false });
      
    return { success: !error, data: data || [], error };
  } catch (err) {
    console.error("Error fetching emails from Supabase:", err);
    return { success: false, data: [], error: err };
  }
}
