"use client";

import { TopBar } from "@/components/shared/TopBar";
import { DEMO_WORKSPACE } from "@/app/demo/_mock/data";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

// Mock eval data
const EVAL_ACCURACY = 0.94;
const TOTAL_CASES = 50;
const PASSING = 47;

const TREND_DATA = [
  { week: "W1", accuracy: 0.82 },
  { week: "W2", accuracy: 0.86 },
  { week: "W3", accuracy: 0.88 },
  { week: "W4", accuracy: 0.91 },
  { week: "W5", accuracy: 0.93 },
  { week: "W6", accuracy: 0.94 },
];

const AGENT_EVALS = [
  { agent: "intake_agent", cases: 50, passing: 49, accuracy: 0.98, status: "passing" },
  { agent: "customer_history_agent", cases: 50, passing: 50, accuracy: 1.0, status: "passing" },
  { agent: "sku_profile_agent", cases: 50, passing: 50, accuracy: 1.0, status: "passing" },
  { agent: "marketplace_policy_agent", cases: 50, passing: 50, accuracy: 1.0, status: "passing" },
  { agent: "damage_signal_agent", cases: 50, passing: 48, accuracy: 0.96, status: "passing" },
  { agent: "fraud_flag_agent", cases: 50, passing: 50, accuracy: 1.0, status: "passing" },
  { agent: "decision_agent", cases: 50, passing: 47, accuracy: 0.94, status: "passing" },
  { agent: "customer_comms_agent", cases: 50, passing: 49, accuracy: 0.98, status: "passing" },
  { agent: "audit_agent", cases: 50, passing: 50, accuracy: 1.0, status: "passing" },
];

const FAILING_CASES = [
  { id: "EVAL-038", agent: "decision_agent", input: "buyer_remorse / good condition / Houzz / high LTV", expected: "replace", actual: "refund", note: "Houzz LTV weighting underweighted" },
  { id: "EVAL-041", agent: "decision_agent", input: "damage_in_transit / fair / Amazon FBA / fraud_flag", expected: "escalate", actual: "refurb", note: "Fraud flag interaction with AOV threshold" },
  { id: "EVAL-047", agent: "decision_agent", input: "not_as_described / new / Overstock / low LTV", expected: "dispose", actual: "donate", note: "Regional donation availability not modeled" },
];

export default function EvalsPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar
        workspaceName={DEMO_WORKSPACE.name}
        title="Eval Results"
        plan={DEMO_WORKSPACE.plan}
      />

      <div className="scroll" style={{ flex: 1, minHeight: 0 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 28px 40px" }}>

          {/* Heading */}
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text-0)" }}>
              Eval suite
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 13.5, color: "var(--text-2)" }}>
              {PASSING}/{TOTAL_CASES} golden cases passing · Source of truth for &quot;the agent works&quot;
            </p>
          </div>

          {/* KPI row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
            {[
              { label: "Overall accuracy", value: `${(EVAL_ACCURACY * 100).toFixed(0)}%`, color: "var(--success)", sub: "target: 90%" },
              { label: "Cases passing", value: `${PASSING}/${TOTAL_CASES}`, color: "var(--text-0)", sub: "golden set" },
              { label: "Failing cases", value: String(TOTAL_CASES - PASSING), color: TOTAL_CASES - PASSING > 5 ? "var(--danger)" : "var(--warn)", sub: "need review" },
              { label: "Gate status", value: EVAL_ACCURACY >= 0.9 ? "PASS" : "FAIL", color: EVAL_ACCURACY >= 0.9 ? "var(--success)" : "var(--danger)", sub: "CI gate at 90%" },
            ].map((kpi) => (
              <div key={kpi.label} className="card" style={{ padding: "16px 18px" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{kpi.label}</div>
                <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em", color: kpi.color }}>{kpi.value}</div>
                <div style={{ marginTop: 4, fontSize: 11.5, color: "var(--text-2)" }}>{kpi.sub}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 20, marginBottom: 28 }}>
            {/* Accuracy trend sparkline */}
            <div className="card" style={{ padding: "20px 20px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 14 }}>
                Accuracy trend (6 weeks)
              </div>
              <ResponsiveContainer width="100%" height={100}>
                <LineChart data={TREND_DATA} margin={{ top: 4, right: 4, bottom: 0, left: -30 }}>
                  <XAxis dataKey="week" tick={{ fontSize: 10, fill: "var(--text-3)" }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0.75, 1.0]} tick={{ fontSize: 10, fill: "var(--text-3)" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} />
                  <Tooltip
                    contentStyle={{ background: "var(--bg-2)", border: "1px solid var(--border-1)", borderRadius: 6, fontSize: 12 }}
                    formatter={(v: number) => [`${(v * 100).toFixed(1)}%`, "Accuracy"]}
                  />
                  <Line type="monotone" dataKey="accuracy" stroke="var(--accent)" strokeWidth={2} dot={{ fill: "var(--accent)", r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Per-agent summary */}
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-0)" }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 0.5 }}>Per-agent accuracy</span>
              </div>
              {AGENT_EVALS.map((ae) => (
                <div key={ae.agent} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "9px 16px", borderBottom: "1px solid var(--border-0)",
                }}>
                  <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11.5, color: "var(--text-1)", flex: 1 }}>
                    {ae.agent}
                  </span>
                  <div style={{ width: 80, height: 4, background: "var(--bg-3)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", width: `${ae.accuracy * 100}%`,
                      background: ae.accuracy >= 0.95 ? "var(--success)" : ae.accuracy >= 0.9 ? "var(--warn)" : "var(--danger)",
                      borderRadius: 2,
                    }} />
                  </div>
                  <span style={{
                    fontSize: 11.5, fontFamily: "var(--font-geist-mono)", minWidth: 36, textAlign: "right",
                    color: ae.accuracy >= 0.95 ? "var(--success)" : ae.accuracy >= 0.9 ? "var(--warn)" : "var(--danger)",
                  }}>
                    {(ae.accuracy * 100).toFixed(0)}%
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: "1px 6px",
                    borderRadius: 999, background: "var(--success)18", color: "var(--success)",
                  }}>PASS</span>
                </div>
              ))}
            </div>
          </div>

          {/* Failing cases */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>
              Failing cases ({TOTAL_CASES - PASSING})
            </div>
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              {/* Header */}
              <div style={{
                display: "grid", gridTemplateColumns: "100px 150px 1fr 90px 90px 1fr",
                padding: "8px 16px", borderBottom: "1px solid var(--border-0)",
                background: "var(--bg-2)",
              }}>
                {["Case ID", "Agent", "Input summary", "Expected", "Actual", "Note"].map((h) => (
                  <div key={h} style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</div>
                ))}
              </div>
              {FAILING_CASES.map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "100px 150px 1fr 90px 90px 1fr",
                    padding: "10px 16px",
                    borderBottom: "1px solid var(--border-0)",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11.5, color: "var(--text-0)", fontWeight: 600 }}>{c.id}</span>
                  <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11, color: "var(--ai)" }}>{c.agent}</span>
                  <span style={{ fontSize: 12, color: "var(--text-2)" }}>{c.input}</span>
                  <span className="badge" style={{ color: "var(--success)", background: "var(--success)18", border: "1px solid var(--success)40", fontSize: 10 }}>{c.expected}</span>
                  <span className="badge" style={{ color: "var(--danger)", background: "var(--danger)18", border: "1px solid var(--danger)40", fontSize: 10 }}>{c.actual}</span>
                  <span style={{ fontSize: 11.5, color: "var(--text-2)" }}>{c.note}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
