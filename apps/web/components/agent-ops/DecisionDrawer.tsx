"use client";

import { useEffect, useState } from "react";
import type { GraphNode, ReturnDecision } from "@/app/demo/_mock/data";
import { DEMO_RETURNS } from "@/app/demo/_mock/data";

const DISPOSITION_COLOR: Record<string, string> = {
  refund: "var(--warn)",
  replace: "var(--accent)",
  repair: "oklch(0.72 0.18 200)",
  refurbish: "oklch(0.72 0.18 160)",
  donate: "oklch(0.72 0.14 260)",
  dispose: "var(--danger)",
  escalate: "oklch(0.72 0.18 40)",
};

const DISPOSITIONS = ["refund", "replace", "repair", "refurbish", "donate", "dispose", "escalate"] as const;

interface Props {
  node: GraphNode | null;
  onClose: () => void;
  activeReturnId?: string;
  onOverride?: (returnId: string, disposition: string, reason: string) => void;
}

function OverrideUI({
  returnId,
  decision,
  onOverride,
}: {
  returnId: string;
  decision: ReturnDecision;
  onOverride?: (returnId: string, disposition: string, reason: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<string>(decision.disposition);
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div style={{
        padding: "10px 12px",
        background: "oklch(0.65 0.18 160 / 0.12)",
        border: "1px solid oklch(0.65 0.18 160 / 0.4)",
        borderRadius: "var(--radius)",
        fontSize: 12.5,
        color: "var(--success)",
      }}>
        ✓ Override submitted — added to eval dataset
      </div>
    );
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        style={{
          width: "100%", padding: "8px 12px",
          background: "var(--bg-3)", border: "1px solid var(--border-1)",
          borderRadius: "var(--radius)", fontSize: 12.5, color: "var(--text-1)",
          cursor: "pointer", textAlign: "center",
        }}
      >
        Override decision
      </button>
    );
  }

  return (
    <div style={{
      padding: "12px",
      background: "var(--bg-2)",
      borderRadius: "var(--radius)",
      border: "1px solid var(--border-1)",
    }}>
      <div style={{
        fontSize: 10.5, fontWeight: 600, color: "var(--text-3)",
        textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10,
      }}>
        Override
      </div>

      {/* Disposition selector */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        {DISPOSITIONS.map((d) => (
          <button
            key={d}
            onClick={() => setSelected(d)}
            style={{
              padding: "4px 10px", borderRadius: "var(--radius-sm)",
              border: `1px solid ${selected === d ? (DISPOSITION_COLOR[d] ?? "var(--accent)") : "var(--border-1)"}`,
              background: selected === d ? `${DISPOSITION_COLOR[d] ?? "var(--accent)"}18` : "var(--bg-3)",
              color: selected === d ? (DISPOSITION_COLOR[d] ?? "var(--accent)") : "var(--text-2)",
              fontSize: 11.5, cursor: "pointer",
            }}
          >
            {d}
          </button>
        ))}
      </div>

      {/* Reason textarea */}
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason for override (added to eval dataset)…"
        style={{
          width: "100%", minHeight: 60, padding: "8px 10px",
          background: "var(--bg-1)", border: "1px solid var(--border-1)",
          borderRadius: "var(--radius-sm)", fontSize: 12, color: "var(--text-0)",
          resize: "vertical", boxSizing: "border-box",
        }}
      />

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button
          onClick={() => setExpanded(false)}
          style={{
            flex: 1, height: 30, background: "var(--bg-3)",
            border: "1px solid var(--border-1)", borderRadius: 5,
            fontSize: 12, color: "var(--text-2)", cursor: "pointer",
          }}
        >
          Cancel
        </button>
        <button
          onClick={() => {
            onOverride?.(returnId, selected, reason);
            setSubmitted(true);
          }}
          disabled={!reason.trim()}
          style={{
            flex: 2, height: 30,
            background: reason.trim() ? "var(--accent)" : "var(--bg-3)",
            border: "none", borderRadius: 5,
            fontSize: 12, fontWeight: 600,
            color: reason.trim() ? "var(--accent-fg)" : "var(--text-3)",
            cursor: reason.trim() ? "pointer" : "not-allowed",
          }}
        >
          Submit override
        </button>
      </div>
    </div>
  );
}

export function DecisionDrawer({ node, onClose, activeReturnId, onOverride }: Props) {
  useEffect(() => {
    if (!node) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [node, onClose]);

  if (!node) return null;

  const activeReturn = activeReturnId ? DEMO_RETURNS.find((r) => r.id === activeReturnId) : null;
  const decision = activeReturn?.decision ?? null;
  const showDecision = node.id === "decision_agent" && decision !== null;

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.2)", zIndex: 44 }}
      />
      <div
        className="panel-slide-in"
        style={{
          position: "fixed", right: 0, top: 36, bottom: 0, width: 380,
          background: "var(--bg-1)", borderLeft: "1px solid var(--border-1)",
          zIndex: 45, display: "flex", flexDirection: "column",
          boxShadow: "var(--shadow-pop)",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid var(--border-0)",
          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
          flexShrink: 0,
        }}>
          <div>
            <span style={{
              fontSize: 10.5, fontWeight: 600, textTransform: "uppercase",
              letterSpacing: "0.6px", color: node.type === "llm" ? "var(--ai)" : "var(--text-2)",
            }}>
              {node.type === "llm" ? "LLM Agent" : "Deterministic"}
            </span>
            <h3 style={{
              margin: "4px 0 2px", fontSize: 15, fontWeight: 700,
              fontFamily: "var(--font-geist-mono)", color: "var(--text-0)",
            }}>{node.label}</h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "var(--text-2)", cursor: "pointer", fontSize: 18, lineHeight: 1 }}
            aria-label="Close"
          >×</button>
        </div>

        {/* Body */}
        <div className="scroll" style={{ flex: 1, padding: 20 }}>
          {/* Stats grid */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12,
            background: "var(--bg-2)", borderRadius: "var(--radius)",
            padding: "14px 16px", marginBottom: 16,
            border: "1px solid var(--border-0)",
          }}>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-2)", marginBottom: 2 }}>Status</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-0)", textTransform: "capitalize" }}>{node.state}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-2)", marginBottom: 2 }}>Type</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: node.type === "llm" ? "var(--ai)" : "var(--text-0)" }}>
                {node.type === "llm" ? "LLM" : "Rule-based"}
              </div>
            </div>
            {node.model && (
              <div>
                <div style={{ fontSize: 11, color: "var(--text-2)", marginBottom: 2 }}>Model</div>
                <div style={{ fontSize: 13, fontFamily: "var(--font-geist-mono)", color: "var(--ai)" }}>{node.model}</div>
              </div>
            )}
            {node.latency_ms !== undefined && (
              <div>
                <div style={{ fontSize: 11, color: "var(--text-2)", marginBottom: 2 }}>Latency</div>
                <div style={{ fontSize: 13, fontFamily: "var(--font-geist-mono)", color: "var(--text-0)" }}>{node.latency_ms}ms</div>
              </div>
            )}
            {node.cost_usd !== undefined && (
              <div>
                <div style={{ fontSize: 11, color: "var(--text-2)", marginBottom: 2 }}>Cost</div>
                <div style={{ fontSize: 13, fontFamily: "var(--font-geist-mono)", color: "var(--success)" }}>${node.cost_usd.toFixed(4)}</div>
              </div>
            )}
          </div>

          {/* Decision data — only for decision_agent when decision available */}
          {showDecision && decision && (
            <div style={{ marginBottom: 16 }}>
              {/* Disposition badge */}
              <div style={{ marginBottom: 14 }}>
                <div style={{
                  fontSize: 10.5, fontWeight: 600, color: "var(--text-3)",
                  textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8,
                }}>
                  Decision
                </div>
                <span style={{
                  display: "inline-block",
                  padding: "4px 12px",
                  borderRadius: "var(--radius)",
                  background: `${DISPOSITION_COLOR[decision.disposition] ?? "var(--accent)"}22`,
                  border: `1px solid ${DISPOSITION_COLOR[decision.disposition] ?? "var(--accent)"}`,
                  color: DISPOSITION_COLOR[decision.disposition] ?? "var(--accent)",
                  fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5,
                }}>
                  {decision.disposition}
                </span>
              </div>

              {/* Confidence meter */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: "var(--text-2)" }}>Confidence</span>
                  <span style={{
                    fontSize: 12, fontFamily: "var(--font-geist-mono)",
                    color: decision.confidence >= 0.8 ? "var(--success)" : "var(--warn)",
                  }}>
                    {(decision.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: "var(--bg-3)", overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    width: `${decision.confidence * 100}%`,
                    background: decision.confidence >= 0.8 ? "var(--success)" : "var(--warn)",
                    borderRadius: 2,
                    transition: "width 0.6s ease",
                  }} />
                </div>
              </div>

              {/* Reasoning */}
              <div style={{ marginBottom: 14 }}>
                <div style={{
                  fontSize: 10.5, fontWeight: 600, color: "var(--text-3)",
                  textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6,
                }}>
                  Reasoning
                </div>
                <p style={{
                  margin: 0, fontSize: 12.5, color: "var(--text-1)", lineHeight: 1.65,
                  background: "var(--bg-2)", padding: "10px 12px", borderRadius: "var(--radius)",
                  border: "1px solid var(--border-0)",
                  borderLeft: `3px solid ${DISPOSITION_COLOR[decision.disposition] ?? "var(--accent)"}`,
                }}>
                  {decision.reasoning}
                </p>
              </div>

              {/* Candidate dispositions */}
              {decision.candidate_dispositions && decision.candidate_dispositions.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{
                    fontSize: 10.5, fontWeight: 600, color: "var(--text-3)",
                    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8,
                  }}>
                    Candidate dispositions
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {decision.candidate_dispositions.map((cd) => (
                      <div key={cd.disposition} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "6px 10px", background: "var(--bg-2)",
                        borderRadius: "var(--radius-sm)", border: "1px solid var(--border-0)",
                      }}>
                        <span className="badge" style={{
                          color: DISPOSITION_COLOR[cd.disposition] ?? "var(--text-2)",
                          background: `${DISPOSITION_COLOR[cd.disposition] ?? "var(--text-2)"}18`,
                          border: `1px solid ${DISPOSITION_COLOR[cd.disposition] ?? "var(--text-2)"}40`,
                          fontSize: 9, minWidth: 60, textAlign: "center",
                        }}>
                          {cd.disposition}
                        </span>
                        <div style={{ flex: 1, height: 3, background: "var(--bg-3)", borderRadius: 2 }}>
                          <div style={{
                            height: "100%",
                            width: `${(cd.score ?? 0) * 100}%`,
                            background: DISPOSITION_COLOR[cd.disposition] ?? "var(--accent)",
                            borderRadius: 2,
                          }} />
                        </div>
                        <span style={{
                          fontSize: 11, fontFamily: "var(--font-geist-mono)",
                          color: "var(--text-3)", minWidth: 32, textAlign: "right",
                        }}>
                          {((cd.score ?? 0) * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Override UI */}
              {activeReturnId && (
                <OverrideUI returnId={activeReturnId} decision={decision} onOverride={onOverride} />
              )}
            </div>
          )}

          {/* Node description */}
          <div style={{ marginBottom: 16 }}>
            <div style={{
              fontSize: 10.5, fontWeight: 600, color: "var(--text-3)",
              textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8,
            }}>
              Role in graph
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-1)", lineHeight: 1.65 }}>
              {getNodeDescription(node.id)}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

function getNodeDescription(nodeId: string): string {
  const descriptions: Record<string, string> = {
    intake_agent: "Parses the incoming return request into a structured form — extracting marketplace, SKU, reason code, and condition from raw input.",
    customer_history_agent: "Looks up the customer's order history, lifetime value, prior return rate, and fraud signals from the fixture database.",
    sku_profile_agent: "Pulls weight, freight class, refurb difficulty score, current Open Box stock, and price estimates for the returned SKU.",
    marketplace_policy_agent: "Reads the applicable return policy from /config/marketplaces/ — return window, freight subsidy, damage allowance, restocking fee rules.",
    damage_signal_agent: "Parses condition notes and any provided condition codes to produce a structured damage assessment signal.",
    fraud_flag_agent: "Checks customer return rate, abuse patterns, and cross-references known fraud indicators to produce a fraud risk score.",
    decision_agent: "The headline agent. Takes all upstream context signals and recommends the optimal disposition with reasoning and confidence score.",
    refund_worker: "Issues a Stripe test-mode refund for the approved amount and logs the transaction to the audit trail.",
    replacement_worker: "Checks inventory levels and books a replacement shipment via the fixture shipping connector.",
    repair_worker: "Schedules a carrier pickup for repair and drafts a work order for the service team.",
    refurb_worker: "Routes the item to the refurbishment queue with a grading score and estimated Open Box resale value.",
    donate_dispose_worker: "Routes to donation or disposal based on regional options and local charity availability.",
    customer_comms_agent: "Drafts a channel-appropriate customer communication for the chosen disposition — tone varies by marketplace.",
    escalation_agent: "Fires when confidence is below threshold or AOV exceeds the auto-decide ceiling, routing to the human escalation queue.",
    audit_agent: "Writes the full decision record to the append-only audit log: agent, prompt version, input, reasoning, confidence, cost, latency.",
  };
  return descriptions[nodeId] ?? "Processes its input context and passes results to downstream agents in the graph.";
}
