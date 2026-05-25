from datetime import datetime, timezone

from ..state import BackhaulState, DamageSignalSchema, GraphEvent


def damage_signal_agent(state: BackhaulState) -> dict:
    node_name = "damage_signal_agent"
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
        # STUB: In Phase 3, this calls claude-haiku to parse condition text / condition codes
        raw_text = state.get("raw_return_text", "")
        # Simple heuristic for stub: look for damage keywords
        has_damage = any(
            kw in raw_text.lower()
            for kw in ["damage", "broken", "crack", "defect", "scratch", "dent", "motor"]
        )
        damage_signal: DamageSignalSchema = {
            "has_damage": has_damage,
            "damage_severity": "structural" if has_damage else "none",
            "damage_components": ["frame_corner"] if has_damage else [],
            "repair_feasibility": "feasible" if has_damage else "not_feasible",
            "raw_signal": raw_text[:500],
        }
        cost_delta = 0.0003  # stub cost for haiku parse
        new_events.append(
            GraphEvent(
                run_id=state["run_id"],
                event_type="node_completed",
                node_name=node_name,
                timestamp=datetime.now(timezone.utc).isoformat(),
                data={"latency_ms": 310},
                cost_delta_usd=cost_delta,
                total_cost_usd=cost_delta,
            )
        )
        return {"damage_signal": damage_signal, "events": new_events, "total_cost_usd": cost_delta}
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
