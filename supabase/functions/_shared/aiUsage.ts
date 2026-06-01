import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface LogAiUsageParams {
  functionName: string;
  aiData: any;
  model?: string;
  hotelId?: string | null;
  userId?: string | null;
  status?: string;
}

// Fire-and-forget logging of AI token consumption to ai_usage_logs.
// Never throws — failures are swallowed so they can't break the main request.
export async function logAiUsage(params: LogAiUsageParams): Promise<void> {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return;

    const supabase = createClient(url, key);
    const u = params.aiData?.usage || {};
    const prompt = u.prompt_tokens ?? 0;
    const completion = u.completion_tokens ?? 0;
    const total = u.total_tokens ?? (prompt + completion);

    await supabase.from("ai_usage_logs").insert({
      hotel_id: params.hotelId ?? null,
      user_id: params.userId ?? null,
      function_name: params.functionName,
      model: params.model ?? null,
      prompt_tokens: prompt,
      completion_tokens: completion,
      total_tokens: total,
      status: params.status ?? "success",
    });
  } catch (_) {
    /* ignore logging errors */
  }
}
