import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import * as topojson from "https://esm.sh/topojson-client@3";

// One-time admin loader: fetch the public topojson, decode each district to
// GeoJSON, and populate public.district_geometries (keyed by district_id, so
// ordering doesn't matter). Idempotent (upsert). Guarded by the LOAD_SECRET
// function secret (Dashboard → Edge Functions → Secrets); fails closed if unset.
const TOPO_URL = "https://jcervas.github.io/games/district-guess/districts-core.topojson";

Deno.serve(async (req) => {
  const secret = Deno.env.get("LOAD_SECRET");
  const url = new URL(req.url);
  if (!secret || url.searchParams.get("secret") !== secret) {
    return new Response("forbidden", { status: 403 });
  }
  try {
    const topo = await (await fetch(TOPO_URL)).json();
    const fc = topojson.feature(topo, topo.objects.districts) as any;
    const rows = fc.features
      .map((f: any) => ({
        district_id: f.properties["state-district"],
        state: f.properties.state,
        geometry: f.geometry,
      }))
      .filter((r: any) => r.district_id);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    let loaded = 0;
    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100);
      const { error } = await admin
        .from("district_geometries")
        .upsert(batch, { onConflict: "district_id" });
      if (error) {
        return new Response(JSON.stringify({ error: error.message, at: i }), {
          status: 500, headers: { "Content-Type": "application/json" },
        });
      }
      loaded += batch.length;
    }
    return new Response(JSON.stringify({ loaded }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
