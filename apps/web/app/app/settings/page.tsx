"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

type Workspace = {
  name: string;
  plan: string;
  stripe_customer_id: string | null;
  returns_processed_month: number;
  returns_limit: number;
};

const PLAN_LABELS: Record<string, string> = {
  free: "Demo (Free)",
  starter: "Starter — $49/mo",
  pro: "Pro — $149/mo",
  enterprise: "Enterprise",
};

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ email?: string; user_metadata?: Record<string, string> } | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [signOutLoading, setSignOutLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push("/auth/login"); return; }
      setUser(user);
      supabase.from("workspaces").select("*").eq("owner_id", user.id).single().then(({ data }) => {
        setWorkspace(data);
        setLoading(false);
      });
    });
  }, [router]);

  async function handleSignOut() {
    setSignOutLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  async function handleBillingPortal() {
    setPortalLoading(true);
    const res = await fetch("/api/billing/portal", { method: "POST" });
    const { url, error } = await res.json();
    if (error || !url) { setPortalLoading(false); return; }
    window.location.href = url;
  }

  async function handleUpgrade(plan: "starter" | "pro") {
    setCheckoutLoading(plan);
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const { url, error } = await res.json();
    if (error || !url) { setCheckoutLoading(null); return; }
    window.location.href = url;
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-0)" }}>
        <div style={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid var(--border-1)", borderTopColor: "var(--accent)", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  const plan = workspace?.plan ?? "free";
  const isPaid = plan !== "free";

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-0)", color: "var(--text-0)", fontFamily: "var(--font-sans)" }}>
      {/* Nav */}
      <header style={{ borderBottom: "1px solid var(--border-0)", padding: "0 28px", height: 52, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link href="/app" style={{ fontSize: 13, color: "var(--text-2)", textDecoration: "none" }}>← Dashboard</Link>
          <span style={{ color: "var(--border-1)" }}>|</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-0)" }}>Settings</span>
        </div>
        <button
          onClick={handleSignOut} disabled={signOutLoading}
          style={{ fontSize: 12.5, color: "var(--text-3)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          {signOutLoading ? "Signing out…" : "Sign out"}
        </button>
      </header>

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "48px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Account */}
        <section style={{ background: "var(--bg-1)", border: "1px solid var(--border-0)", borderRadius: 14, padding: "24px 24px 20px" }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-0)", margin: "0 0 18px" }}>Account</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { label: "Name", value: user?.user_metadata?.full_name ?? "—" },
              { label: "Email", value: user?.email ?? "—" },
              { label: "Company", value: user?.user_metadata?.company_name ?? "—" },
              { label: "Workspace", value: workspace?.name ?? "—" },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border-0)" }}>
                <span style={{ fontSize: 12.5, color: "var(--text-2)" }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-0)" }}>{value}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Plan */}
        <section style={{ background: "var(--bg-1)", border: "1px solid var(--border-0)", borderRadius: 14, padding: "24px 24px 20px" }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-0)", margin: "0 0 18px" }}>Plan & Billing</h2>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, padding: "12px 16px", background: "var(--bg-2)", borderRadius: 8 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-0)" }}>Current plan</div>
              <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>{PLAN_LABELS[plan] ?? plan}</div>
            </div>
            {isPaid ? (
              <button
                onClick={handleBillingPortal} disabled={portalLoading}
                style={{ fontSize: 12.5, fontWeight: 600, color: "var(--accent)", background: "none", border: "1px solid oklch(0.74 0.13 225 / 0.4)", borderRadius: 7, padding: "7px 14px", cursor: portalLoading ? "not-allowed" : "pointer", opacity: portalLoading ? 0.65 : 1 }}
              >
                {portalLoading ? "Opening…" : "Manage billing →"}
              </button>
            ) : (
              <Link href="/pricing" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--accent)", textDecoration: "none" }}>Upgrade →</Link>
            )}
          </div>

          {!isPaid && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 4 }}>Start a 14-day free trial — no credit card required upfront.</div>
              {(["starter", "pro"] as const).map((p) => (
                <button
                  key={p} onClick={() => handleUpgrade(p)} disabled={checkoutLoading !== null}
                  style={{ padding: "10px 0", background: p === "pro" ? "var(--accent)" : "var(--bg-2)", border: p === "pro" ? "none" : "1px solid var(--border-1)", borderRadius: 8, fontSize: 13, fontWeight: 700, color: p === "pro" ? "var(--accent-fg)" : "var(--text-1)", cursor: checkoutLoading ? "not-allowed" : "pointer", opacity: checkoutLoading === p ? 0.65 : 1 }}
                >
                  {checkoutLoading === p ? "Redirecting…" : p === "starter" ? "Start Starter — $49/mo" : "Start Pro — $149/mo"}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* API Key (placeholder) */}
        <section style={{ background: "var(--bg-1)", border: "1px solid var(--border-0)", borderRadius: 14, padding: "24px 24px 20px" }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-0)", margin: "0 0 6px" }}>API Key</h2>
          <p style={{ fontSize: 12.5, color: "var(--text-2)", margin: "0 0 14px", lineHeight: 1.55 }}>Use this key to authenticate API calls to Backhaul. Available on Starter and above.</p>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1, padding: "8px 12px", background: "var(--bg-2)", border: "1px solid var(--border-1)", borderRadius: 7, fontSize: 12, color: isPaid ? "var(--text-2)" : "var(--text-3)", fontFamily: "var(--font-mono)", letterSpacing: isPaid ? undefined : "0.06em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {isPaid ? "bh_sk_••••••••••••••••••••••••••••••••" : "Upgrade to access API keys"}
            </div>
            {isPaid && (
              <button style={{ padding: "8px 14px", background: "var(--bg-2)", border: "1px solid var(--border-1)", borderRadius: 7, fontSize: 12, fontWeight: 600, color: "var(--text-1)", cursor: "pointer" }}>
                Copy
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
