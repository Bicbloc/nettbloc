import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// NOTE: This client is intentionally configured with `flowType: 'implicit'`
// so password recovery links work even when the user opens the email in another
// browser/device (no PKCE code_verifier required).
const SUPABASE_URL = "https://rarhqnvvbjzfdevnghnz.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhcmhxbnZ2Ymp6ZmRldm5naG56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE4NzYwNzgsImV4cCI6MjA2NzQ1MjA3OH0.yvG3MIFbssrNa8wl5qFBi5NWBgZq0gmy8Ovc3yGoliY";

export const supabaseRecovery = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    flowType: "implicit",
  },
  global: {
    headers: {
      "x-client-info": "nettobloc-recovery",
    },
  },
});
