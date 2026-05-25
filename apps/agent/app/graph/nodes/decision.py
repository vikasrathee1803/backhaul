from datetime import datetime, timezone

from ..state import BackhaulState, DispositionDecisionSchema, GraphEvent


def decision_agent(state: BackhaulState) -> dict:
    node_name = "decision_agent"
    new_events: list[GraphEvent] = []
    new_events.append(
        GraphEvent(
            run_id=state["run_id"],
            event_type="node_started",
            node_name=node_name,
            timestamp=datetime.now(timezone.utc).isoformat(),
            data={},
            cost_delta_usd=0.0,
            total_cost_usd=0.0,
        )
    )
    try:
        # STUB: In Phase 3, this calls claude-sonnet to make the disposition decision
        # using all upstream context: intake, customer_history, sku_profile,
        # marketplace_policy, damage_signal, fraud_flags
        fraud_flags = state.get("fraud_flags")
        damage_signal = state.get("damage_signal")
        sku_profile = state.get("sku_profile")
        marketplace_policy = state.get("marketplace_policy")

        # Stub decisioning logic
        disposition = "refurbish"
        confidence = 0.87
        reasoning = "Stub: freight + refurb < open box value"

        if fraud_flags and fraud_flags.get("exceeds_fraud_threshold"):
            disposition = "escalate"
            confidence = 0.95
            reasoning = "Stub: fraud threshold exceeded, escalating for human review"
        elif damage_signal and damage_signal.get("damage_severity") == "total_loss":
            disposition = "dispose"
            confidence = 0.91
            reasoning = "Stub: total loss item, disposal is most economical"
        elif damage_signal and damage_signal.get("repair_feasibility") == "feasible":
            refurb_cost = sku_profile["refurb_cost_estimate_cents"] if sku_profile else 15000
            open_box_value = sku_profile["open_box_price_estimate_cents"] if sku_profile else 80000
            order_total = 129900
            if marketplace_policy:
                freight_subsidy = marketplace_policy.get("freight_subsidy_pct", 0.0)
                freight_cost = 18400 * (1.0 - freight_subsidy)
            else:
                freight_cost = 18400
            net_refurb_value = open_box_value - refurb_cost - freight_cost
            if net_refurb_value > order_total * 0.3:
                disposition = "refurbish"
                confidence = 0.87
                reasoning = (
                    f"Stub: refurb net value ${net_refurb_value / 100:.2f} exceeds "
                    f"30% of order total ${order_total / 100:.2f}"
                )
            else:
                disposition = "refund"
                confidence = 0.82
                reasoning = "Stub: refurb economics unfavorable, issuing refund"

        cost_delta = 0.0082  # stub cost for sonnet decision call

        decision: DispositionDecisionSchema = {
            "disposition": disposition,
            "confidence": confidence,
            "reasoning": reasoning,
            "prompt_version": "v1",
            "model_used": "claude-sonnet-4-6",
            "input_tokens": 800,
            "output_tokens": 200,
            "cost_usd": cost_delta,
            "latency_ms": 1240,
            "candidate_dispositions": [],
        }
        new_events.append(
            GraphEvent(
                run_id=state["run_id"],
                event_type="node_completed",
                node_name=node_name,
                timestamp=datetime.now(timezone.utc).isoformat(),
                data={"disposition": disposition, "confidence": confidence, "latency_ms": 1240},
                cost_delta_usd=cost_delta,
                total_cost_usd=cost_delta,
            )
        )
        new_events.append(
            GraphEvent(
                run_id=state["run_id"],
                event_type="decision_made",
                node_name=node_name,
                timestamp=datetime.now(timezone.utc).isoformat(),
                data={"disposition": disposition, "confidence": confidence, "reasoning": reasoning},
                cost_delta_usd=0.0,
                total_cost_usd=0.0,
            )
        )
        return {"decision": decision, "events": new_events, "total_cost_usd": cost_delta}
    except Exception as e:
        new_events.append(
            GraphEvent(
                run_id=state["run_id"],
                event_type="node_failed",
                node_name=node_name,
                timestamp=datetime.now(timezone.utc).isoformat(),
                data={"error": str(e)},
                cost_delta_usd=0.0,
                total_cost_usd=0.0,
            )
        )
        return {"errors": {node_name: str(e)}, "events": new_events, "total_cost_usd": 0.0}
