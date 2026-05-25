import time
from datetime import datetime, timezone
from pathlib import Path

import yaml

from ..state import BackhaulState, GraphEvent, Marketplace, MarketplacePolicySchema

# ---------------------------------------------------------------------------
# Path resolution — walk up from nodes/ to project root
# parents[0]=nodes, [1]=graph, [2]=app, [3]=agent, [4]=apps, [5]=project root
# ---------------------------------------------------------------------------
_CONFIG_DIR = Path(__file__).parents[5] / "config" / "marketplaces"

# ---------------------------------------------------------------------------
# In-memory policy cache (loaded lazily per marketplace)
# ---------------------------------------------------------------------------
_POLICY_CACHE: dict[str, MarketplacePolicySchema] = {}

# ---------------------------------------------------------------------------
# Fallback defaults used when YAML is missing or malformed
# ---------------------------------------------------------------------------
_FALLBACK_DEFAULTS: dict[str, dict] = {
    "wayfair": {
        "return_window_days": 30,
        "freight_subsidy_pct": 0.50,
        "damage_allowance_pct": 0.15,
        "restocking_fee_pct": 0.0,
        "decisioning_window_days": 5,
        "auto_decide_ceiling_cents": 150000,
    },
    "amazon_fba": {
        "return_window_days": 30,
        "freight_subsidy_pct": 1.0,
        "damage_allowance_pct": 0.10,
        "restocking_fee_pct": 0.0,
        "decisioning_window_days": 3,
        "auto_decide_ceiling_cents": 200000,
    },
    "amazon_fbm": {
        "return_window_days": 30,
        "freight_subsidy_pct": 0.0,
        "damage_allowance_pct": 0.10,
        "restocking_fee_pct": 0.20,
        "decisioning_window_days": 5,
        "auto_decide_ceiling_cents": 100000,
    },
    "houzz": {
        "return_window_days": 45,
        "freight_subsidy_pct": 0.25,
        "damage_allowance_pct": 0.20,
        "restocking_fee_pct": 0.15,
        "decisioning_window_days": 7,
        "auto_decide_ceiling_cents": 300000,
    },
    "overstock": {
        "return_window_days": 30,
        "freight_subsidy_pct": 0.30,
        "damage_allowance_pct": 0.12,
        "restocking_fee_pct": 0.25,
        "decisioning_window_days": 5,
        "auto_decide_ceiling_cents": 80000,
    },
    "shopify": {
        "return_window_days": 60,
        "freight_subsidy_pct": 0.0,
        "damage_allowance_pct": 0.0,
        "restocking_fee_pct": 0.0,
        "decisioning_window_days": 10,
        "auto_decide_ceiling_cents": 500000,
    },
}

_DEFAULT_POLICY_FIELDS = {
    "return_window_days": 30,
    "freight_subsidy_pct": 0.0,
    "damage_allowance_pct": 0.0,
    "restocking_fee_pct": 0.0,
    "decisioning_window_days": 5,
    "auto_decide_ceiling_cents": 100000,
}


def _build_fallback_policy(marketplace: str) -> MarketplacePolicySchema:
    """Return a MarketplacePolicySchema using hardcoded defaults."""
    base = _FALLBACK_DEFAULTS.get(marketplace, _DEFAULT_POLICY_FIELDS)
    return MarketplacePolicySchema(
        marketplace=marketplace,
        return_window_days=int(base.get("return_window_days", 30)),
        freight_subsidy_pct=float(base.get("freight_subsidy_pct", 0.0)),
        damage_allowance_pct=float(base.get("damage_allowance_pct", 0.0)),
        restocking_fee_pct=float(base.get("restocking_fee_pct", 0.0)),
        decisioning_window_days=int(base.get("decisioning_window_days", 5)),
        auto_decide_ceiling_cents=int(base.get("auto_decide_ceiling_cents", 100000)),
    )


def _load_policy(marketplace: str) -> MarketplacePolicySchema:
    """
    Load policy for a marketplace, with three-tier resolution:
      1. In-memory cache
      2. YAML file in config/marketplaces/
      3. Hardcoded fallback defaults
    """
    if marketplace in _POLICY_CACHE:
        return _POLICY_CACHE[marketplace]

    yaml_path = _CONFIG_DIR / f"{marketplace}.yaml"
    if yaml_path.exists():
        try:
            with open(yaml_path, encoding="utf-8") as fh:
                data = yaml.safe_load(fh) or {}

            # YAML uses nested structure; flatten to MarketplacePolicySchema fields
            return_policy = data.get("return_policy", {})
            freight = data.get("freight", {})
            damage = data.get("damage_handling", {})
            restocking = data.get("restocking", {})
            decisioning = data.get("decisioning", {})

            policy = MarketplacePolicySchema(
                marketplace=marketplace,
                return_window_days=int(
                    return_policy.get("return_window_days", data.get("return_window_days", 30))
                ),
                freight_subsidy_pct=float(
                    freight.get("subsidy_pct", data.get("freight_subsidy_pct", 0.0))
                )
                / 100.0
                if freight.get("subsidy_pct", 0) > 1
                else float(freight.get("subsidy_pct", data.get("freight_subsidy_pct", 0.0))),
                damage_allowance_pct=float(
                    damage.get("damage_allowance_pct", data.get("damage_allowance_pct", 0.0))
                ),
                restocking_fee_pct=float(
                    restocking.get("restocking_fee_pct", data.get("restocking_fee_pct", 0.0))
                ),
                decisioning_window_days=int(
                    decisioning.get("window_days", data.get("decisioning_window_days", 5))
                ),
                auto_decide_ceiling_cents=int(
                    decisioning.get(
                        "auto_decide_ceiling_cents", data.get("auto_decide_ceiling_cents", 100000)
                    )
                ),
            )
            _POLICY_CACHE[marketplace] = policy
            return policy
        except Exception:
            # YAML parse error — fall through to defaults
            pass

    # Fallback
    policy = _build_fallback_policy(marketplace)
    _POLICY_CACHE[marketplace] = policy
    return policy


# ---------------------------------------------------------------------------
# LangGraph node
# ---------------------------------------------------------------------------


def marketplace_policy_agent(state: BackhaulState) -> dict:
    node_name = "marketplace_policy_agent"
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
        marketplace: Marketplace = state.get("marketplace", "wayfair")
        policy = _load_policy(marketplace)
        yaml_path = _CONFIG_DIR / f"{marketplace}.yaml"
        source = "yaml" if yaml_path.exists() else "fallback"

        elapsed_ms = int((time.monotonic() - t0) * 1000)
        new_events.append(
            GraphEvent(
                run_id=state["run_id"],
                event_type="node_completed",
                node_name=node_name,
                timestamp=datetime.now(timezone.utc).isoformat(),
                data={"source": source, "latency_ms": elapsed_ms},
                cost_delta_usd=0.0,
                total_cost_usd=0.0,
            )
        )
        return {"marketplace_policy": policy, "events": new_events, "total_cost_usd": 0.0}
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
