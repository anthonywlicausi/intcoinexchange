// app/page.tsx
export const dynamic = "force-dynamic";

type LiveQuote = {
  id: string;
  series: string;
  metal: string;
  product_type: string;
  holder: string | null;
  grade: string | null;
  cac: boolean;
  dealer_name: string;
  side: "bid" | "ask";
  model: "spot_plus" | "fixed_band";
  premium_value: number | null;
  premium_pct: number | null;
  band_low: number | null;
  band_high: number | null;
  qty_min: number;
  qty_max: number | null;
  reaffirmed_at: string;
  expires_at: string;
};

async function getLiveQuotes(): Promise<LiveQuote[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const res = await fetch(
    `${url}/rest/v1/v_live_quotes?select=*&order=reaffirmed_at.desc&limit=100`,
    {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    }
  );

  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default async function Page() {
  let rows: LiveQuote[] = [];
  let error: string | null = null;

  try {
    rows = await getLiveQuotes();
  } catch (e: any) {
    error = e?.message || String(e);
  }

  return (
    <main style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
      <h1 style={{ margin: 0 }}>IntCoinExchange</h1>
      <p style={{ color: "#666", marginTop: 8 }}>
        Live dealer quotes only (auto-expire). Powered by spot + premiums.
      </p>

      {error && (
        <div style={{ padding: 12, border: "1px solid #f00", color: "#900" }}>
          <b>Error:</b>
          <div style={{ whiteSpace: "pre-wrap" }}>{error}</div>
          <div style={{ marginTop: 8, color: "#666" }}>
            This is usually Env Vars, RLS, or v_live_quotes having 0 rows.
          </div>
        </div>
      )}

      {!error && rows.length === 0 && (
        <div style={{ padding: 12, border: "1px solid #ddd" }}>
          No live quotes yet. Add at least one active quote (expires_at in the
          future) and it will show here.
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        {rows.map((r) => (
          <div key={r.id} style={{ padding: "12px 0", borderBottom: "1px solid #eee" }}>
            <div style={{ fontSize: 16 }}>
              <b>{r.series}</b>{" "}
              <span style={{ color: "#666" }}>
                {r.holder ? `— ${r.holder}` : ""} {r.grade || ""} {r.cac ? "CAC" : ""}
              </span>
            </div>

            <div style={{ color: "#666", fontSize: 12, marginTop: 4 }}>
              {r.dealer_name} • {r.side.toUpperCase()} • {r.model}
            </div>

            <div style={{ color: "#666", fontSize: 12, marginTop: 4 }}>
              Updated: {new Date(r.reaffirmed_at).toLocaleString()} • Expires:{" "}
              {new Date(r.expires_at).toLocaleString()}
            </div>

            <div style={{ fontSize: 13, marginTop: 6 }}>
              {r.model === "spot_plus" ? (
                <>
                  Premium: <b>{r.premium_value !== null ? `$${r.premium_value}` : "—"}</b>
                </>
              ) : (
                <>
                  Band: <b>{r.band_low ?? "—"} – {r.band_high ?? "—"}</b>
                </>
              )}
              <span style={{ color: "#666" }}>
                {" "}
                • Qty: {r.qty_min}
                {r.qty_max ? `–${r.qty_max}` : "+"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
