"use client";

import React, { useEffect } from "react";
import type { ReturnItem } from "@/app/demo/_mock/data";

export type DetailKind = "node" | "governance" | "pipeline" | "doc" | "insight" | "member" | "search-result" | "return";

export interface DemoDetailItem {
  kind: DetailKind;
  title: string;
  subtitle?: string;
  eyebrow?: string;
  eyebrowColor?: string;
  meta?: { label: string; value: string }[];
  summary?: string;
  risks?: { level: string; text: string }[];
  suggestions?: string[];
  related?: { label: string; href: string }[];
}

interface Props {
  item: DemoDetailItem | null;
  onClose: () => void;
}

const RISK_COLOR: Record<string, string> = {
  high: "var(--danger)",
  med: "var(--warn)",
  medium: "var(--warn)",
  low: "var(--success)",
};

export function DemoDetailPanel({ item, onClose }: Props) {
  useEffect(() => {
    if (!item) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [item, onClose]);

  if (!item) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 44,
          background: "rgba(0,0,0,0.18)",
        }}
      />

      {/* Panel */}
      <div
        className="panel-slide-in"
        style={{
          position: "fixed", right: 0, top: 36, bottom: 0, width: 380,
          zIndex: 45, display: "flex", flexDirection: "column",
          background: "var(--bg-1)", borderLeft: "1px solid var(--border-1)",
          boxShadow: "var(--shadow-pop)",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "16px 20px 14px", borderBottom: "1px solid var(--border-0)",
          display: "flex", alignItems: "flex-start", gap: 10, flexShrink: 0,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {item.eyebrow && (
              <div style={{
                fontSize: 10.5, fontWeight: 600, letterSpacing: 0.6,
                textTransform: "uppercase", color: item.eyebrowColor ?? "var(--text-3)",
                marginBottom: 4,
              }}>{item.eyebrow}</div>
            )}
            <div className="mono" style={{ fontSize: 15, fontWeight: 700, color: "var(--text-0)", lineHeight: 1.3 }}>
              {item.title}
            </div>
            {item.subtitle && (
              <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 3 }}>{item.subtitle}</div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--text-3)", fontSize: 18, lineHeight: 1, padding: 2, flexShrink: 0,
            }}
            aria-label="Close"
          >×</button>
        </div>

        {/* Scrollable body */}
        <div className="scroll" style={{ flex: 1, minHeight: 0, padding: "20px 20px 0" }}>

          {/* Meta grid */}
          {item.meta && item.meta.length > 0 && (
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr",
              gap: 12, marginBottom: 20,
              padding: "14px 16px", background: "var(--bg-2)",
              borderRadius: 8, border: "1px solid var(--border-0)",
            }}>
              {item.meta.map((m) => (
                <div key={m.label}>
                  <div style={{ fontSize: 10.5, color: "var(--text-3)", marginBottom: 2 }}>{m.label}</div>
                  <div className="mono" style={{ fontSize: 12.5, color: "var(--text-0)", fontWeight: 500 }}>{m.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Summary */}
          {item.summary && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                AI Reasoning
              </div>
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-1)", lineHeight: 1.65 }}>{item.summary}</p>
            </div>
          )}

          {/* Risks */}
          {item.risks && item.risks.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Risk signals</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {item.risks.map((r, i) => {
                  const c = RISK_COLOR[r.level] ?? "var(--text-3)";
                  return (
                    <div key={i} style={{
                      padding: "10px 12px", borderRadius: 6,
                      background: `${c}10`, borderLeft: `3px solid ${c}`,
                    }}>
                      <div style={{ fontSize: 10.5, fontWeight: 600, color: c, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>{r.level} risk</div>
                      <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-1)", lineHeight: 1.55 }}>{r.text}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Suggestions */}
          {item.suggestions && item.suggestions.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Recommendations</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {item.suggestions.map((s, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, fontSize: 12.5, color: "var(--text-1)", lineHeight: 1.55 }}>
                    <span style={{ color: "var(--ai)", flexShrink: 0 }}>✦</span>
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Related */}
          {item.related && item.related.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Related</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {item.related.map((r) => (
                  <a key={r.href} href={r.href} style={{
                    fontSize: 12.5, color: "var(--accent)", textDecoration: "none",
                    display: "flex", alignItems: "center", gap: 4,
                  }}>
                    <span>→</span><span className="mono">{r.label}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          <div style={{ height: 20 }} />
        </div>
      </div>
    </>
  );
}

// ── Mapping helpers ──────────────────────────────────────────────────────────

export function returnToDetail(r: ReturnItem): DemoDetailItem {
  const dispositionColor: Record<string, string> = {
    refund: "var(--disposition-refund)",
    replace: "var(--disposition-replace)",
    repair: "var(--disposition-repair)",
    refurbish: "var(--disposition-refurb)",
    escalate: "var(--disposition-escalate)",
    donate: "var(--warn)",
    dispose: "var(--text-3)",
  };

  return {
    kind: "return",
    eyebrow: r.decision ? r.decision.disposition.toUpperCase() : r.status.replace("_", " ").toUpperCase(),
    eyebrowColor: r.decision ? (dispositionColor[r.decision.disposition] ?? "var(--text-3)") : "var(--text-3)",
    title: r.id,
    subtitle: `${r.sku.name} · ${r.marketplace.replace("_", " ")}`,
    meta: [
      { label: "Order", value: r.order_id },
      { label: "Customer", value: r.customer.name },
      { label: "AOV", value: `$${(r.order_total_cents / 100).toFixed(2)}` },
      { label: "Freight", value: `$${(r.inbound_freight_cost_cents / 100).toFixed(2)}` },
      { label: "Condition", value: r.condition.replace("_", " ") },
      { label: "Reason", value: r.return_reason.replace(/_/g, " ") },
      ...(r.decision ? [
        { label: "Confidence", value: `${(r.decision.confidence * 100).toFixed(0)}%` },
        { label: "Cost", value: `$${r.decision.cost_usd.toFixed(4)}` },
      ] : []),
    ],
    summary: r.decision?.reasoning ?? r.condition_notes,
    risks: r.customer.fraud_flag ? [{ level: "high", text: "Customer has an active fraud flag — return rate exceeds 50%." }] : [],
    suggestions: r.decision ? [
      `Disposition: ${r.decision.disposition} with ${(r.decision.confidence * 100).toFixed(0)}% confidence.`,
      `Model: ${r.decision.model} — latency ${r.decision.latency_ms}ms.`,
    ] : [
      "Run triage to generate an AI disposition recommendation.",
    ],
    related: [
      { label: "View in Agent Ops", href: "/demo/agent-ops" },
      { label: "Audit log entry", href: "/demo/audit" },
    ],
  };
}
