"use client";

import { TopBar } from "@/components/shared/TopBar";
import { DEMO_RETURNS, DEMO_WORKSPACE } from "@/app/demo/_mock/data";
import Link from "next/link";

const DISPOSITION_COLOR: Record<string, string> = {
  refund: "var(--disposition-refund)",
  replace: "var(--disposition-replace)",
  repair: "var(--disposition-repair)",
  refurbish: "var(--disposition-refurb)",
  donate: "var(--warn)",
  dispose: "var(--text-3)",
  escalate: "var(--disposition-escalate)",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function AuditPage() {
  const decided = DEMO_RETURNS.filter(
    (r) => r.status === "decided" || r.status === "escalated"
  ).filter((r) => r.decision !== undefined);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar
        workspaceName={DEMO_WORKSPACE.name}
        title="Audit Log"
        plan={DEMO_WORKSPACE.plan}
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              padding: "3px 10px", borderRadius: 999,
              background: "var(--accent-soft)", border: "1px solid oklch(0.74 0.13 225 / 0.3)",
              fontSize: 11, fontWeight: 600, color: "var(--accent)",
              letterSpacing: 0.4,
            }}>
              APPEND-ONLY
            </span>
          </div>
        }
      />

      <div className="scroll" style={{ flex: 1, minHeight: 0 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 28px 40px" }}>

          {/* Heading */}
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text-0)" }}>
              Decision audit log
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 13.5, color: "var(--text-2)" }}>
              Every AI decision — append-only, immutable. {decided.length} records.
            </p>
          </div>

          {/* Table */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {/* Header */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "140px 110px 100px 80px 110px 60px 1fr",
              padding: "8px 16px", borderBottom: "1px solid var(--border-0)",
              background: "var(--bg-2)",
            }}>
              {["Timestamp", "Return ID", "Disposition", "Confidence", "Model", "Cost", "Reasoning excerpt"].map((h) => (
                <div key={h} style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</div>
              ))}
            </div>

            {decided.map((r) => (
              <div
                key={r.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "140px 110px 100px 80px 110px 60px 1fr",
                  padding: "10px 16px",
                  borderBottom: "1px solid var(--border-0)",
                  alignItems: "center",
                }}
              >
                {/* Timestamp */}
                <span style={{ fontSize: 11.5, fontFamily: "var(--font-geist-mono)", color: "var(--text-3)" }}>
                  {formatDate(r.return_requested_at)}
                </span>

                {/* Return ID */}
                <Link
                  href={`/demo/returns/${r.id}`}
                  style={{ fontFamily: "var(--font-geist-mono)", fontSize: 12, color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}
                >
                  {r.id}
                </Link>

                {/* Disposition */}
                <span className="badge" style={{
                  color: DISPOSITION_COLOR[r.decision!.disposition] ?? "var(--text-2)",
                  background: `${DISPOSITION_COLOR[r.decision!.disposition] ?? "var(--text-2)"}18`,
                  border: `1px solid ${DISPOSITION_COLOR[r.decision!.disposition] ?? "var(--text-2)"}40`,
                  fontSize: 10, whiteSpace: "nowrap",
                }}>
                  {r.decision!.disposition}
                </span>

                {/* Confidence */}
                <span style={{
                  fontSize: 12.5, fontFamily: "var(--font-geist-mono)",
                  color: r.decision!.confidence >= 0.8 ? "var(--success)" : "var(--warn)",
                }}>
                  {(r.decision!.confidence * 100).toFixed(0)}%
                </span>

                {/* Model */}
                <span style={{ fontSize: 11, fontFamily: "var(--font-geist-mono)", color: "var(--ai)" }}>
                  {r.decision!.model.replace("claude-", "").replace("-4-6", "-4.6").slice(0, 12)}
                </span>

                {/* Cost */}
                <span style={{ fontSize: 11.5, fontFamily: "var(--font-geist-mono)", color: "var(--success)" }}>
                  ${r.decision!.cost_usd.toFixed(4)}
                </span>

                {/* Reasoning excerpt */}
                <span style={{
                  fontSize: 12, color: "var(--text-2)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {r.decision!.reasoning.slice(0, 90)}{r.decision!.reasoning.length > 90 ? "…" : ""}
                </span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 16, fontSize: 12, color: "var(--text-3)", fontFamily: "var(--font-geist-mono)" }}>
            ↑ All entries are immutable once written. Overrides create new entries — they do not modify existing ones.
          </div>
        </div>
      </div>
    </div>
  );
}
