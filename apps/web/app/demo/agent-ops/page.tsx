"use client";

import { useState, useCallback, useEffect } from "react";
import { TopBar } from "@/components/shared/TopBar";
import { GraphCanvas } from "@/components/agent-ops/GraphCanvas";
import { DecisionDrawer } from "@/components/agent-ops/DecisionDrawer";
import {
  DEMO_GRAPH_NODES,
  DEMO_GRAPH_EDGES,
  DEMO_RUN,
  DEMO_WORKSPACE,
  type GraphNode,
  type NodeState,
} from "@/app/demo/_mock/data";

// Simulated triage sequence: node_id → delay_ms from start
const TRIAGE_SEQUENCE: { node: string; delay: number }[] = [
  { node: "intake_agent", delay: 400 },
  { node: "customer_history_agent", delay: 900 },
  { node: "sku_profile_agent", delay: 900 },
  { node: "marketplace_policy_agent", delay: 900 },
  { node: "damage_signal_agent", delay: 900 },
  { node: "fraud_flag_agent", delay: 900 },
  { node: "decision_agent", delay: 1800 },
  { node: "refurb_worker", delay: 2400 },
  { node: "customer_comms_agent", delay: 3000 },
  { node: "audit_agent", delay: 3600 },
];

type RunStatus = "idle" | "running" | "completed";

export default function AgentOpsPage() {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [runStatus, setRunStatus] = useState<RunStatus>("idle");
  const [nodeStates, setNodeStates] = useState<Record<string, NodeState>>({});
  const [totalCost, setTotalCost] = useState(0);
  const [completedNodes, setCompletedNodes] = useState(0);

  const setNodeState = useCallback((nodeId: string, state: NodeState) => {
    setNodeStates((prev) => ({ ...prev, [nodeId]: state }));
  }, []);

  // Derive current graph nodes by merging live states
  const liveGraphNodes: GraphNode[] = DEMO_GRAPH_NODES.map((n) => ({
    ...n,
    state: nodeStates[n.id] ?? (runStatus === "idle" ? "complete" : "idle"),
  }));

  const handleRunTriage = useCallback(async () => {
    if (runStatus === "running") return;

    setRunStatus("running");
    setTotalCost(0);
    setCompletedNodes(0);

    // Reset all nodes to idle
    const idleStates: Record<string, NodeState> = {};
    DEMO_GRAPH_NODES.forEach((n) => { idleStates[n.id] = "idle"; });
    setNodeStates(idleStates);

    // Simulate progressive execution
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    let costAccum = 0;
    let nodesDone = 0;

    TRIAGE_SEQUENCE.forEach(({ node, delay }) => {
      // Start running state
      const t1 = setTimeout(() => {
        setNodeState(node, "running");
      }, delay);
      timeouts.push(t1);

      // Complete ~600ms later
      const t2 = setTimeout(() => {
        setNodeState(node, "complete");
        const nodeData = DEMO_GRAPH_NODES.find((n) => n.id === node);
        if (nodeData?.cost_usd) {
          costAccum += nodeData.cost_usd;
          setTotalCost(costAccum);
        }
        nodesDone++;
        setCompletedNodes(nodesDone);
      }, delay + 600);
      timeouts.push(t2);
    });

    // Mark run complete
    const lastDelay = (TRIAGE_SEQUENCE[TRIAGE_SEQUENCE.length - 1]?.delay ?? 3600) + 800;
    const tFinal = setTimeout(() => {
      setRunStatus("completed");
    }, lastDelay);
    timeouts.push(tFinal);

    return () => timeouts.forEach(clearTimeout);
  }, [runStatus, setNodeState]);

  // POST to API when run starts
  useEffect(() => {
    if (runStatus !== "running") return;
    void fetch("/api/graph/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ return_ids: ["RTN-2024-001"] }),
    });
  }, [runStatus]);

  const streamPill = {
    idle: { label: "Ready", color: "var(--text-3)" },
    running: { label: "Streaming…", color: "var(--warn)" },
    completed: { label: "Run complete", color: "var(--success)" },
  }[runStatus];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar
        workspaceName={DEMO_WORKSPACE.name}
        title="Agent Ops"
        plan={DEMO_WORKSPACE.plan}
        actions={
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {/* Stream state pill */}
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "4px 10px", borderRadius: 999,
              background: "var(--bg-2)", border: "1px solid var(--border-1)",
              fontSize: 11.5, color: streamPill.color,
            }}>
              {runStatus === "running" && (
                <span style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: "var(--warn)", animation: "pulse-dot 1.5s infinite",
                  display: "inline-block",
                }} />
              )}
              {streamPill.label}
            </div>

            {/* Cost + node counter */}
            {runStatus !== "idle" && (
              <div style={{
                padding: "4px 10px", borderRadius: 999,
                background: "var(--bg-2)", border: "1px solid var(--border-1)",
                fontSize: 11.5, fontFamily: "var(--font-geist-mono)", color: "var(--text-1)",
              }}>
                {completedNodes}/{DEMO_GRAPH_NODES.length} nodes · ${totalCost.toFixed(4)}
              </div>
            )}

            {/* Run triage button */}
            <button
              onClick={handleRunTriage}
              disabled={runStatus === "running"}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                height: 28, padding: "0 14px",
                background: runStatus === "running" ? "var(--bg-3)" : "var(--accent)",
                color: runStatus === "running" ? "var(--text-2)" : "var(--accent-fg)",
                border: "none", borderRadius: 6, fontSize: 12.5, fontWeight: 600,
                cursor: runStatus === "running" ? "not-allowed" : "pointer",
              }}
            >
              {runStatus === "running" ? (
                <><span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>◉</span> Running…</>
              ) : (
                <><span>▶</span> Run triage</>
              )}
            </button>
          </div>
        }
      />

      {/* Graph canvas fills remaining space */}
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        <GraphCanvas
          graphNodes={liveGraphNodes}
          graphEdges={DEMO_GRAPH_EDGES.map((e) => ({
            ...e,
            active: runStatus !== "idle" ? e.active : e.active,
          }))}
          onNodeClick={setSelectedNode}
          totalCostUsd={runStatus === "idle" ? DEMO_RUN.total_cost_usd : totalCost}
          evalAccuracy={DEMO_WORKSPACE.eval_accuracy}
        />

        {/* Idle state overlay hint */}
        {runStatus === "idle" && (
          <div style={{
            position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)",
            background: "var(--bg-2)", border: "1px solid var(--border-1)",
            borderRadius: "var(--radius)", padding: "10px 18px",
            fontSize: 12.5, color: "var(--text-2)", pointerEvents: "none",
            boxShadow: "var(--shadow-pop)",
          }}>
            ↑ Click a node to inspect · Press <strong style={{ color: "var(--text-1)" }}>Run triage</strong> to animate
          </div>
        )}
      </div>

      {/* Decision drawer */}
      <DecisionDrawer node={selectedNode} onClose={() => setSelectedNode(null)} />
    </div>
  );
}
