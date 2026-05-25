"use client";

import { useState } from "react";
import { TopBar } from "@/components/shared/TopBar";
import { DEMO_WORKSPACE } from "@/app/demo/_mock/data";

const MARKETPLACES = [
  { id: "wayfair", label: "Wayfair", color: "var(--mp-wayfair)", enabled: true },
  { id: "amazon_fba", label: "Amazon FBA", color: "var(--mp-amazon)", enabled: true },
  { id: "amazon_fbm", label: "Amazon FBM", color: "var(--mp-amazon)", enabled: true },
  { id: "houzz", label: "Houzz", color: "var(--mp-houzz)", enabled: true },
  { id: "overstock", label: "Overstock", color: "var(--mp-overstock)", enabled: true },
  { id: "shopify", label: "Shopify D2C", color: "var(--mp-shopify)", enabled: true },
];

const DECISION_MODELS = [
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", note: "Default — good balance of cost and accuracy", recommended: true },
  { id: "claude-opus-4", label: "Claude Opus 4", note: "Higher accuracy, ~4× cost — see eval comparison in /docs/", recommended: false },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", note: "Fastest and cheapest — accuracy drops ~8% on edge cases", recommended: false },
];

const DENSITY_OPTIONS = [
  { id: "compact", label: "Compact (1×)", rows: "28px" },
  { id: "normal", label: "Normal (1.2×)", rows: "34px" },
  { id: "spacious", label: "Spacious (1.5×)", rows: "44px" },
];

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-0)", marginBottom: description ? 4 : 0 }}>{title}</div>
        {description && <div style={{ fontSize: 13, color: "var(--text-2)" }}>{description}</div>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      style={{
        width: 36, height: 20, borderRadius: 10,
        background: enabled ? "var(--accent)" : "var(--bg-3)",
        border: `1px solid ${enabled ? "var(--accent)" : "var(--border-1)"}`,
        position: "relative", cursor: "pointer", transition: "background 0.15s",
        flexShrink: 0,
      }}
    >
      <span style={{
        position: "absolute", top: 2,
        left: enabled ? 18 : 2,
        width: 14, height: 14, borderRadius: "50%",
        background: "#fff", transition: "left 0.15s",
      }} />
    </button>
  );
}

export default function SettingsPage() {
  const [marketplaces, setMarketplaces] = useState(MARKETPLACES);
  const [costCap, setCostCap] = useState(0.10);
  const [selectedModel, setSelectedModel] = useState("claude-sonnet-4-6");
  const [density, setDensity] = useState("normal");
  const [saved, setSaved] = useState(false);

  function toggleMarketplace(id: string) {
    setMarketplaces((prev) =>
      prev.map((m) => m.id === id ? { ...m, enabled: !m.enabled } : m)
    );
  }

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleReset() {
    setMarketplaces(MARKETPLACES);
    setCostCap(0.10);
    setSelectedModel("claude-sonnet-4-6");
    setDensity("normal");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar
        workspaceName={DEMO_WORKSPACE.name}
        title="Settings"
        plan={DEMO_WORKSPACE.plan}
        actions={
          <button
            onClick={handleSave}
            style={{
              height: 28, padding: "0 14px",
              background: saved ? "var(--bg-3)" : "var(--accent)",
              color: saved ? "var(--success)" : "var(--accent-fg)",
              border: "none", borderRadius: 6, fontSize: 12.5, fontWeight: 600,
              cursor: "pointer", transition: "background 0.12s",
            }}
          >
            {saved ? "✓ Saved" : "Save changes"}
          </button>
        }
      />

      <div className="scroll" style={{ flex: 1, minHeight: 0 }}>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "28px 28px 40px" }}>

          <div style={{ marginBottom: 28 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text-0)" }}>Settings</h1>
            <p style={{ margin: "4px 0 0", fontSize: 13.5, color: "var(--text-2)" }}>
              Configure channels, AI model, cost limits, and display preferences.
            </p>
          </div>

          {/* Marketplace toggles */}
          <Section title="Marketplace channels" description="Enable or disable channels. Disabled channels are excluded from triage runs.">
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              {marketplaces.map((m, i) => (
                <div
                  key={m.id}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "12px 16px",
                    borderBottom: i < marketplaces.length - 1 ? "1px solid var(--border-0)" : "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: m.color, display: "inline-block" }} />
                    <span style={{ fontSize: 13.5, color: m.enabled ? "var(--text-0)" : "var(--text-3)", fontWeight: 500 }}>{m.label}</span>
                    <span style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "var(--font-geist-mono)" }}>fixtures only</span>
                  </div>
                  <Toggle enabled={m.enabled} onChange={() => toggleMarketplace(m.id)} />
                </div>
              ))}
            </div>
          </Section>

          {/* Cost cap */}
          <Section title="Cost threshold" description="Hard cap per graph run. Runs exceeding this limit are aborted and logged as a bug.">
            <div className="card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 13.5, color: "var(--text-0)", fontWeight: 500 }}>Max cost per run</div>
                <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>Current avg: ${DEMO_WORKSPACE.avg_cost_per_decision_cents / 100 * 12} for 12 returns</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <input
                  type="range" min={0.01} max={1.0} step={0.01}
                  value={costCap}
                  onChange={(e) => setCostCap(parseFloat(e.target.value))}
                  style={{ width: 120, accentColor: "var(--accent)" }}
                />
                <span style={{
                  fontFamily: "var(--font-geist-mono)", fontSize: 14, fontWeight: 700,
                  color: costCap > 0.10 ? "var(--danger)" : "var(--success)",
                  minWidth: 50, textAlign: "right",
                }}>
                  ${costCap.toFixed(2)}
                </span>
              </div>
            </div>
            {costCap > 0.10 && (
              <div style={{ marginTop: 8, fontSize: 12, color: "var(--danger)" }}>
                ⚠ Cap exceeds $0.10 — the v1 design target. This is a bug in production.
              </div>
            )}
          </Section>

          {/* Model selection */}
          <Section title="Decision Agent model" description="Model used for the Decision Agent. All other agents default to claude-haiku-4-5.">
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              {DECISION_MODELS.map((m, i) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedModel(m.id)}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 12, width: "100%",
                    padding: "14px 16px", textAlign: "left",
                    borderBottom: i < DECISION_MODELS.length - 1 ? "1px solid var(--border-0)" : "none",
                    background: selectedModel === m.id ? "var(--accent-soft)" : "transparent",
                    border: "none", cursor: "pointer",
                    transition: "background 0.1s",
                  }}
                >
                  <div style={{
                    width: 16, height: 16, borderRadius: "50%", flexShrink: 0, marginTop: 2,
                    border: `2px solid ${selectedModel === m.id ? "var(--accent)" : "var(--border-1)"}`,
                    background: selectedModel === m.id ? "var(--accent)" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {selectedModel === m.id && (
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent-fg)" }} />
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text-0)", fontFamily: "var(--font-geist-mono)" }}>{m.label}</span>
                      {m.recommended && (
                        <span className="badge" style={{ color: "var(--success)", background: "var(--success)18", border: "1px solid var(--success)40", fontSize: 9 }}>RECOMMENDED</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>{m.note}</div>
                  </div>
                </button>
              ))}
            </div>
          </Section>

          {/* Row density */}
          <Section title="Table density" description="Controls row height in the returns queue and audit log.">
            <div style={{ display: "flex", gap: 10 }}>
              {DENSITY_OPTIONS.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDensity(d.id)}
                  style={{
                    flex: 1, padding: "12px 16px", borderRadius: "var(--radius)",
                    border: `1px solid ${density === d.id ? "var(--accent)" : "var(--border-1)"}`,
                    background: density === d.id ? "var(--accent-soft)" : "var(--bg-2)",
                    color: density === d.id ? "var(--accent)" : "var(--text-1)",
                    fontSize: 12.5, cursor: "pointer", fontWeight: density === d.id ? 600 : 400,
                    transition: "border-color 0.12s, background 0.12s",
                    textAlign: "center",
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </Section>

          {/* Danger zone */}
          <Section title="Danger zone">
            <div className="card" style={{
              padding: "16px 20px",
              borderColor: "oklch(0.68 0.16 22 / 0.4)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text-0)" }}>Reset to seed data</div>
                <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>
                  Restore all fixture returns, decisions, and audit log entries to their original demo state.
                </div>
              </div>
              <button
                onClick={handleReset}
                style={{
                  height: 32, padding: "0 16px", flexShrink: 0,
                  background: "var(--bg-3)", border: "1px solid oklch(0.68 0.16 22 / 0.5)",
                  borderRadius: 6, fontSize: 12.5, color: "var(--danger)", cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                Reset demo
              </button>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
