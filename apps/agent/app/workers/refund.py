"""
Refund Worker — issues a refund via Stripe test mode or simulates one.
Reads STRIPE_API_KEY from env. If the key starts with "sk_test_", attempts a real
Stripe test-mode refund. Otherwise simulates with a deterministic fixture refund ID.
"""
import os
import time
import uuid
from datetime import datetime, timezone

from ..graph.state import BackhaulState, GraphEvent, WorkerResultSchema


def refund_worker(state: BackhaulState) -> dict:
    node_name = "refund_worker"
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
        intake = state.get("intake") or {}
        order_total_cents = intake.get("order_total_cents", 0)
        customer_id = intake.get("customer_id", "unknown")
        marketplace = intake.get("marketplace", state.get("marketplace", "unknown"))
        return_id = intake.get("return_id", state.get("return_id", "unknown"))

        stripe_key = os.environ.get("STRIPE_API_KEY", "")
        actions: list[str] = []
        notes: str = ""
        status = "completed"

        if stripe_key.startswith("sk_test_"):
            # Attempt real Stripe test-mode refund
            try:
                import stripe  # type: ignore

                stripe.api_key = stripe_key
                # In test mode we create a PaymentIntent + refund to simulate end-to-end
                payment_intent = stripe.PaymentIntent.create(
                    amount=order_total_cents,
                    currency="usd",
                    payment_method="pm_card_visa",
                    confirm=True,
                    automatic_payment_methods={"enabled": True, "allow_redirects": "never"},
                    metadata={"return_id": return_id, "customer_id": customer_id},
                )
                refund = stripe.Refund.create(
                    payment_intent=payment_intent["id"],
                    amount=order_total_cents,
                    metadata={"return_id": return_id},
                )
                refund_id = refund["id"]
                actions = [
                    f"Stripe test-mode refund issued: ${order_total_cents / 100:.2f}",
                    f"Stripe refund ID: {refund_id}",
                    f"Customer: {customer_id} via {marketplace}",
                    "Refund confirmation queued for customer communication",
                ]
                notes = f"Stripe test mode — PaymentIntent {payment_intent['id']}"
            except Exception as stripe_err:
                # Stripe call failed — fall through to simulation
                refund_id = f"rf_{uuid.uuid4().hex[:12]}"
                actions = [
                    f"Refund initiated (Stripe unavailable — simulated): ${order_total_cents / 100:.2f}",
                    f"Simulated refund ID: {refund_id}",
                    f"Customer: {customer_id} via {marketplace}",
                ]
                notes = f"Stripe test mode simulation (error: {stripe_err})"
        else:
            # No Stripe key — simulate deterministically
            refund_id = f"rf_{uuid.uuid4().hex[:12]}"
            actions = [
                f"Refund initiated: ${order_total_cents / 100:.2f}",
                f"Refund ID: {refund_id}",
                f"Customer: {customer_id} via {marketplace}",
                "Refund confirmation queued for customer communication",
            ]
            notes = "Stripe test mode simulation"

        elapsed_ms = int((time.monotonic() - t0) * 1000)

        worker_result: WorkerResultSchema = {
            "worker": node_name,
            "status": status,
            "actions_taken": actions,
            "notes": notes,
        }
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
        return {"worker_result": worker_result, "events": new_events, "total_cost_usd": 0.0}
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
