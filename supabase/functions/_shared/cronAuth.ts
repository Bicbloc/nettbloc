// Shared authorization helper for scheduled / administrative edge functions.
//
// These functions perform privileged, irreversible operations (bulk deletes,
// day-close, PMS syncs) and must NEVER be callable anonymously.
//
// A request is considered authorized when EITHER:
//   1. It carries the project's service-role key in the Authorization header
//      (this is what Supabase pg_cron / scheduled invocations send), OR
//   2. It carries a matching `x-cron-secret` header equal to the CRON_SECRET
//      environment variable (optional, if configured for external schedulers).
export function isAuthorizedCronRequest(req: Request): boolean {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const authHeader = req.headers.get("Authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";

  if (serviceKey && bearer && bearer === serviceKey) {
    return true;
  }

  const expectedCronSecret = Deno.env.get("CRON_SECRET");
  const providedCronSecret = req.headers.get("x-cron-secret") ?? "";
  if (expectedCronSecret && providedCronSecret && providedCronSecret === expectedCronSecret) {
    return true;
  }

  return false;
}

export function unauthorizedResponse(corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
