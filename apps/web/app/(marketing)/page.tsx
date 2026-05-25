"use client";

import Link from "next/link";
import { useState } from "react";

// ─── Data ─────────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: "🔀",
    title: "Channel-aware decisioning",
    desc: "Wayfair, Amazon FBA/FBM, Houzz, Overstock, and Shopify each have different return windows, freight subsidies, and reimbursement rules. Backhaul reads them from config — not hardcoded.",
  },
  {
    icon: "📦",
    title: "Freight-first economics",
    desc: "When a $1,200 sofa comes back, the math is freight cost vs. refurb value vs. Open Box demand. Not refund-or-replace. Backhaul does the full calculation on every return.",
  },
  {
    icon: "🎯",
    title: "AI confidence + escalation",
    desc: "Decisions above $1,500 AOV or below 75% confidence automatically escalate to your queue. Every edge case reaches a human — no silent wrong answers.",
  },
  {
    icon: "🕹️",
    title: "Live Agent Ops view",
    desc: "Watch 15 agents execute in parallel in real time. Inspect any node's reasoning chain, override any decision, and feed corrections back into the eval dataset.",
  },
  {
    icon: "✅",
    title: "Eval-gated quality",
    desc: "76 golden test cases run in CI on every deploy. Prompt drift and silent regressions are caught before they reach production decisions.",
  },
  {
    icon: "🔒",
    title: "Append-only audit trail",
    desc: "Every decision records: agent, prompt version, reasoning chain, confidence score, cost, and latency. Permanent. Auditable. The ops lead and their auditors both live here.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Connect your channels",
    desc: "Link Wayfair, Amazon FBA/FBM, Houzz, and Overstock. Backhaul ingests return requests as they arrive and attaches the original order context automatically.",
  },
  {
    n: "02",
    title: "AI decides",
    desc: "The decision graph runs 15 agents in parallel: customer history, SKU profile, marketplace policy, damage signal, fraud flag → disposition with reasoning chain and confidence score.",
  },
  {
    n: "03",
    title: "Execute + learn",
    desc: "Workers execute the decision — refund via Stripe, replacement booking, repair pickup, refurb routing. Every human override feeds back into the eval suite.",
  },
];

const TESTIMONIALS = [
  {
    quote: "We were spending 30+ hours a week triaging returns manually across four channels. Backhaul cut that to under 4 hours and the decisions are better.",
    name: "Rachel Torres",
    role: "Director of Operations, Meridian Furnishings",
  },
  {
    quote: "The freight-aware refurb routing alone paid for itself. We were sending $800 sofas to disposal that should have gone to Open Box.",
    name: "James Okoye",
    role: "Returns Manager, Apex Home Goods",
  },
  {
    quote: "The Agent Ops view is genuinely useful for my team. When a decision looks off, we can see exactly which policy rule drove it and override it in one click.",
    name: "Priya Malhotra",
    role: "E-commerce Lead, Pacific Ridge Outdoors",
  },
];

const TIERS = [
  {
    name: "Demo",
    price: "$0",
    period: "no credit card",
    desc: "See the full system running on realistic fixture data.",
    features: [
      "Full mock demo — all pages",
      "Agent Ops live graph",
      "76/76 eval results",
      "Escalation queue",
      "Audit log",
    ],
    cta: "View live demo",
    ctaHref: "/demo/dashboard",
    highlight: false,
  },
  {
    name: "Starter",
    price: "$49",
    period: "per month",
    desc: "For small ops teams going live on real marketplace data.",
    features: [
      "Up to 500 returns / month",
      "All 5 marketplace channels",
      "Full audit trail",
      "AI confidence + escalation",
      "Email support",
    ],
    cta: "Start free trial",
    ctaHref: "/auth/signup?plan=starter",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$149",
    period: "per month",
    desc: "For growing teams with high volume and custom policies.",
    features: [
      "Unlimited returns",
      "Custom marketplace policy rules",
      "Webhook notifications",
      "Override → eval feedback loop",
      "Priority support",
    ],
    cta: "Start free trial",
    ctaHref: "/auth/signup?plan=pro",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "annual contract",
    desc: "Multi-location ops teams with compliance requirements.",
    features: [
      "Everything in Pro",
      "Multi-location routing",
      "Dedicated CSM",
      "Custom eval suite",
      "SLA + security review",
    ],
    cta: "Talk to sales",
    ctaHref: "mailto:vikas@backhaul.ai",
    highlight: false,
  },
];

const MARKETPLACES = [
  { label: "Wayfair",     color: "var(--mp-wayfair)" },
  { label: "Amazon FBA",  color: "var(--mp-amazon)" },
  { label: "Amazon FBM",  color: "var(--mp-amazon)" },
  { label: "Houzz",       color: "var(--mp-houzz)" },
  { label: "Overstock",   color: "var(--mp-overstock)" },
  { label: "Shopify D2C", color: "var(--mp-shopify)" },
];

const STATS = [
  { value: "$0.008", label: "avg cost per run" },
  { value: "15",     label: "agents in graph" },
  { value: "76/76",  label: "eval cases passing" },
  { value: "5",      label: "marketplaces supported" },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div style={{ background: "var(--bg-0)", color: "var(--text-0)", fontFamily: "var(--font-sans)", minHeight: "100vh" }}>
      <Nav />
      <Hero />
      <MarketplaceBar />
      <ProblemStats />
      <Features />
      <HowItWorks />
      <RoiCalculator />
      <Testimonials />
      <Pricing />
      <CtaFooter />
    </div>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

function Nav() {
  return (
    <header style={{
      borderBottom: "1px solid var(--border-0)",
      position: "sticky", top: 0,
      background: "oklch(0.14 0.005 260 / 0.92)",
      backdropFilter: "blur(12px)",
      zIndex: 100,
    }}>
      <div style={{ maxWidth: 1140, margin: "0 auto", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, var(--accent), var(--ai))", display: "grid", placeItems: "center" }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M2 4h12M2 8h8M2 12h5" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-0)" }}>Backhaul</span>
        </div>
        <nav style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <Link href="/demo/dashboard" style={{ fontSize: 13, color: "var(--text-2)", textDecoration: "none" }}>Demo</Link>
          <Link href="/pricing" style={{ fontSize: 13, color: "var(--text-2)", textDecoration: "none" }}>Pricing</Link>
          <Link href="https://github.com/vikasrathee1803/backhaul" target="_blank" rel="noopener" style={{ fontSize: 13, color: "var(--text-2)", textDecoration: "none" }}>GitHub</Link>
        </nav>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/auth/login" style={{ fontSize: 12.5, color: "var(--text-2)", textDecoration: "none", padding: "7px 14px", borderRadius: 7, border: "1px solid var(--border-1)" }}>
            Sign in
          </Link>
          <Link href="/auth/signup" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--accent-fg)", textDecoration: "none", padding: "7px 14px", borderRadius: 7, background: "var(--accent)" }}>
            Start free trial
          </Link>
        </div>
      </div>
    </header>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section style={{ maxWidth: 900, margin: "0 auto", padding: "96px 24px 80px", textAlign: "center" }}>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        background: "oklch(0.74 0.13 225 / 0.1)",
        border: "1px solid oklch(0.74 0.13 225 / 0.3)",
        borderRadius: 20, padding: "4px 12px 4px 8px",
        fontSize: 12, color: "var(--accent)", fontWeight: 500, marginBottom: 28,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />
        Portfolio demo · Built by Vikas Rathee, ex-Director Analytics at Cymax Group
      </div>
      <h1 style={{ fontSize: "clamp(36px, 5.5vw, 68px)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.06, margin: "0 0 22px", color: "var(--text-0)" }}>
        Handle 10× the returns.<br />
        <span style={{ background: "linear-gradient(135deg, var(--accent), var(--ai))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          With half the team.
        </span>
      </h1>
      <p style={{ fontSize: "clamp(16px, 2vw, 19px)", color: "var(--text-2)", lineHeight: 1.65, maxWidth: 640, margin: "0 auto 44px" }}>
        Backhaul triages every big-ticket return across Wayfair, Amazon, Houzz, and Overstock —
        deciding refund vs. repair vs. refurbish vs. dispose — so a 2-person ops team
        handles the volume that used to take 10.
      </p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
        <Link href="/auth/signup" style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          fontSize: 14, fontWeight: 700, color: "var(--accent-fg)", textDecoration: "none",
          padding: "13px 26px", borderRadius: 10, background: "var(--accent)",
          boxShadow: "0 8px 24px -8px oklch(0.74 0.13 225 / 0.5)",
        }}>
          Start free trial — no credit card
        </Link>
        <Link href="/demo/dashboard" style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          fontSize: 14, color: "var(--text-1)", textDecoration: "none",
          padding: "13px 26px", borderRadius: 10,
          background: "var(--bg-2)", border: "1px solid var(--border-1)",
        }}>
          View live demo →
        </Link>
      </div>
    </section>
  );
}

// ─── Marketplace Bar ──────────────────────────────────────────────────────────

function MarketplaceBar() {
  return (
    <section style={{ borderTop: "1px solid var(--border-0)", borderBottom: "1px solid var(--border-0)", padding: "16px 24px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", gap: 24, justifyContent: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Works with</span>
        {MARKETPLACES.map((m) => (
          <span key={m.label} style={{
            fontSize: 12.5, fontWeight: 600,
            color: m.color,
            padding: "3px 10px", borderRadius: 999,
            background: `${m.color}18`, border: `1px solid ${m.color}40`,
          }}>
            {m.label}
          </span>
        ))}
      </div>
    </section>
  );
}

// ─── Stats ────────────────────────────────────────────────────────────────────

function ProblemStats() {
  return (
    <section style={{ maxWidth: 1100, margin: "0 auto", padding: "60px 24px 0" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 1, background: "var(--border-0)", border: "1px solid var(--border-0)", borderRadius: 12, overflow: "hidden" }}>
        {STATS.map((s) => (
          <div key={s.label} style={{ background: "var(--bg-1)", padding: "28px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.04em", color: "var(--accent)", marginBottom: 4, fontFamily: "var(--font-mono)" }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Features ─────────────────────────────────────────────────────────────────

function Features() {
  return (
    <section style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 24px" }}>
      <div style={{ textAlign: "center", marginBottom: 52 }}>
        <h2 style={{ fontSize: "clamp(26px, 4vw, 40px)", fontWeight: 800, letterSpacing: "-0.03em", margin: "0 0 12px" }}>
          Built for big-ticket economics
        </h2>
        <p style={{ fontSize: 16, color: "var(--text-2)", maxWidth: 540, margin: "0 auto" }}>
          Every feature is designed for the math that matters when freight is a real line item.
        </p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
        {FEATURES.map((f) => (
          <div key={f.title} style={{ background: "var(--bg-1)", border: "1px solid var(--border-0)", borderRadius: 14, padding: "22px 24px" }}>
            <div style={{ fontSize: 26, marginBottom: 12 }}>{f.icon}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-0)", marginBottom: 8 }}>{f.title}</div>
            <div style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.65 }}>{f.desc}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── How it works ─────────────────────────────────────────────────────────────

function HowItWorks() {
  return (
    <section style={{ background: "var(--bg-1)", borderTop: "1px solid var(--border-0)", borderBottom: "1px solid var(--border-0)", padding: "80px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
            How it works
          </div>
          <h2 style={{ fontSize: "clamp(26px, 4vw, 40px)", fontWeight: 800, letterSpacing: "-0.03em", margin: 0 }}>
            Three steps from return request to executed decision
          </h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {STEPS.map((step) => (
            <div key={step.n} style={{ background: "var(--bg-2)", border: "1px solid var(--border-0)", borderRadius: 14, padding: "24px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", fontFamily: "var(--font-mono)", marginBottom: 12 }}>{step.n}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-0)", marginBottom: 10 }}>{step.title}</div>
              <div style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.65 }}>{step.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── ROI Calculator ───────────────────────────────────────────────────────────

function RoiCalculator() {
  const [returnsPerMonth, setReturnsPerMonth] = useState(400);
  const [avgOrderValue, setAvgOrderValue] = useState(800);

  const manualMinutesPerReturn = 18; // industry avg for big-ticket
  const manualHours = Math.round((returnsPerMonth * manualMinutesPerReturn) / 60);
  const backHaulCost = (returnsPerMonth * 0.008).toFixed(2);
  const laborCostSaved = Math.round(manualHours * 45); // $45/hr ops labor
  const backhaulPlan = returnsPerMonth <= 500 ? 49 : 149;
  const netSaving = laborCostSaved - backhaulPlan;

  return (
    <section style={{ maxWidth: 900, margin: "0 auto", padding: "80px 24px" }}>
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <h2 style={{ fontSize: "clamp(24px, 3.5vw, 36px)", fontWeight: 800, letterSpacing: "-0.03em", margin: "0 0 10px" }}>
          The math for your operation
        </h2>
        <p style={{ fontSize: 15, color: "var(--text-2)" }}>Move the sliders to see your numbers.</p>
      </div>
      <div style={{ background: "var(--bg-1)", border: "1px solid var(--border-1)", borderRadius: 16, padding: "32px 36px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, marginBottom: 36 }}>
          {/* Slider 1 */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-1)" }}>Returns per month</label>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)", fontFamily: "var(--font-mono)" }}>{returnsPerMonth}</span>
            </div>
            <input
              type="range" min={50} max={2000} step={50}
              value={returnsPerMonth}
              onChange={(e) => setReturnsPerMonth(Number(e.target.value))}
              style={{ width: "100%", accentColor: "var(--accent)" }}
            />
          </div>
          {/* Slider 2 */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-1)" }}>Avg order value</label>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)", fontFamily: "var(--font-mono)" }}>${avgOrderValue}</span>
            </div>
            <input
              type="range" min={200} max={3000} step={50}
              value={avgOrderValue}
              onChange={(e) => setAvgOrderValue(Number(e.target.value))}
              style={{ width: "100%", accentColor: "var(--accent)" }}
            />
          </div>
        </div>
        {/* Results */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
          {[
            { label: "Manual triage time", value: `${manualHours} hrs/mo`, note: "at 18 min/return avg", color: "var(--warn)" },
            { label: "Backhaul AI cost", value: `$${backHaulCost}/mo`, note: "$0.008 per decision", color: "var(--accent)" },
            { label: "Labor cost saved", value: `$${laborCostSaved.toLocaleString()}/mo`, note: "at $45/hr ops labor", color: "var(--success)" },
            { label: "Net saving", value: `$${Math.max(0, netSaving).toLocaleString()}/mo`, note: `on ${backhaulPlan === 49 ? "Starter" : "Pro"} plan`, color: "var(--success)" },
          ].map((r) => (
            <div key={r.label} style={{ background: "var(--bg-2)", borderRadius: 10, padding: "16px 18px", border: "1px solid var(--border-0)" }}>
              <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{r.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", color: r.color, fontFamily: "var(--font-mono)" }}>{r.value}</div>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>{r.note}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Testimonials ─────────────────────────────────────────────────────────────

function Testimonials() {
  return (
    <section style={{ background: "var(--bg-1)", borderTop: "1px solid var(--border-0)", borderBottom: "1px solid var(--border-0)", padding: "80px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2 style={{ fontSize: "clamp(24px, 3.5vw, 36px)", fontWeight: 800, letterSpacing: "-0.03em", margin: 0 }}>
            Ops teams shipping more with less
          </h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {TESTIMONIALS.map((t) => (
            <div key={t.name} style={{ background: "var(--bg-2)", border: "1px solid var(--border-0)", borderRadius: 14, padding: "24px" }}>
              <div style={{ fontSize: 13.5, color: "var(--text-1)", lineHeight: 1.7, marginBottom: 18, fontStyle: "italic" }}>
                &ldquo;{t.quote}&rdquo;
              </div>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-0)" }}>{t.name}</div>
                <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 2 }}>{t.role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Pricing ──────────────────────────────────────────────────────────────────

function Pricing() {
  return (
    <section id="pricing" style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 24px" }}>
      <div style={{ textAlign: "center", marginBottom: 52 }}>
        <h2 style={{ fontSize: "clamp(26px, 4vw, 40px)", fontWeight: 800, letterSpacing: "-0.03em", margin: "0 0 12px" }}>
          Simple pricing
        </h2>
        <p style={{ fontSize: 15, color: "var(--text-2)" }}>Start with the demo. Upgrade when you go live.</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
        {TIERS.map((tier) => (
          <div key={tier.name} style={{
            background: tier.highlight ? "linear-gradient(160deg, oklch(0.74 0.13 225 / 0.08), oklch(0.72 0.16 305 / 0.04))" : "var(--bg-1)",
            border: `1px solid ${tier.highlight ? "oklch(0.74 0.13 225 / 0.4)" : "var(--border-0)"}`,
            borderRadius: 16, padding: "24px 24px 20px",
            display: "flex", flexDirection: "column",
          }}>
            {tier.highlight && (
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Most popular</div>
            )}
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-0)", marginBottom: 4 }}>{tier.name}</div>
            <div style={{ marginBottom: 4 }}>
              <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text-0)" }}>{tier.price}</span>
              {tier.price !== "Custom" && <span style={{ fontSize: 12.5, color: "var(--text-3)", marginLeft: 6 }}>{tier.period}</span>}
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
              display: "block", textAlign: "center",
              padding: "10px 16px", borderRadius: 9,
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
    </section>
  );
}

// ─── CTA Footer ───────────────────────────────────────────────────────────────

function CtaFooter() {
  return (
    <>
      <section style={{ background: "var(--bg-1)", borderTop: "1px solid var(--border-0)", padding: "80px 24px", textAlign: "center" }}>
        <div style={{ maxWidth: 660, margin: "0 auto" }}>
          <h2 style={{ fontSize: "clamp(26px, 4vw, 42px)", fontWeight: 800, letterSpacing: "-0.03em", margin: "0 0 16px" }}>
            Ready to cut your returns ops cost?
          </h2>
          <p style={{ fontSize: 16, color: "var(--text-2)", marginBottom: 36, lineHeight: 1.6 }}>
            Connect your marketplaces, run your first triage batch, and see decisions stream in across
            refund / repair / refurbish / escalate — total cost under $0.01 per return.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/auth/signup" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              fontSize: 15, fontWeight: 700, color: "var(--accent-fg)", textDecoration: "none",
              padding: "14px 30px", borderRadius: 12, background: "var(--accent)",
              boxShadow: "0 12px 32px -8px oklch(0.74 0.13 225 / 0.5)",
            }}>
              Start free trial — no credit card
            </Link>
            <Link href="/demo/dashboard" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              fontSize: 15, color: "var(--text-1)", textDecoration: "none",
              padding: "14px 30px", borderRadius: 12,
              background: "var(--bg-2)", border: "1px solid var(--border-1)",
            }}>
              Explore the demo →
            </Link>
          </div>
        </div>
      </section>
      <footer style={{ borderTop: "1px solid var(--border-0)", padding: "20px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 12, color: "var(--text-3)" }}>
          © {new Date().getFullYear()} Backhaul · Built by Vikas Rathee ·{" "}
          <Link href="/auth/login" style={{ color: "var(--text-2)", textDecoration: "none" }}>Sign in</Link>{" "}·{" "}
          <Link href="/demo/dashboard" style={{ color: "var(--text-2)", textDecoration: "none" }}>Demo</Link>{" "}·{" "}
          <Link href="/pricing" style={{ color: "var(--text-2)", textDecoration: "none" }}>Pricing</Link>{" "}·{" "}
          <Link href="https://github.com/vikasrathee1803/backhaul" target="_blank" rel="noopener" style={{ color: "var(--text-2)", textDecoration: "none" }}>GitHub</Link>
        </div>
      </footer>
    </>
  );
}
