import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Admin loader: POST a JSON array of puzzle rows to replace the schedule.
// Body: { replaceAll?: boolean, rows: [{date, puzzle_number, district_id, state,
//   neighbors, state_neighbors, clues}] }. Guarded by the LOAD_SECRET function
// secret (Dashboard → Edge Functions → Secrets); fails closed if unset.

Deno.serve(async (req) => {
  const secret = Deno.env.get("LOAD_SECRET");
  const url = new URL(req.url);
  if (!secret || url.searchParams.get("secret") !== secret) {
    return new Response("forbidden", { status: 403 });
  }
  let body: any;
  try { body = await req.json(); } catch { return json(400, { error: "bad_json" }); }
  const rows = Array.isArray(body) ? body : body.rows;
  if (!Array.isArray(rows) || rows.length === 0) return json(400, { error: "no_rows" });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  if (body.replaceAll) {
    const { error } = await admin.from("puzzles").delete().neq("date", "1900-01-01");
    if (error) return json(500, { error: "clear_failed", detail: error.message });
  }

  let loaded = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const { error } = await admin.from("puzzles").upsert(batch, { onConflict: "date" });
    if (error) return json(500, { error: "upsert_failed", at: i, detail: error.message });
    loaded += batch.length;
  }
  return json(200, { loaded });
});

function json(status: number, b: unknown) {
  return new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
}
