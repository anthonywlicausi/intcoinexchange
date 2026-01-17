// app/dealer/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnon);

type VariantRow = {
  id: string;
  grade: string | null;
  holder: string;
  cac: boolean;
  products: {
    series: string;
    metal: string;
    type: string;
  } | null;
};

export default function DealerPage() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [authed, setAuthed] = useState(false);
  const [dealerId, setDealerId] = useState<string>("");

  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [variantId, setVariantId] = useState("");

  const [side, setSide] = useState<"ask" | "bid">("ask");
  const [model, setModel] = useState<"spot_plus" | "fixed_band">("spot_plus");

  const [premiumValue, setPremiumValue] = useState<string>("850");
  const [bandLow, setBandLow] = useState<string>("4000");
  const [bandHigh, setBandHigh] = useState<string>("4300");

  const [qtyMin, setQtyMin] = useState<string>("1");
  const [qtyMax, setQtyMax] = useState<string>("");

  const [expiresDays, setExpiresDays] = useState<string>("30");

  const [msg, setMsg] = useState<string>("");

  // Load auth session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const ok = !!data.session;
      setAuthed(ok);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Load variants list (simple)
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("variants")
        .select("id, grade, holder, cac, products(series, metal, type)")
        .limit(200);

      if (error) {
        setMsg(`Error loading variants: ${error.message}`);
        return;
      }
      setVariants((data as any) || []);
    })();
  }, []);

  const sortedVariants = useMemo(() => {
    return [...variants].sort((a, b) => {
      const as = a.products?.series || "";
      const bs = b.products?.series || "";
      return as.localeCompare(bs);
    });
  }, [variants]);

  async function signIn() {
    setMsg("");
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: pw,
    });
    if (error) setMsg(error.message);
    else setMsg("Signed in.");
  }

  async function signOut() {
    setMsg("");
    await supabase.auth.signOut();
    setDealerId("");
    setMsg("Signed out.");
  }

  async function fetchDealerId() {
    setMsg("");
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return setMsg("No auth user found.");

    const { data, error } = await supabase
      .from("dealers")
      .select("id")
      .eq("auth_user_id", uid)
      .single();

    if (error) return setMsg(`Dealer lookup failed: ${error.message}`);
    setDealerId(data.id);
    setMsg(`Dealer linked: ${data.id}`);
  }

  async function postQuote() {
    setMsg("");
    if (!authed) return setMsg("Sign in first.");
    if (!dealerId) return setMsg("Click “Link Dealer ID” first.");
    if (!variantId) return setMsg("Pick a variant.");

    const days = Math.max(1, parseInt(expiresDays || "30", 10));
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    const payload: any = {
      dealer_id: dealerId,
      variant_id: variantId,
      side,
      model,
      qty_min: Math.max(1, parseInt(qtyMin || "1", 10)),
      qty_max: qtyMax ? Math.max(1, parseInt(qtyMax, 10)) : null,
      expires_at: expiresAt,
      status: "active",
      reaffirmed_at: new Date().toISOString(),
    };

    if (model === "spot_plus") {
      payload.premium_value = Number(premiumValue || "0");
      payload.band_low = null;
      payload.band_high = null;
    } else {
      payload.band_low = Number(bandLow || "0");
      payload.band_high = Number(bandHigh || "0");
      payload.premium_value = null;
    }

    const { error } = await supabase.from("dealer_quotes").insert(payload);
    if (error) setMsg(`Insert failed: ${error.message}`);
    else setMsg("Quote posted. Go to homepage and refresh.");
  }

  return (
    <main style={{ padding: 24, fontFamily: "Arial, sans-serif", maxWidth: 900 }}>
      <h1 style={{ margin: 0 }}>Dealer Portal</h1>
      <p style={{ color: "#666", marginTop: 8 }}>
        Sign in → link your dealer row → post a quote. RLS will block anything you don’t own.
      </p>

      <div style={{ display: "grid", gap: 12, padding: 12, border: "1px solid #eee" }}>
        <div style={{ fontWeight: 700 }}>1) Sign in</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ padding: 10, width: 280 }}
          />
          <input
            placeholder="password"
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            style={{ padding: 10, width: 220 }}
          />
          <button onClick={signIn} style={{ padding: "10px 14px" }}>
            Sign in
          </button>
          <button onClick={signOut} style={{ padding: "10px 14px" }}>
            Sign out
          </button>
        </div>
        <div style={{ color: authed ? "green" : "#999" }}>
          Status: {authed ? "Authenticated" : "Not signed in"}
        </div>

        <div style={{ fontWeight: 700, marginTop: 8 }}>2) Link Dealer ID</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={fetchDealerId} style={{ padding: "10px 14px" }}>
            Link Dealer ID
          </button>
          <span style={{ color: "#666" }}>{dealerId ? `Dealer ID: ${dealerId}` : "Not linked yet"}</span>
        </div>

        <div style={{ fontWeight: 700, marginTop: 8 }}>3) Post a quote</div>

        <label style={{ display: "grid", gap: 6 }}>
          Variant (coin/grade/holder)
          <select
            value={variantId}
            onChange={(e) => setVariantId(e.target.value)}
            style={{ padding: 10 }}
          >
            <option value="">Select…</option>
            {sortedVariants.map((v) => (
              <option key={v.id} value={v.id}>
                {(v.products?.series || "Unknown")} — {v.holder} {v.grade || ""}{v.cac ? " CAC" : ""}
              </option>
            ))}
          </select>
        </label>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <label style={{ display: "grid", gap: 6 }}>
            Side
            <select value={side} onChange={(e) => setSide(e.target.value as any)} style={{ padding: 10 }}>
              <option value="ask">ASK</option>
              <option value="bid">BID</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            Model
            <select value={model} onChange={(e) => setModel(e.target.value as any)} style={{ padding: 10 }}>
              <option value="spot_plus">SPOT + Premium</option>
              <option value="fixed_band">Fixed Band</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            Expires (days)
            <input value={expiresDays} onChange={(e) => setExpiresDays(e.target.value)} style={{ padding: 10, width: 120 }} />
          </label>
        </div>

        {model === "spot_plus" ? (
          <label style={{ display: "grid", gap: 6 }}>
            Premium Value (USD over spot)
            <input value={premiumValue} onChange={(e) => setPremiumValue(e.target.value)} style={{ padding: 10, width: 180 }} />
          </label>
        ) : (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <label style={{ display: "grid", gap: 6 }}>
              Band Low
              <input value={bandLow} onChange={(e) => setBandLow(e.target.value)} style={{ padding: 10, width: 160 }} />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              Band High
              <input value={bandHigh} onChange={(e) => setBandHigh(e.target.value)} style={{ padding: 10, width: 160 }} />
            </label>
          </div>
        )}

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <label style={{ display: "grid", gap: 6 }}>
            Qty Min
            <input value={qtyMin} onChange={(e) => setQtyMin(e.target.value)} style={{ padding: 10, width: 120 }} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            Qty Max (optional)
            <input value={qtyMax} onChange={(e) => setQtyMax(e.target.value)} style={{ padding: 10, width: 160 }} />
          </label>
        </div>

        <button onClick={postQuote} style={{ padding: "12px 16px", fontWeight: 700 }}>
          Post Quote
        </button>

        {msg && <div style={{ whiteSpace: "pre-wrap", color: "#333" }}>{msg}</div>}
      </div>

      <p style={{ marginTop: 16, color: "#666" }}>
        After posting, go to <a href="/">homepage</a> and refresh — your quote should appear if your dealer status is active and expires_at is in the future.
      </p>
    </main>
  );
}
