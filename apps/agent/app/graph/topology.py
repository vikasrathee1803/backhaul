"""
Backhaul LangGraph topology — authoritative graph definition.
Every node, edge, and conditional is declared here.
See docs/01b-graph-topology.md for the specification this implements.
"""
from __future__ import annotations

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph

from ..workers.donate_dispose import donate_dispose_worker
from ..workers.refund import refund_worker
from ..workers.refurb import refurb_worker
from ..workers.repair import repair_worker
from ..workers.replacement import replacement_worker
from .nodes import (
    audit_agent,
    customer_comms_agent,
    customer_history_agent,
    damage_signal_agent,
    decision_agent,
    escalation_agent,
    fraud_flag_agent,
    intake_agent,
    marketplace_policy_agent,
    sku_profile_agent,
)
from .state import BackhaulState, Disposition


def _route_decision(state: BackhaulState) -> str:
    """Conditional edge: route from decision_agent to appropriate worker."""
    if state.get("decision") is None:
        return "escalation_agent"
    disposition: Disposition = state["decision"]["disposition"]
    routes: dict[Disposition, str] = {
        "refund": "refund_worker",
        "replace": "replacement_worker",
        "repair": "repair_worker",
        "refurbish": "refurb_worker",
        "donate": "donate_dispose_worker",
        "dispose": "donate_dispose_worker",
        "escalate": "escalation_agent",
    }
    return routes.get(disposition, "escalation_agent")


def build_graph() -> StateGraph:
    """Build and return the compiled Backhaul graph."""
    builder = StateGraph(BackhaulState)

    # --- Nodes ---
    builder.add_node("intake_agent", intake_agent)
    builder.add_node("customer_history_agent", customer_history_agent)
    builder.add_node("sku_profile_agent", sku_profile_agent)
    builder.add_node("marketplace_policy_agent", marketplace_policy_agent)
    builder.add_node("damage_signal_agent", damage_signal_agent)
    builder.add_node("fraud_flag_agent", fraud_flag_agent)
    builder.add_node("decision_agent", decision_agent)
    builder.add_node("refund_worker", refund_worker)
    builder.add_node("replacement_worker", replacement_worker)
    builder.add_node("repair_worker", repair_worker)
    builder.add_node("refurb_worker", refurb_worker)
    builder.add_node("donate_dispose_worker", donate_dispose_worker)
    builder.add_node("escalation_agent", escalation_agent)
    builder.add_node("customer_comms_agent", customer_comms_agent)
    builder.add_node("audit_agent", audit_agent)

    # --- Entry ---
    builder.add_edge(START, "intake_agent")

    # --- Parallel fan-out after intake ---
    _parallel_nodes = [
        "customer_history_agent",
        "sku_profile_agent",
        "marketplace_policy_agent",
        "damage_signal_agent",
        "fraud_flag_agent",
    ]
    for parallel_node in _parallel_nodes:
        builder.add_edge("intake_agent", parallel_node)

    # --- Fan-in: all parallel nodes converge on decision_agent ---
    for parallel_node in _parallel_nodes:
        builder.add_edge(parallel_node, "decision_agent")

    # --- Conditional routing from decision_agent to worker ---
    builder.add_conditional_edges(
        "decision_agent",
        _route_decision,
        {
            "refund_worker": "refund_worker",
            "replacement_worker": "replacement_worker",
            "repair_worker": "repair_worker",
            "refurb_worker": "refurb_worker",
            "donate_dispose_worker": "donate_dispose_worker",
            "escalation_agent": "escalation_agent",
        },
    )

    # --- All execution workers → customer_comms_agent ---
    for worker in [
        "refund_worker",
        "replacement_worker",
        "repair_worker",
        "refurb_worker",
        "donate_dispose_worker",
    ]:
        builder.add_edge(worker, "customer_comms_agent")

    # --- Escalation bypasses comms (human resolves) ---
    builder.add_edge("escalation_agent", "audit_agent")

    # --- Comms → audit → END ---
    builder.add_edge("customer_comms_agent", "audit_agent")
    builder.add_edge("audit_agent", END)

    return builder


# Module-level compiled graph (in-memory checkpointer for Phase 2)
_checkpointer = MemorySaver()
graph = build_graph().compile(checkpointer=_checkpointer)
