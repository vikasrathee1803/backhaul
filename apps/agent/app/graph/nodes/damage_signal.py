import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path

import anthropic

from ..state import BackhaulState, DamageSignalSchema, GraphEvent

# Try to load versioned prompt, fall back to inline
_PROMPT_PATH = Path(__file__).parents[4] / "prompts" / "damage_signal_v1.md"

_SYSTEM_PROMPT = """You analyze damage descriptions for furniture and appliance returns.

Severity levels:
- none: no damage mentioned
- cosmetic: scratches, scuffs, dents that don't affect function
- functional: damage affecting use (broken mechanism, won't close/open, electrical issue)
- structural: frame/structural damage, safety concern, bent frame
- total_loss: beyond repair, severe destruction, multiple critical systems damaged

Repair feasibility:
- feasible: standard repair, common parts, < 4 hours labor
- uncertain: complex repair, unclear if parts available, specialized skill needed
- not_feasible: structural/total_loss, repair cost exceeds item value

damage_components: list specific parts mentioned (e.g., ["left armrest", "seat cushion", "drawer slide"])
has_damage: true if any damage described
raw_signal: the original condition notes text verbatim

Output ONLY valid JSON:
{"has_damage": bool, "damage_severity": "none|cosmetic|functional|structural|total_loss", "damage_components": ["str"], "repair_feasibility": "feasible|uncertain|not_feasible", "raw_signal": "str"}"""


def _get_system_prompt() -> str:
    if _PROMPT_PATH.exists():
        return _PROMPT_PATH.read_text(encoding="utf-8")
    return _SYSTEM_PROMPT


def _build_fallback_damage_signal(condition_notes: str) -> DamageSignalSchema:
    return DamageSignalSchema(
        has_damage=False,
        damage_severity="none",
        damage_components=[],
        repair_feasibility="not_feasible",
        raw_signal=condition_notes,
    )


def _parse_damage_signal_response(raw: str, condition_notes: str) -> DamageSignalSchema:
    """Parse LLM response into DamageSignalSchema. Falls back on any error."""
    try:
        text = raw.strip()
        # Strip markdown code fences if present
        if text.startswith("```"):
            lines = text.split("\n")
            inner = "\n".join(lines[1:])
            if "```" in inner:
                inner = inner[: inner.rfind("```")]
            text = inner.strip()
        data = json.loads(text)
        return DamageSignalSchema(
            has_damage=bool(data.get("has_damage", False)),
            damage_severity=str(data.get("damage_severity", "none")),
            damage_components=list(data.get("damage_components", [])),
            repair_feasibility=str(data.get("repair_feasibility", "not_feasible")),
            raw_signal=str(data.get("raw_signal", condition_notes)),
        )
    except Exception:
        return _build_fallback_damage_signal(condition_notes)


def damage_signal_agent(state: BackhaulState) -> dict:
    node_name = "damage_signal_agent"
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
        intake = state.get("intake")
        condition_notes = intake["condition_notes"] if intake else state.get("raw_return_text", "")

        # If there are no condition notes, skip the LLM call
        if not condition_notes or not condition_notes.strip():
            damage_signal = _build_fallback_damage_signal(condition_notes or "")
            cost_delta = 0.0
        else:
            api_key = os.environ.get("ANTHROPIC_API_KEY", "")
            cost_delta = 0.0

            if api_key and api_key not in ("sk-ant-test", "sk-placeholder"):
                client = anthropic.Anthropic(api_key=api_key)
                response = client.messages.create(
                    model="claude-haiku-4-5-20251001",
                    max_tokens=512,
                    system=_get_system_prompt(),
                    messages=[{"role": "user", "content": condition_notes}],
                )
                raw_output = response.content[0].text
                damage_signal = _parse_damage_signal_response(raw_output, condition_notes)
                # Haiku pricing: $0.80/M input, $4.00/M output
                cost_delta = (
                    response.usage.input_tokens * 0.80
                    + response.usage.output_tokens * 4.00
                ) / 1_000_000
            else:
                # No live API key — use fallback
                damage_signal = _build_fallback_damage_signal(condition_notes)
                cost_delta = 0.0

        elapsed_ms = int((time.monotonic() - t0) * 1000)
        new_events.append(
            GraphEvent(
                run_id=state["run_id"],
                event_type="node_completed",
                node_name=node_name,
                timestamp=datetime.now(timezone.utc).isoformat(),
                data={
                    "latency_ms": elapsed_ms,
                    "has_damage": damage_signal["has_damage"],
                    "damage_severity": damage_signal["damage_severity"],
                },
                cost_delta_usd=cost_delta,
                total_cost_usd=state.get("total_cost_usd", 0.0) + cost_delta,
            )
        )
        return {
            "damage_signal": damage_signal,
            "events": new_events,
            "total_cost_usd": cost_delta,
        }
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
