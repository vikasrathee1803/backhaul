import Link from "next/link";

const TIERS = [
  {
    name: "Demo",
    price: "$0",
    period: "no credit card",
    desc: "See the full system running on realistic fixture data. No commitment.",
    features: ["Full mock demo — all pages", "Agent Ops live graph", "76/76 eval results", "Escalation queue", "Audit log"],
    cta: "View live demo",
    ctaHref: "/demo/dashboard",
    highlight: false,
  },
  {
    name: "Starter",
    price: "$49",
    period: "per month",
    desc: "For small ops teams going live on real marketplace data.",
    features: ["Up to 500 returns / month", "All 5 marketplace channels", "Full audit trail", "AI confidence + escalation", "Email support"],
    cta: "Start free trial",
    ctaHref: "/auth/signup?plan=starter",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$149",
    period: "per month",
    desc: "For growing teams with high volume and custom policies.",
    features: ["Unlimited returns", "Custom marketplace policy rules", "Webhook notifications", "Override → eval feedback loop", "Priority support"],
    cta: "Start free trial",
    ctaHref: "/auth/signup?plan=pro",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "annual contract",
    desc: "Multi-location ops teams with compliance and SLA requirements.",
    features: ["Everything in Pro", "Multi-location routing", "Dedicated CSM", "Custom eval suite", "SLA + security review"],
    cta: "Talk to sales",
    ctaHref: "mailto:vikas@backhaul.ai",
    highlight: false,
  },
];

const COMPARISON = [
  { feature: "Returns per month",        free: "Demo data only", starter: "500",      pro: "Unlimited",  enterprise: "Unlimited" },
  { feature: "Marketplace channels",     free: "5 (fixtures)",   starter: "5",        pro: "5 + custom", enterprise: "5 + custom" },
  { feature: "Real marketplace data",    free: "—",              starter: "✓",        pro: "✓",          enterprise: "✓" },
  { feature: "AI triage decisions",      free: "Demo only",      starter: "✓",        pro: "✓",          enterprise: "✓" },
  { feature: "Agent Ops live view",      free: "✓",              starter: "✓",        pro: "✓",          enterprise: "✓" },
  { feature: "Audit trail",              free: "Demo only",      starter: "✓",        pro: "✓",          enterprise: "✓" },
  { feature: "Escalation queue",         free: "✓",              starter: "✓",        pro: "✓",          enterprise: "✓" },
  { feature: "Custom policy rules",      free: "—",              starter: "—",        pro: "✓",          enterprise: "✓" },
  { feature: "Webhook notifications",    free: "—",              starter: "—",        pro: "✓",          enterprise: "✓" },
  { feature: "Override → eval feedback", free: "—",              starter: "✓",        pro: "✓",          enterprise: "✓" },
  { feature: "Multi-location routing",   free: "—",              starter: "—",        pro: "—",          enterprise: "✓" },
  { feature: "Dedicated CSM",            free: "—",              starter: "—",        pro: "—",          enterprise: "✓" },
  { feature: "SLA",                      free: "—",              starter: "—",        pro: "—",          enterprise: "✓" },
];

export default function PricingPage() {
  return (
    <div style={{ background: "var(--bg-0)", color: "var(--text-0)", fontFamily: "var(--font-sans)", minHeight: "100vh" }}>
      {/* Minimal nav */}
      <header style={{ borderBottom: "1px solid var(--border-0)", padding: "0 24px", height: 52, display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 1140, margin: "0 auto" }}>
        <Link href="/" style={{ fontSize: 15, fontWeight: 700, color: "var(--text-0)", textDecoration: "none", letterSpacing: "-0.02em" }}>← Backhaul</Link>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/auth/login" style={{ fontSize: 12.5, color: "var(--text-2)", textDecoration: "none", padding: "6px 14px", borderRadius: 7, border: "1px solid var(--border-1)" }}>Sign in</Link>
          <Link href="/auth/signup" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--accent-fg)", textDecoration: "none", padding: "6px 14px", borderRadius: 7, background: "var(--accent)" }}>Start free trial</Link>
        </div>
      </header>

      <div style={{ maxWidth: 1140, margin: "0 auto", padding: "64px 24px 80px" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <h1 style={{ fontSize: "clamp(28px, 4.5vw, 52px)", fontWeight: 800, letterSpacing: "-0.04em", margin: "0 0 14px" }}>Simple pricing</h1>
          <p style={{ fontSize: 16, color: "var(--text-2)", maxWidth: 480, margin: "0 auto" }}>
            Start with the demo — no sign-up required. Upgrade when you go live.
          </p>
        </div>

        {/* Tier cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14, marginBottom: 64 }}>
          {TIERS.map((tier) => (
            <div key={tier.name} style={{
              background: tier.highlight ? "linear-gradient(160deg, oklch(0.74 0.13 225 / 0.08), oklch(0.72 0.16 305 / 0.04))" : "var(--bg-1)",
              border: `1px solid ${tier.highlight ? "oklch(0.74 0.13 225 / 0.4)" : "var(--border-0)"}`,
              borderRadius: 16, padding: "24px 24px 20px", display: "flex", flexDirection: "column",
            }}>
              {tier.highlight && (
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Most popular</div>
              )}
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-0)", marginBottom: 4 }}>{tier.name}</div>
              <div style={{ marginBottom: 4 }}>
                <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text-0)" }}>{tier.price}</span>
                {tier.price !== "Custom" && <span style={{ fontSize: 12, color: "var(--text-3)", marginLeft: 6 }}>{tier.period}</span>}
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text-3)", marginBottom: 20, lineHeight: 1.5 }}>{tier.desc}</div>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                {tier.features.map((f) => (
                  <li key={f} style={{ display: "flex", gap: 8, fontSize: 12.5, color: "var(--text-1)" }}>
                    <span style={{ color: "var(--success)", flexShrink: 0 }}>✓</span>{f}
                  </li>
                ))}
              </ul>
              <Link href={tier.ctaHref} style={{
                display: "block", textAlign: "center", padding: "10px 16px", borderRadius: 9,
                background: tier.highlight ? "var(--accent)" : "var(--bg-3)",
                border: tier.highlight ? "none" : "1px solid var(--border-1)",
                color: tier.highlight ? "var(--accent-fg)" : "var(--text-1)",
                textDecoration: "none", fontSize: 13, fontWeight: 600,
              }}>
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* Comparison table */}
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-0)", marginBottom: 16 }}>Full feature comparison</h2>
          <div style={{ border: "1px solid var(--border-0)", borderRadius: 12, overflow: "hidden" }}>
            {/* Header */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", background: "var(--bg-2)", padding: "10px 16px", borderBottom: "1px solid var(--border-0)" }}>
              {["Feature", "Demo", "Starter", "Pro", "Enterprise"].map((h) => (
                <div key={h} style={{ fontSize: 11, fontWeight: 700, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</div>
              ))}
            </div>
            {COMPARISON.map((row, i) => (
              <div key={row.feature} style={{
                display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
                padding: "9px 16px",
                background: i % 2 === 0 ? "var(--bg-1)" : "var(--bg-0)",
                borderBottom: i < COMPARISON.length - 1 ? "1px solid var(--border-0)" : "none",
              }}>
                <div style={{ fontSize: 13, color: "var(--text-1)" }}>{row.feature}</div>
                {[row.free, row.starter, row.pro, row.enterprise].map((v, j) => (
                  <div key={j} style={{ fontSize: 12.5, color: v === "✓" ? "var(--success)" : v === "—" ? "var(--text-3)" : "var(--text-1)", fontFamily: v === "✓" || v === "—" ? undefined : "var(--font-mono)" }}>{v}</div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* FAQ teaser */}
        <div style={{ marginTop: 64, textAlign: "center" }}>
          <p style={{ fontSize: 14, color: "var(--text-2)", marginBottom: 16 }}>
            Questions? The demo answers most of them in 60 seconds.
          </p>
          <Link href="/demo/dashboard" style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            fontSize: 13.5, fontWeight: 600, color: "var(--accent)", textDecoration: "none",
            padding: "10px 20px", borderRadius: 8, border: "1px solid oklch(0.74 0.13 225 / 0.4)",
            background: "oklch(0.74 0.13 225 / 0.08)",
          }}>
            View live demo →
          </Link>
        </div>
      </div>
    </div>
  );
}
