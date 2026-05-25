"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { TopBar } from "@/components/shared/TopBar";
import { DEMO_RETURNS, DEMO_WORKSPACE } from "@/app/demo/_mock/data";

const DISPOSITION_COLOR: Record<string, string> = {
  refund: "var(--disposition-refund)",
  replace: "var(--disposition-replace)",
  repair: "var(--disposition-repair)",
  refurbish: "var(--disposition-refurb)",
  donate: "var(--warn)",
  dispose: "var(--text-3)",
  escalate: "var(--disposition-escalate)",
};

const MARKETPLACE_LABEL: Record<string, string> = {
  wayfair: "Wayfair", amazon_fba: "Amazon FBA", amazon_fbm: "Amazon FBM",
  houzz: "Houzz", overstock: "Overstock", shopify: "Shopify",
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function MetaGrid({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12,
      background: "var(--bg-2)", borderRadius: "var(--radius)",
      padding: "14px 16px", border: "1px solid var(--border-0)",
    }}>
      {items.map((m) => (
        <div key={m.label}>
          <div style={{ fontSize: 10.5, color: "var(--text-3)", marginBottom: 2 }}>{m.label}</div>
          <div style={{ fontSize: 13, color: "var(--text-0)", fontWeight: 500, fontFamily: "var(--font-geist-mono)" }}>{m.value}</div>
        </div>
      ))}
    </div>
  );
}

export default function ReturnDetailPage() {
  const params = useParams();
  const returnId = typeof params.returnId === "string" ? params.returnId : "";
  const r = DEMO_RETURNS.find((x) => x.id === returnId);

  if (!r) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        <TopBar workspaceName={DEMO_WORKSPACE.name} title="Return not found" />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center", gap: 12, display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 32, color: "var(--text-3)" }}>404</span>
            <p style={{ color: "var(--text-2)" }}>Return &quot;{returnId}&quot; not found.</p>
            <Link href="/demo/dashboard" style={{ color: "var(--accent)" }}>← Back to queue</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar
        workspaceName={DEMO_WORKSPACE.name}
        title={r.id}
        breadcrumb={[{ label: "Returns Queue", href: "/demo/dashboard" }, { label: r.id }]}
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <Link
              href="/demo/agent-ops"
              style={{
                display: "flex", alignItems: "center", height: 28, padding: "0 12px",
                background: "var(--bg-3)", border: "1px solid var(--border-1)",
                borderRadius: 6, fontSize: 12, color: "var(--text-1)", textDecoration: "none",
              }}
            >
              View in Agent Ops →
            </Link>
            <Link
              href="/demo/escalations"
              style={{
                display: "flex", alignItems: "center", height: 28, padding: "0 12px",
                background: "var(--bg-3)", border: "1px solid var(--border-1)",
                borderRadius: 6, fontSize: 12, color: "var(--text-1)", textDecoration: "none",
              }}
            >
              Override
            </Link>
          </div>
        }
      />

      <div className="scroll" style={{ flex: 1, minHeight: 0 }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 28px 40px" }}>

          {/* Back link */}
          <Link href="/demo/dashboard" style={{ fontSize: 12.5, color: "var(--text-2)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 20 }}>
            ← Returns queue
          </Link>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, fontFamily: "var(--font-geist-mono)", color: "var(--text-0)" }}>
                {r.id}
              </h1>
              <p style={{ margin: "4px 0 0", fontSize: 13.5, color: "var(--text-2)" }}>
                {r.sku.name} · {MARKETPLACE_LABEL[r.marketplace] ?? r.marketplace} · requested {new Date(r.return_requested_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </p>
            </div>
            {r.decision && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                <span style={{
                  padding: "4px 14px", borderRadius: "var(--radius)",
                  background: `${DISPOSITION_COLOR[r.decision.disposition] ?? "var(--text-2)"}22`,
                  border: `1px solid ${DISPOSITION_COLOR[r.decision.disposition] ?? "var(--text-2)"}`,
                  color: DISPOSITION_COLOR[r.decision.disposition] ?? "var(--text-2)",
                  fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5,
                }}>
                  {r.decision.disposition}
                </span>
                <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                  {(r.decision.confidence * 100).toFixed(0)}% confidence
                </span>
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            {/* Left column */}
            <div>
              <Section title="Customer">
                <MetaGrid items={[
                  { label: "Name", value: r.customer.name },
                  { label: "Email", value: r.customer.email },
                  { label: "Lifetime value", value: formatCents(r.customer.lifetime_value_cents) },
                  { label: "Return rate", value: `${(r.customer.return_rate * 100).toFixed(0)}%` },
                  { label: "Orders", value: String(r.customer.order_count) },
                  { label: "Fraud flag", value: r.customer.fraud_flag ? "⚠ Active" : "None" },
                ]} />
              </Section>

              <Section title="SKU Profile">
                <MetaGrid items={[
                  { label: "SKU", value: r.sku.sku_code },
                  { label: "Category", value: r.sku.category },
                  { label: "Weight", value: `${r.sku.weight_lbs} lbs` },
                  { label: "Freight class", value: r.sku.freight_class },
                  { label: "Refurb difficulty", value: r.sku.refurb_difficulty },
                  { label: "Open box est.", value: formatCents(r.sku.open_box_price_estimate_cents) },
                ]} />
              </Section>
            </div>

            {/* Right column */}
            <div>
              <Section title="Return details">
                <MetaGrid items={[
                  { label: "Order ID", value: r.order_id },
                  { label: "AOV", value: formatCents(r.order_total_cents) },
                  { label: "Inbound freight", value: formatCents(r.inbound_freight_cost_cents) },
                  { label: "Reason", value: r.return_reason.replace(/_/g, " ") },
                  { label: "Condition", value: r.condition.replace("_", " ") },
                  { label: "Status", value: r.status.replace(/_/g, " ") },
                ]} />
              </Section>

              <Section title="Condition notes">
                <div style={{
                  padding: "14px 16px", background: "var(--bg-2)",
                  borderRadius: "var(--radius)", border: "1px solid var(--border-0)",
                  fontSize: 13, color: "var(--text-1)", lineHeight: 1.65,
                }}>
                  {r.condition_notes}
                </div>
              </Section>

              {r.decision && (
                <Section title="AI decision">
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {/* Confidence meter */}
                    <div style={{ padding: "14px 16px", background: "var(--bg-2)", borderRadius: "var(--radius)", border: "1px solid var(--border-0)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontSize: 11, color: "var(--text-2)" }}>Confidence</span>
                        <span style={{ fontSize: 12, fontFamily: "var(--font-geist-mono)", color: r.decision.confidence >= 0.8 ? "var(--success)" : "var(--warn)" }}>
                          {(r.decision.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div style={{ height: 4, borderRadius: 2, background: "var(--bg-3)", overflow: "hidden" }}>
                        <div style={{
                          height: "100%",
                          width: `${r.decision.confidence * 100}%`,
                          background: r.decision.confidence >= 0.8 ? "var(--success)" : "var(--warn)",
                          borderRadius: 2, transition: "width 0.6s ease",
                        }} />
                      </div>
                      <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 11, fontFamily: "var(--font-geist-mono)", color: "var(--text-3)" }}>
                        <span>Model: {r.decision.model}</span>
                        <span>{r.decision.latency_ms}ms</span>
                        <span>${r.decision.cost_usd.toFixed(4)}</span>
                      </div>
                    </div>

                    {/* Reasoning */}
                    <div style={{
                      padding: "14px 16px", background: "var(--bg-2)",
                      borderRadius: "var(--radius)", border: "1px solid var(--border-0)",
                      borderLeft: `3px solid ${DISPOSITION_COLOR[r.decision.disposition] ?? "var(--accent)"}`,
                    }}>
                      <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                        Reasoning
                      </div>
                      <p style={{ margin: 0, fontSize: 13, color: "var(--text-1)", lineHeight: 1.65 }}>
                        {r.decision.reasoning}
                      </p>
                    </div>
                  </div>
                </Section>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
