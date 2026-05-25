"use client";

import { TopBar } from "@/components/shared/TopBar";
import { DEMO_RETURNS, DEMO_WORKSPACE } from "@/app/demo/_mock/data";
import Link from "next/link";

const MARKETPLACE_LABEL: Record<string, string> = {
  wayfair: "Wayfair", amazon_fba: "Amazon FBA", amazon_fbm: "Amazon FBM",
  houzz: "Houzz", overstock: "Overstock", shopify: "Shopify",
};

const MARKETPLACE_COLOR: Record<string, string> = {
  wayfair: "var(--mp-wayfair)", amazon_fba: "var(--mp-amazon)", amazon_fbm: "var(--mp-amazon)",
  houzz: "var(--mp-houzz)", overstock: "var(--mp-overstock)", shopify: "var(--mp-shopify)",
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0 })}`;
}

export default function EscalationsPage() {
  const escalated = DEMO_RETURNS.filter((r) => r.status === "escalated");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar
        workspaceName={DEMO_WORKSPACE.name}
        title="Escalations"
        plan={DEMO_WORKSPACE.plan}
      />

      <div className="scroll" style={{ flex: 1, minHeight: 0 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 28px 40px" }}>

          {/* Heading */}
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text-0)" }}>
              Escalation queue
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 13.5, color: "var(--text-2)" }}>
              {escalated.length} return{escalated.length !== 1 ? "s" : ""} awaiting human review — AI confidence below threshold or AOV exceeds auto-decide ceiling
            </p>
          </div>

          {escalated.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-3)" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
              <div style={{ fontSize: 14 }}>No escalations — all returns auto-resolved.</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {escalated.map((r) => (
                <div
                  key={r.id}
                  className="card"
                  style={{
                    padding: "20px 24px",
                    borderLeft: "3px solid var(--disposition-escalate)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                    {/* Left: return info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                        <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 13, fontWeight: 700, color: "var(--text-0)" }}>
                          {r.id}
                        </span>
                        <span className="badge" style={{
                          color: MARKETPLACE_COLOR[r.marketplace] ?? "var(--text-2)",
                          background: `${MARKETPLACE_COLOR[r.marketplace] ?? "var(--text-2)"}18`,
                          border: `1px solid ${MARKETPLACE_COLOR[r.marketplace] ?? "var(--text-2)"}40`,
                          fontSize: 10,
                        }}>
                          {MARKETPLACE_LABEL[r.marketplace] ?? r.marketplace}
                        </span>
                        <span className="badge" style={{
                          color: "var(--disposition-escalate)",
                          background: "oklch(0.68 0.2 30 / 0.12)",
                          border: "1px solid oklch(0.68 0.2 30 / 0.4)",
                          fontSize: 10,
                        }}>
                          ESCALATED
                        </span>
                        {r.customer.fraud_flag && (
                          <span className="badge" style={{ color: "var(--danger)", background: "var(--danger)18", border: "1px solid var(--danger)40", fontSize: 10 }}>
                            ⚠ Fraud flag
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: 13.5, color: "var(--text-0)", marginBottom: 4 }}>
                        {r.sku.name}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 12 }}>
                        {r.customer.name} · AOV {formatCents(r.order_total_cents)} · freight {formatCents(r.inbound_freight_cost_cents)}
                      </div>

                      {/* AI reasoning */}
                      {r.decision && (
                        <div style={{
                          background: "var(--bg-2)", borderRadius: "var(--radius)",
                          padding: "12px 14px", border: "1px solid var(--border-0)",
                        }}>
                          <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                            AI escalation reason
                          </div>
                          <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-1)", lineHeight: 1.65 }}>
                            {r.decision.reasoning}
                          </p>
                          <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 11, fontFamily: "var(--font-geist-mono)", color: "var(--text-3)" }}>
                            <span>Confidence: {(r.decision.confidence * 100).toFixed(0)}%</span>
                            <span>Model: {r.decision.model}</span>
                            <span>Cost: ${r.decision.cost_usd.toFixed(4)}</span>
                          </div>
                        </div>
                      )}

                      {/* Candidate dispositions */}
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                          Candidate dispositions
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {["repair", "replace", "refurbish"].map((d) => (
                            <button
                              key={d}
                              style={{
                                padding: "6px 14px", borderRadius: "var(--radius)",
                                background: "var(--bg-3)", border: "1px solid var(--border-1)",
                                color: "var(--text-1)", fontSize: 12.5, cursor: "pointer",
                                transition: "border-color 0.12s, color 0.12s",
                              }}
                              onMouseEnter={(e) => {
                                (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
                                (e.currentTarget as HTMLElement).style.color = "var(--accent)";
                              }}
                              onMouseLeave={(e) => {
                                (e.currentTarget as HTMLElement).style.borderColor = "var(--border-1)";
                                (e.currentTarget as HTMLElement).style.color = "var(--text-1)";
                              }}
                            >
                              {d}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Right: actions */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
                      <Link
                        href={`/demo/returns/${r.id}`}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "center",
                          height: 32, padding: "0 14px",
                          background: "var(--accent)", color: "var(--accent-fg)",
                          borderRadius: 6, fontSize: 12.5, fontWeight: 600, textDecoration: "none",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Review →
                      </Link>
                      <button
                        style={{
                          height: 32, padding: "0 14px",
                          background: "var(--bg-3)", border: "1px solid var(--border-1)",
                          borderRadius: 6, fontSize: 12.5, color: "var(--text-1)", cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
