"use client";

import { useEffect } from "react";
import type { GraphNode } from "@/app/demo/_mock/data";

interface Props {
  node: GraphNode | null;
  onClose: () => void;
}

export function DecisionDrawer({ node, onClose }: Props) {
  useEffect(() => {
    if (!node) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [node, onClose]);

  if (!node) return null;

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

          {/* Node description */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
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
