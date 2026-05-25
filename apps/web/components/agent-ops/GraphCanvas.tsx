"use client";

import { useCallback } from "react";
import * as XYFlow from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import type { GraphNode, GraphEdge } from "@/app/demo/_mock/data";

const {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
} = XYFlow;

type Node = XYFlow.Node;
type Edge = XYFlow.Edge;
type NodeMouseHandler = XYFlow.NodeMouseHandler;

// Layout with dagre
const NODE_WIDTH = 220;
const NODE_HEIGHT = 80;

function layoutGraph(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", ranksep: 120, nodesep: 60, marginx: 40, marginy: 40 });
  g.setDefaultEdgeLabel(() => ({}));
  nodes.forEach((n) => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
  edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return {
    nodes: nodes.map((n) => {
      const pos = g.node(n.id);
      return { ...n, position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 } };
    }),
    edges,
  };
}

// Node state → border color token
const STATE_BORDER: Record<string, string> = {
  idle: "var(--node-idle-border)",
  running: "var(--node-running-border)",
  complete: "var(--node-complete-border)",
  failed: "var(--node-failed-border)",
  escalated: "var(--node-escalated-border)",
};

const STATE_ICON: Record<string, string> = {
  idle: "○",
  running: "◉",
  complete: "✓",
  failed: "✗",
  escalated: "⏸",
};

// Custom node component
function AgentNode({ data }: { data: GraphNode }) {
  const borderColor = STATE_BORDER[data.state] ?? "var(--border-1)";
  const isRunning = data.state === "running";
  return (
    <div style={{
      width: NODE_WIDTH,
      minHeight: NODE_HEIGHT,
      background: "var(--bg-1)",
      border: `1px solid ${borderColor}`,
      borderLeft: `3px solid ${borderColor}`,
      borderRadius: "var(--radius)",
      padding: "10px 14px",
      display: "flex",
      flexDirection: "column",
      gap: 6,
      boxShadow: isRunning ? `0 0 12px ${borderColor}` : undefined,
      animation: isRunning ? "node-activate 0.3s ease" : undefined,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: "0.4px" }}>
          {data.type === "llm" ? "LLM" : "Deterministic"}
        </span>
        <span style={{ fontSize: 13, color: borderColor }}>{STATE_ICON[data.state] ?? "○"}</span>
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-0)", fontFamily: "var(--font-geist-mono)" }}>
        {data.label}
      </span>
      {data.model && (
        <span className="badge" style={{ color: "var(--ai)", background: "oklch(0.72 0.16 305 / 0.12)", alignSelf: "flex-start", fontSize: 10 }}>
          {data.model}
        </span>
      )}
      {(data.latency_ms !== undefined || data.cost_usd !== undefined) && (
        <div style={{ display: "flex", gap: 8, fontSize: 11, color: "var(--text-3)", fontFamily: "var(--font-geist-mono)" }}>
          {data.latency_ms !== undefined && <span>{data.latency_ms}ms</span>}
          {data.cost_usd !== undefined && <span>${data.cost_usd.toFixed(4)}</span>}
        </div>
      )}
    </div>
  );
}

const nodeTypes = { agentNode: AgentNode };

export interface GraphCanvasProps {
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
  onNodeClick?: (node: GraphNode) => void;
  totalCostUsd?: number;
  evalAccuracy?: number;
}

export function GraphCanvas({
  graphNodes,
  graphEdges,
  onNodeClick,
  totalCostUsd = 0,
  evalAccuracy = 0.94,
}: GraphCanvasProps) {
  const rawNodes: Node[] = graphNodes.map((n) => ({
    id: n.id,
    type: "agentNode",
    position: { x: 0, y: 0 },
    data: n,
  }));

  const rawEdges: Edge[] = graphEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    animated: e.active,
    style: {
      stroke: e.active ? "var(--accent)" : "var(--border-1)",
      strokeWidth: 1.5,
    },
  }));

  const { nodes: layoutedNodes, edges: layoutedEdges } = layoutGraph(rawNodes, rawEdges);

  const [nodes, , onNodesChange] = useNodesState(layoutedNodes);
  const [edges, , onEdgesChange] = useEdgesState(layoutedEdges);

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_evt, node) => {
      onNodeClick?.(node.data as GraphNode);
    },
    [onNodeClick],
  );

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        style={{ background: "var(--bg-0)" }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="var(--border-0)" />
        <Controls
          style={{
            background: "var(--bg-2)",
            border: "1px solid var(--border-1)",
            borderRadius: 8,
          }}
        />
        <MiniMap
          nodeColor={(n) => STATE_BORDER[(n.data as GraphNode).state] ?? "var(--border-1)"}
          maskColor="oklch(0.14 0.005 260 / 0.8)"
          style={{
            background: "var(--bg-1)",
            border: "1px solid var(--border-1)",
          }}
        />
        <Panel position="top-right">
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{
              padding: "6px 12px",
              background: "var(--bg-2)",
              border: "1px solid var(--border-1)",
              borderRadius: "var(--radius-sm)",
              fontSize: 12,
              fontFamily: "var(--font-geist-mono)",
            }}>
              <span style={{ color: "var(--text-2)" }}>Cost: </span>
              <span style={{
                color: totalCostUsd > 0.05
                  ? "var(--danger)"
                  : totalCostUsd > 0.02
                    ? "var(--warn)"
                    : "var(--success)",
              }}>
                ${totalCostUsd.toFixed(4)}
              </span>
            </div>
            <div style={{
              padding: "6px 12px",
              background: "var(--bg-2)",
              border: "1px solid var(--border-1)",
              borderRadius: "var(--radius-sm)",
              fontSize: 12,
              fontFamily: "var(--font-geist-mono)",
            }}>
              <span style={{ color: "var(--text-2)" }}>Evals: </span>
              <span style={{ color: evalAccuracy >= 0.9 ? "var(--success)" : "var(--warn)" }}>
                {(evalAccuracy * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}
