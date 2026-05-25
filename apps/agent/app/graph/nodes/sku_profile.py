import json
import time
from datetime import datetime, timezone
from pathlib import Path

from ..state import BackhaulState, GraphEvent, SkuProfileSchema

# ---------------------------------------------------------------------------
# Module-level fixture cache — loaded once at import time
# ---------------------------------------------------------------------------
_FIXTURE_PATH = Path(__file__).parents[3] / "fixtures" / "skus.json"

_SKUS: dict[str, dict] = {}


def _load_fixtures() -> None:
    """Populate _SKUS keyed by sku_code from fixture file."""
    global _SKUS
    if _FIXTURE_PATH.exists():
        raw: list[dict] = json.loads(_FIXTURE_PATH.read_text(encoding="utf-8"))
        _SKUS = {s["sku_code"]: s for s in raw}


_load_fixtures()


# ---------------------------------------------------------------------------
# Public helpers (exported for tests and downstream agents)
# ---------------------------------------------------------------------------


def _build_fallback_sku_profile(sku_code: str) -> SkuProfileSchema:
    return SkuProfileSchema(
        sku_code=sku_code,
        name="Unknown SKU",
        weight_lbs=0.0,
        freight_class="unknown",
        refurb_difficulty="not_feasible",
        open_box_price_estimate_cents=0,
        refurb_cost_estimate_cents=0,
        current_stock=0,
    )


def _lookup_sku(sku_code: str) -> SkuProfileSchema:
    """Return SkuProfileSchema for a known sku_code, or fallback."""
    sku = _SKUS.get(sku_code)
    if sku is None:
        return _build_fallback_sku_profile(sku_code)

    return SkuProfileSchema(
        sku_code=sku_code,
        name=str(sku.get("name", "Unknown")),
        weight_lbs=float(sku.get("weight_lbs", 0.0)),
        freight_class=str(sku.get("freight_class", "unknown")),
        refurb_difficulty=str(sku.get("refurb_difficulty", "not_feasible")),
        open_box_price_estimate_cents=int(sku.get("open_box_price_estimate_cents", 0)),
        refurb_cost_estimate_cents=int(sku.get("refurb_cost_estimate_cents", 0)),
        current_stock=int(sku.get("current_stock", 0)),
    )


# ---------------------------------------------------------------------------
# LangGraph node
# ---------------------------------------------------------------------------


def sku_profile_agent(state: BackhaulState) -> dict:
    node_name = "sku_profile_agent"
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
        sku_code = intake["sku_code"] if intake else ""

        sku_profile = _lookup_sku(sku_code) if sku_code else _build_fallback_sku_profile(sku_code)

        elapsed_ms = int((time.monotonic() - t0) * 1000)
        new_events.append(
            GraphEvent(
                run_id=state["run_id"],
                event_type="node_completed",
                node_name=node_name,
                timestamp=datetime.now(timezone.utc).isoformat(),
                data={
                    "latency_ms": elapsed_ms,
                    "sku_code": sku_code,
                    "source": "fixture" if sku_code in _SKUS else "fallback",
                },
                cost_delta_usd=0.0,
                total_cost_usd=0.0,
            )
        )
        return {"sku_profile": sku_profile, "events": new_events, "total_cost_usd": 0.0}
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
