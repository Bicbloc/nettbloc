
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabaseClient = createClient(supabaseUrl, supabaseKey);

// Helper function to save email to Supabase
export async function saveEmailToSupabase(email: string) {
  try {
    const { error } = await supabaseClient
      .from('report_emails')
      .insert([{ email, created_at: new Date().toISOString() }]);
      
    return { success: !error, error };
  } catch (err) {
    console.error("Error saving email to Supabase:", err);
    return { success: false, error: err };
  }
}
