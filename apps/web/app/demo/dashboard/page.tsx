"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/shared/TopBar";
import { DemoDetailPanel, returnToDetail, type DemoDetailItem } from "@/components/demo/DemoDetailPanel";
import { DEMO_RETURNS, DEMO_WORKSPACE, type ReturnItem } from "@/app/demo/_mock/data";

// ── Marketplace display config ────────────────────────────────────────────────
const MARKETPLACE_LABEL: Record<string, string> = {
  wayfair: "Wayfair",
  amazon_fba: "Amazon FBA",
  amazon_fbm: "Amazon FBM",
  houzz: "Houzz",
  overstock: "Overstock",
  shopify: "Shopify",
};

const MARKETPLACE_COLOR: Record<string, string> = {
  wayfair: "var(--mp-wayfair)",
  amazon_fba: "var(--mp-amazon)",
  amazon_fbm: "var(--mp-amazon)",
  houzz: "var(--mp-houzz)",
  overstock: "var(--mp-overstock)",
  shopify: "var(--mp-shopify)",
};

const DISPOSITION_COLOR: Record<string, string> = {
  refund: "var(--disposition-refund)",
  replace: "var(--disposition-replace)",
  repair: "var(--disposition-repair)",
  refurbish: "var(--disposition-refurb)",
  donate: "var(--warn)",
  dispose: "var(--text-3)",
  escalate: "var(--disposition-escalate)",
};

const STATUS_COLOR: Record<string, string> = {
  pending_triage: "var(--text-3)",
  triaging: "var(--warn)",
  decided: "var(--success)",
  escalated: "var(--disposition-escalate)",
  resolved: "var(--success)",
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function DashboardPage() {
  const router = useRouter();
  const [detail, setDetail] = useState<DemoDetailItem | null>(null);
  const [isTriaging, setIsTriaging] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const ws = DEMO_WORKSPACE;

  const pendingCount = DEMO_RETURNS.filter((r) => r.status === "pending_triage").length;
  const decidedCount = DEMO_RETURNS.filter((r) => r.status === "decided").length;
  const escalatedCount = DEMO_RETURNS.filter((r) => r.status === "escalated").length;

  const handleRowClick = useCallback((r: ReturnItem) => {
    setDetail(returnToDetail(r));
  }, []);

  const handleRunTriage = useCallback(async () => {
    setIsTriaging(true);
    try {
      const ids = selectedIds.size > 0
        ? Array.from(selectedIds)
        : DEMO_RETURNS.filter((r) => r.status === "pending_triage").map((r) => r.id);

      await fetch("/api/graph/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ return_ids: ids }),
      });
      router.push("/demo/agent-ops");
    } catch {
      setIsTriaging(false);
    }
  }, [router, selectedIds]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar
        workspaceName={ws.name}
        title="Returns Queue"
        plan={ws.plan}
        actions={
          <button
            onClick={handleRunTriage}
            disabled={isTriaging}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              height: 28, padding: "0 14px",
              background: isTriaging ? "var(--bg-3)" : "var(--accent)",
              color: isTriaging ? "var(--text-2)" : "var(--accent-fg)",
              border: "none", borderRadius: 6, fontSize: 12.5, fontWeight: 600,
              cursor: isTriaging ? "not-allowed" : "pointer",
              transition: "background 0.12s",
            }}
          >
            {isTriaging ? (
              <><span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>◉</span> Running…</>
            ) : (
              <><span>▶</span> Run triage</>
            )}
          </button>
        }
      />

      <div className="scroll" style={{ flex: 1, minHeight: 0 }}>
        <div style={{ maxWidth: 1320, margin: "0 auto", padding: "24px 28px 40px" }}>

          {/* Heading */}
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text-0)" }}>
              Returns queue
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 13.5, color: "var(--text-2)" }}>
              {DEMO_RETURNS.length} returns across {Object.keys(MARKETPLACE_LABEL).length} channels — {pendingCount} pending triage
            </p>
          </div>

          {/* KPI Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
            {/* Hero */}
            <div className="card" style={{ padding: "20px 20px 16px", position: "relative", overflow: "hidden", borderColor: "oklch(0.68 0.16 22 / 0.4)" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                Pending triage
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <div style={{ fontSize: 48, fontWeight: 800, letterSpacing: "-0.04em", color: "var(--warn)", lineHeight: 1 }}>
                  {pendingCount}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: "50%", background: "var(--warn)",
                    display: "inline-block", animation: "pulse-dot 2s infinite",
                  }} />
                  <span style={{ fontSize: 11.5, color: "var(--warn)", fontWeight: 500 }}>live</span>
                </div>
              </div>
              <div style={{ marginTop: 6, fontSize: 11.5, color: "var(--text-2)" }}>
                Ready for AI triage
              </div>
            </div>

            {/* Supporting KPIs */}
            {[
              { label: "Decided today", value: String(decidedCount), color: "var(--success)", sub: "auto-resolved" },
              { label: "Escalated", value: String(escalatedCount), color: "var(--disposition-escalate)", sub: "needs review" },
              { label: "Avg cost / decision", value: `${ws.avg_cost_per_decision_cents}¢`, color: "var(--text-0)", sub: "well under $0.10 cap" },
            ].map((kpi) => (
              <div key={kpi.label} className="card" style={{ padding: "16px 18px" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                  {kpi.label}
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", color: kpi.color }}>{kpi.value}</div>
                <div style={{ marginTop: 4, fontSize: 11.5, color: "var(--text-2)" }}>{kpi.sub}</div>
              </div>
            ))}
          </div>

          {/* Returns table */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 16px", borderBottom: "1px solid var(--border-0)",
            }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                All returns
              </span>
              {selectedIds.size > 0 && (
                <span style={{ fontSize: 12, color: "var(--accent)" }}>
                  {selectedIds.size} selected — click Run triage to process
                </span>
              )}
            </div>

            {/* Table header */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "24px 120px 1fr 80px 90px 80px 110px 120px",
              gap: 0,
              padding: "8px 16px",
              borderBottom: "1px solid var(--border-0)",
              background: "var(--bg-2)",
            }}>
              {["", "Return ID", "SKU", "AOV", "Marketplace", "Condition", "Status", "Disposition"].map((h) => (
                <div key={h} style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</div>
              ))}
            </div>

            {/* Table rows */}
            {DEMO_RETURNS.map((r) => (
              <div
                key={r.id}
                onClick={() => handleRowClick(r)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "24px 120px 1fr 80px 90px 80px 110px 120px",
                  gap: 0,
                  padding: "10px 16px",
                  borderBottom: "1px solid var(--border-0)",
                  cursor: "pointer",
                  background: selectedIds.has(r.id) ? "var(--accent-soft)" : "transparent",
                  transition: "background 0.1s",
                  alignItems: "center",
                }}
                onMouseEnter={(e) => { if (!selectedIds.has(r.id)) (e.currentTarget as HTMLElement).style.background = "var(--bg-2)"; }}
                onMouseLeave={(e) => { if (!selectedIds.has(r.id)) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                {/* Checkbox */}
                <div
                  onClick={(e) => { e.stopPropagation(); toggleSelect(r.id); }}
                  style={{
                    width: 14, height: 14, borderRadius: 3,
                    border: `1px solid ${selectedIds.has(r.id) ? "var(--accent)" : "var(--border-1)"}`,
                    background: selectedIds.has(r.id) ? "var(--accent)" : "transparent",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {selectedIds.has(r.id) && <span style={{ color: "var(--accent-fg)", fontSize: 9 }}>✓</span>}
                </div>

                {/* Return ID */}
                <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 12, color: "var(--text-0)", fontWeight: 500 }}>
                  {r.id}
                </div>

                {/* SKU */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, color: "var(--text-0)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.sku.name}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 1 }}>
                    {formatDate(r.return_requested_at)}
                  </div>
                </div>

                {/* AOV */}
                <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 12.5, color: "var(--text-0)" }}>
                  {formatCents(r.order_total_cents)}
                </div>

                {/* Marketplace */}
                <div>
                  <span className="badge" style={{
                    color: MARKETPLACE_COLOR[r.marketplace] ?? "var(--text-2)",
                    background: `${MARKETPLACE_COLOR[r.marketplace] ?? "var(--text-2)"}18`,
                    border: `1px solid ${MARKETPLACE_COLOR[r.marketplace] ?? "var(--text-2)"}40`,
                    fontSize: 10, whiteSpace: "nowrap",
                  }}>
                    {MARKETPLACE_LABEL[r.marketplace] ?? r.marketplace}
                  </span>
                </div>

                {/* Condition */}
                <div style={{ fontSize: 12, color: r.condition === "unusable" ? "var(--danger)" : r.condition === "poor" ? "var(--warn)" : "var(--text-1)" }}>
                  {r.condition.replace("_", " ")}
                </div>

                {/* Status */}
                <div>
                  <span className="badge" style={{
                    color: STATUS_COLOR[r.status] ?? "var(--text-2)",
                    background: `${STATUS_COLOR[r.status] ?? "var(--text-2)"}18`,
                    border: `1px solid ${STATUS_COLOR[r.status] ?? "var(--text-2)"}40`,
                    fontSize: 10, whiteSpace: "nowrap",
                  }}>
                    {r.status.replace(/_/g, " ")}
                  </span>
                </div>

                {/* Disposition */}
                <div>
                  {r.decision ? (
                    <span className="badge" style={{
                      color: DISPOSITION_COLOR[r.decision.disposition] ?? "var(--text-2)",
                      background: `${DISPOSITION_COLOR[r.decision.disposition] ?? "var(--text-2)"}18`,
                      border: `1px solid ${DISPOSITION_COLOR[r.decision.disposition] ?? "var(--text-2)"}40`,
                      fontSize: 10, whiteSpace: "nowrap",
                    }}>
                      {r.decision.disposition}
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, color: "var(--text-3)" }}>—</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <DemoDetailPanel item={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
