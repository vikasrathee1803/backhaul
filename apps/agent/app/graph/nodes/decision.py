"""
Decision Agent — the headline agent.
Makes the disposition decision using all upstream context via claude-sonnet-4-6,
with a deterministic rule-based fallback when no live API key is configured.
"""
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path

import anthropic

from ..state import BackhaulState, DispositionDecisionSchema, GraphEvent

# Try to load versioned prompt; fall back to inline
_PROMPT_PATH = Path(__file__).parents[4] / "prompts" / "decision_v1.md"

_SYSTEM_PROMPT = """You are the decision engine for a big-ticket returns triage system (furniture, appliances, heavy goods).

Analyze the provided return context and recommend the optimal disposition.

DISPOSITION OPTIONS:
- refund: issue full/partial refund to customer
- replace: send replacement item (only if stock available)
- repair: schedule repair pickup and service
- refurbish: route to refurb queue for grading and resale as Open Box
- donate: route item to local charity (low-weight items)
- dispose: arrange disposal via carrier (high-weight or total loss)
- escalate: route to human review (fraud, high value, low confidence)

DECISION FRAMEWORK:
1. FRAUD GATE: If fraud_score > 0.60 → escalate (non-negotiable)
2. TOTAL LOSS: If damage_severity == total_loss → dispose, unless LTV > $5000 then escalate
3. ECONOMICS: Calculate net_refurb_value = open_box_price - refurb_cost - (inbound_freight × (1 - freight_subsidy_pct))
4. REFURBISH: If net_refurb_value > 30% of order_total AND damage < structural AND refurb_difficulty != not_feasible → refurbish
5. REPAIR: If damage is cosmetic or functional AND repair_feasibility == feasible AND refurb_difficulty != not_feasible → repair
6. REPLACE: If return_reason == wrong_item AND current_stock > 0 → replace
7. DEFAULT: refund

ESCALATION OVERRIDE (apply after disposition chosen):
- If confidence < 0.70 → escalate
- If order_total > $1,500 (150000 cents) → escalate
- If lifetime_value > $5,000 (500000 cents) AND fraud_score > 0.30 → escalate

OUTPUT: Valid JSON only, no markdown, no explanation.
Schema: {"disposition": "...", "confidence": 0.0-1.0, "reasoning": "3-5 sentences citing specific numbers", "candidate_dispositions": [{"disposition": "...", "score": 0.0-1.0, "reason": "..."}]}"""


def _get_system_prompt() -> str:
    if _PROMPT_PATH.exists():
        return _PROMPT_PATH.read_text(encoding="utf-8")
    return _SYSTEM_PROMPT


def _build_context_string(state: BackhaulState) -> str:
    """Build a readable context block with pre-computed economics."""
    intake = state.get("intake") or {}
    customer_history = state.get("customer_history") or {}
    sku_profile = state.get("sku_profile") or {}
    marketplace_policy = state.get("marketplace_policy") or {}
    damage_signal = state.get("damage_signal") or {}
    fraud_flags = state.get("fraud_flags") or {}

    return_id = intake.get("return_id", state.get("return_id", "unknown"))
    marketplace = intake.get("marketplace", state.get("marketplace", "unknown"))
    return_reason = intake.get("return_reason", "unknown")
    order_total_cents = intake.get("order_total_cents", 0)
    inbound_freight_cost_cents = intake.get("inbound_freight_cost_cents", 0)
    condition = intake.get("condition", "unknown")
    condition_notes = intake.get("condition_notes", "")

    lifetime_value_cents = customer_history.get("lifetime_value_cents", 0)
    order_count = customer_history.get("order_count", 0)
    return_count = customer_history.get("return_count", 0)
    return_rate = customer_history.get("return_rate", 0.0)

    sku_code = sku_profile.get("sku_code", "unknown")
    sku_name = sku_profile.get("name", "unknown")
    weight_lbs = sku_profile.get("weight_lbs", 0.0)
    freight_class = sku_profile.get("freight_class", "unknown")
    refurb_difficulty = sku_profile.get("refurb_difficulty", "unknown")
    open_box_price_estimate_cents = sku_profile.get("open_box_price_estimate_cents", 0)
    refurb_cost_estimate_cents = sku_profile.get("refurb_cost_estimate_cents", 0)
    current_stock = sku_profile.get("current_stock", 0)

    return_window_days = marketplace_policy.get("return_window_days", 30)
    freight_subsidy_pct = marketplace_policy.get("freight_subsidy_pct", 0.0)
    damage_allowance_pct = marketplace_policy.get("damage_allowance_pct", 0.0)

    damage_severity = damage_signal.get("damage_severity", "none")
    damage_components = damage_signal.get("damage_components", [])
    repair_feasibility = damage_signal.get("repair_feasibility", "uncertain")

    fraud_score = fraud_flags.get("fraud_score", 0.0)
    flags = fraud_flags.get("flags", [])
    exceeds_fraud_threshold = fraud_flags.get("exceeds_fraud_threshold", False)

    # Pre-compute economics
    freight_cost_net = inbound_freight_cost_cents * (1.0 - freight_subsidy_pct)
    net_refurb_value = open_box_price_estimate_cents - refurb_cost_estimate_cents - freight_cost_net

    return f"""RETURN: {return_id} | {marketplace} | {return_reason}
ORDER TOTAL: ${order_total_cents / 100:.2f}
INBOUND FREIGHT: ${inbound_freight_cost_cents / 100:.2f}
CONDITION: {condition} — {condition_notes}

CUSTOMER: LTV ${lifetime_value_cents / 100:.2f} | {order_count} orders | {return_count} returns ({return_rate:.0%} rate)

SKU: {sku_code} — {sku_name} | {weight_lbs} lbs | {freight_class}
REFURB DIFFICULTY: {refurb_difficulty}
OPEN BOX EST: ${open_box_price_estimate_cents / 100:.2f}
REFURB COST EST: ${refurb_cost_estimate_cents / 100:.2f}
CURRENT STOCK: {current_stock}

POLICY ({marketplace}): {return_window_days}d window | {freight_subsidy_pct:.0%} freight subsidy | {damage_allowance_pct:.0%} damage allowance

DAMAGE: {damage_severity} — {damage_components} | Repair: {repair_feasibility}

FRAUD: score={fraud_score:.2f} | flags={flags} | exceeds_threshold={exceeds_fraud_threshold}

ECONOMICS:
  Net freight cost: ${freight_cost_net / 100:.2f} (after {freight_subsidy_pct:.0%} subsidy)
  Net refurb value: ${net_refurb_value / 100:.2f} (open_box - refurb_cost - net_freight)
  30% of order: ${order_total_cents * 0.30 / 100:.2f}"""


def _parse_decision_response(raw_text: str, prompt_version: str = "v1") -> DispositionDecisionSchema:
    """Parse LLM JSON response into DispositionDecisionSchema. Falls back on any error."""
    valid_dispositions = {"refund", "replace", "repair", "refurbish", "donate", "dispose", "escalate"}
    try:
        text = raw_text.strip()
        # Strip markdown code fences if present
        if text.startswith("```"):
            lines = text.split("\n")
            inner = "\n".join(lines[1:])
            if "```" in inner:
                inner = inner[: inner.rfind("```")]
            text = inner.strip()
        data = json.loads(text)
        disposition = str(data.get("disposition", "escalate"))
        if disposition not in valid_dispositions:
            disposition = "escalate"
        return DispositionDecisionSchema(
            disposition=disposition,
            confidence=float(data.get("confidence", 0.65)),
            reasoning=str(data.get("reasoning", "LLM response parsed successfully.")),
            prompt_version=prompt_version,
            model_used="claude-sonnet-4-6",
            input_tokens=0,  # filled in by caller
            output_tokens=0,  # filled in by caller
            cost_usd=0.0,     # filled in by caller
            latency_ms=0,     # filled in by caller
            candidate_dispositions=list(data.get("candidate_dispositions", [])),
        )
    except Exception:
        return DispositionDecisionSchema(
            disposition="escalate",
            confidence=0.55,
            reasoning="Failed to parse LLM response — escalating for safety.",
            prompt_version=prompt_version,
            model_used="claude-sonnet-4-6",
            input_tokens=0,
            output_tokens=0,
            cost_usd=0.0,
            latency_ms=0,
            candidate_dispositions=[],
        )


def _rule_based_fallback_decision(
    fraud_score: float,
    damage_severity: str,
    repair_feasibility: str,
    return_reason: str,
    current_stock: int,
    order_total_cents: int,
    net_refurb_value: float,
    lifetime_value_cents: int,
    refurb_difficulty: str,
) -> DispositionDecisionSchema:
    """
    Deterministic rule-based decision for use when no API key is available.
    Also used as a test target for golden case evals.
    """
    # 1. Fraud gate (non-negotiable)
    if fraud_score > 0.60:
        return DispositionDecisionSchema(
            disposition="escalate",
            confidence=0.95,
            reasoning=f"Fraud score {fraud_score:.2f} exceeds threshold of 0.60. Non-negotiable escalation.",
            prompt_version="fallback",
            model_used="fallback_rules",
            input_tokens=0,
            output_tokens=0,
            cost_usd=0.0,
            latency_ms=0,
            candidate_dispositions=[],
        )

    # 2. Total loss
    if damage_severity == "total_loss":
        if lifetime_value_cents > 500000:
            return DispositionDecisionSchema(
                disposition="escalate",
                confidence=0.88,
                reasoning=(
                    f"Total loss item with high-value customer (LTV ${lifetime_value_cents / 100:.2f}). "
                    "Escalating for human assessment to protect customer relationship."
                ),
                prompt_version="fallback",
                model_used="fallback_rules",
                input_tokens=0,
                output_tokens=0,
                cost_usd=0.0,
                latency_ms=0,
                candidate_dispositions=[],
            )
        return DispositionDecisionSchema(
            disposition="dispose",
            confidence=0.91,
            reasoning="Total loss item — repair or refurbish is not feasible. Routing to responsible disposal.",
            prompt_version="fallback",
            model_used="fallback_rules",
            input_tokens=0,
            output_tokens=0,
            cost_usd=0.0,
            latency_ms=0,
            candidate_dispositions=[],
        )

    # 3. Refurb economics check
    disposition = "refund"
    confidence = 0.78
    reasoning = "Default disposition: refund."

    if (
        net_refurb_value > order_total_cents * 0.30
        and damage_severity not in ("structural", "total_loss")
        and refurb_difficulty != "not_feasible"
    ):
        disposition = "refurbish"
        confidence = 0.87
        reasoning = (
            f"Net refurb value ${net_refurb_value / 100:.2f} exceeds 30% of order "
            f"${order_total_cents / 100:.2f} (threshold ${order_total_cents * 0.30 / 100:.2f}). "
            "Item damage is non-structural and refurb is feasible."
        )
    elif (
        damage_severity in ("cosmetic", "functional")
        and repair_feasibility == "feasible"
        and refurb_difficulty != "not_feasible"
    ):
        disposition = "repair"
        confidence = 0.83
        reasoning = (
            f"Damage severity is {damage_severity} and repair_feasibility is confirmed feasible. "
            "Repair is the most economical path before refurb assessment."
        )
    elif return_reason == "wrong_item" and current_stock > 0:
        disposition = "replace"
        confidence = 0.90
        reasoning = f"Wrong item return with {current_stock} units in stock. Direct replacement is appropriate."
    else:
        disposition = "refund"
        confidence = 0.78
        reasoning = "Default disposition: refund. No refurb, repair, or replace criteria met."

    # 4. Escalation override (apply after disposition chosen)
    if confidence < 0.70:
        disposition = "escalate"
        confidence = 0.85
        reasoning = f"Escalating due to low decision confidence ({confidence:.0%} below 70% threshold)."
    elif order_total_cents > 150000:
        disposition = "escalate"
        confidence = 0.85
        reasoning = (
            f"Order total ${order_total_cents / 100:.2f} exceeds auto-decide ceiling of $1,500. "
            "Routing to human review."
        )
    elif lifetime_value_cents > 500000 and fraud_score > 0.30:
        disposition = "escalate"
        confidence = 0.85
        reasoning = (
            f"High-value customer (LTV ${lifetime_value_cents / 100:.2f}) with elevated fraud risk "
            f"(score {fraud_score:.2f}). Escalating to protect both parties."
        )

    return DispositionDecisionSchema(
        disposition=disposition,
        confidence=confidence,
        reasoning=reasoning,
        prompt_version="fallback",
        model_used="fallback_rules",
        input_tokens=0,
        output_tokens=0,
        cost_usd=0.0,
        latency_ms=0,
        candidate_dispositions=[],
    )


def decision_agent(state: BackhaulState) -> dict:
    node_name = "decision_agent"
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
        sku_profile = state.get("sku_profile") or {}
        marketplace_policy = state.get("marketplace_policy") or {}
        damage_signal = state.get("damage_signal") or {}
        fraud_flags = state.get("fraud_flags") or {}
        customer_history = state.get("customer_history") or {}

        # Pre-compute economics for fallback
        order_total_cents = intake.get("order_total_cents", 0)
        inbound_freight_cost_cents = intake.get("inbound_freight_cost_cents", 0)
        freight_subsidy_pct = marketplace_policy.get("freight_subsidy_pct", 0.0)
        open_box_price_estimate_cents = sku_profile.get("open_box_price_estimate_cents", 0)
        refurb_cost_estimate_cents = sku_profile.get("refurb_cost_estimate_cents", 0)
        freight_cost_net = inbound_freight_cost_cents * (1.0 - freight_subsidy_pct)
        net_refurb_value = (
            open_box_price_estimate_cents - refurb_cost_estimate_cents - freight_cost_net
        )

        fraud_score = fraud_flags.get("fraud_score", 0.0)
        damage_severity = damage_signal.get("damage_severity", "none")
        repair_feasibility = damage_signal.get("repair_feasibility", "uncertain")
        return_reason = intake.get("return_reason", "")
        current_stock = sku_profile.get("current_stock", 0)
        lifetime_value_cents = customer_history.get("lifetime_value_cents", 0)
        refurb_difficulty = sku_profile.get("refurb_difficulty", "moderate")

        api_key = os.environ.get("ANTHROPIC_API_KEY", "")
        cost_delta = 0.0
        input_tokens = 0
        output_tokens = 0

        if api_key and api_key not in ("sk-ant-test", "sk-placeholder", ""):
            # Real API call
            context_string = _build_context_string(state)
            client = anthropic.Anthropic(api_key=api_key)
            response = client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=1024,
                system=_get_system_prompt(),
                messages=[{"role": "user", "content": context_string}],
            )
            raw_output = response.content[0].text
            decision = _parse_decision_response(raw_output, prompt_version="v1")
            input_tokens = response.usage.input_tokens
            output_tokens = response.usage.output_tokens
            # Sonnet pricing: $3.00/M input, $15.00/M output
            cost_delta = (input_tokens * 3.00 + output_tokens * 15.00) / 1_000_000
        else:
            # No live API key — use deterministic rule-based fallback
            decision = _rule_based_fallback_decision(
                fraud_score=fraud_score,
                damage_severity=damage_severity,
                repair_feasibility=repair_feasibility,
                return_reason=return_reason,
                current_stock=current_stock,
                order_total_cents=order_total_cents,
                net_refurb_value=net_refurb_value,
                lifetime_value_cents=lifetime_value_cents,
                refurb_difficulty=refurb_difficulty,
            )
            cost_delta = 0.0

        elapsed_ms = int((time.monotonic() - t0) * 1000)

        # Fill in measured fields
        decision["input_tokens"] = input_tokens
        decision["output_tokens"] = output_tokens
        decision["cost_usd"] = cost_delta
        decision["latency_ms"] = elapsed_ms

        disposition = decision["disposition"]
        confidence = decision["confidence"]
        reasoning = decision["reasoning"]

        new_events.append(
            GraphEvent(
                run_id=state["run_id"],
                event_type="node_completed",
                node_name=node_name,
                timestamp=datetime.now(timezone.utc).isoformat(),
                data={
                    "disposition": disposition,
                    "confidence": confidence,
                    "latency_ms": elapsed_ms,
                },
                cost_delta_usd=cost_delta,
                total_cost_usd=state.get("total_cost_usd", 0.0) + cost_delta,
            )
        )
        new_events.append(
            GraphEvent(
                run_id=state["run_id"],
                event_type="decision_made",
                node_name=node_name,
                timestamp=datetime.now(timezone.utc).isoformat(),
                data={
                    "disposition": disposition,
                    "confidence": confidence,
                    "reasoning": reasoning,
                },
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
