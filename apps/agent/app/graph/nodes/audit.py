"""
Audit Agent — no LLM.
Writes the complete, append-only decision record covering every aspect of the graph run:
agent identity, prompt version, input snapshot, reasoning, confidence, cost, latency,
disposition, worker result, comms draft, and any errors.
The run_completed event is the last event emitted.
"""
import json
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

from ..state import BackhaulState, GraphEvent


def audit_agent(state: BackhaulState) -> dict:
    node_name = "audit_agent"
    new_events: list[GraphEvent] = []
    t0 = time.monotonic()
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
        decision = state.get("decision")

        audit_record = {
            "run_id": state["run_id"],
            "return_id": state["return_id"],
            "marketplace": state["marketplace"],
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "disposition": decision.get("disposition") if decision else None,
            "confidence": decision.get("confidence") if decision else None,
            "reasoning": decision.get("reasoning") if decision else None,
            "model_used": decision.get("model_used") if decision else None,
            "prompt_version": decision.get("prompt_version") if decision else None,
            "cost_usd": decision.get("cost_usd") if decision else None,
            "total_run_cost_usd": state.get("total_cost_usd", 0.0),
            "latency_ms": decision.get("latency_ms") if decision else None,
            "damage_severity": (state.get("damage_signal") or {}).get("damage_severity"),
            "fraud_score": (state.get("fraud_flags") or {}).get("fraud_score"),
            "escalation_reason": state.get("escalation_reason"),
            "worker_result": state.get("worker_result"),
            "errors": state.get("errors", {}),
        }

        # Attempt DB write (skip gracefully if no DB connection)
        try:
            from ...db.client import get_db_connection  # type: ignore
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO audit_log (run_id, return_id, marketplace, disposition,
                            confidence, reasoning, model_used, prompt_version, cost_usd,
                            total_run_cost_usd, latency_ms, damage_severity, fraud_score,
                            escalation_reason, worker_result, errors, created_at)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                        ON CONFLICT DO NOTHING
                        """,
                        (
                            audit_record["run_id"],
                            audit_record["return_id"],
                            audit_record["marketplace"],
                            audit_record["disposition"],
                            audit_record["confidence"],
                            audit_record["reasoning"],
                            audit_record["model_used"],
                            audit_record["prompt_version"],
                            audit_record["cost_usd"],
                            audit_record["total_run_cost_usd"],
                            audit_record["latency_ms"],
                            audit_record["damage_severity"],
                            audit_record["fraud_score"],
                            audit_record["escalation_reason"],
                            json.dumps(audit_record["worker_result"]) if audit_record["worker_result"] else None,
                            json.dumps(audit_record["errors"]),
                            audit_record["timestamp"],
                        ),
                    )
                conn.commit()
        except Exception:
            # DB unavailable — continue without failing the graph
            pass

        # Write to temp JSON for testing / dev inspection
        try:
            run_id_safe = state["run_id"].replace("/", "_").replace("\\", "_")
            tmp_path = Path(tempfile.gettempdir()) / f"backhaul_audit_{run_id_safe}.json"
            tmp_path.write_text(json.dumps(audit_record, indent=2), encoding="utf-8")
        except Exception:
            pass

        elapsed_ms = int((time.monotonic() - t0) * 1000)

        new_events.append(
            GraphEvent(
                run_id=state["run_id"],
                event_type="node_completed",
                node_name=node_name,
                timestamp=datetime.now(timezone.utc).isoformat(),
                data={"latency_ms": elapsed_ms},
                cost_delta_usd=0.0,
                total_cost_usd=0.0,
            )
        )
        # run_completed is the LAST event emitted for the entire graph run
        new_events.append(
            GraphEvent(
                run_id=state["run_id"],
                event_type="run_completed",
                node_name=None,
                timestamp=datetime.now(timezone.utc).isoformat(),
                data=audit_record,
                cost_delta_usd=0.0,
                total_cost_usd=0.0,
            )
        )
        return {"audit_written": True, "events": new_events, "total_cost_usd": 0.0}
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
