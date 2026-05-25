import os
from datetime import datetime, timezone

import yaml

from ..state import BackhaulState, GraphEvent, Marketplace, MarketplacePolicySchema

# Stub defaults per marketplace
_STUB_POLICIES: dict[str, MarketplacePolicySchema] = {
    "wayfair": {
        "marketplace": "wayfair",
        "return_window_days": 30,
        "freight_subsidy_pct": 0.50,
        "damage_allowance_pct": 0.15,
        "restocking_fee_pct": 0.0,
        "decisioning_window_days": 5,
        "auto_decide_ceiling_cents": 150000,
    },
    "amazon_fba": {
        "marketplace": "amazon_fba",
        "return_window_days": 30,
        "freight_subsidy_pct": 1.0,
        "damage_allowance_pct": 0.10,
        "restocking_fee_pct": 0.0,
        "decisioning_window_days": 3,
        "auto_decide_ceiling_cents": 200000,
    },
    "amazon_fbm": {
        "marketplace": "amazon_fbm",
        "return_window_days": 30,
        "freight_subsidy_pct": 0.0,
        "damage_allowance_pct": 0.10,
        "restocking_fee_pct": 0.20,
        "decisioning_window_days": 5,
        "auto_decide_ceiling_cents": 100000,
    },
    "houzz": {
        "marketplace": "houzz",
        "return_window_days": 45,
        "freight_subsidy_pct": 0.25,
        "damage_allowance_pct": 0.20,
        "restocking_fee_pct": 0.15,
        "decisioning_window_days": 7,
        "auto_decide_ceiling_cents": 300000,
    },
    "overstock": {
        "marketplace": "overstock",
        "return_window_days": 30,
        "freight_subsidy_pct": 0.30,
        "damage_allowance_pct": 0.12,
        "restocking_fee_pct": 0.25,
        "decisioning_window_days": 5,
        "auto_decide_ceiling_cents": 80000,
    },
    "shopify": {
        "marketplace": "shopify",
        "return_window_days": 60,
        "freight_subsidy_pct": 0.0,
        "damage_allowance_pct": 0.0,
        "restocking_fee_pct": 0.0,
        "decisioning_window_days": 10,
        "auto_decide_ceiling_cents": 500000,
    },
}


def _load_yaml_policy(marketplace: str) -> MarketplacePolicySchema | None:
    """Try to load policy from config/marketplaces/{marketplace}.yaml."""
    search_paths = [
        os.path.join(os.getcwd(), "config", "marketplaces", f"{marketplace}.yaml"),
        os.path.join(
            os.path.dirname(__file__),
            "..",
            "..",
            "..",
            "..",
            "config",
            "marketplaces",
            f"{marketplace}.yaml",
        ),
    ]
    for path in search_paths:
        if os.path.exists(path):
            with open(path) as fh:
                data = yaml.safe_load(fh)
            if data:
                return MarketplacePolicySchema(**data)
    return None


def marketplace_policy_agent(state: BackhaulState) -> dict:
    node_name = "marketplace_policy_agent"
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
        marketplace: Marketplace = state.get("marketplace", "wayfair")
        # Try YAML first, fall back to stub
        policy = _load_yaml_policy(marketplace)
        source = "yaml" if policy else "stub"
        if policy is None:
            policy = _STUB_POLICIES.get(marketplace, _STUB_POLICIES["wayfair"])

        new_events.append(
            GraphEvent(
                run_id=state["run_id"],
                event_type="node_completed",
                node_name=node_name,
                timestamp=datetime.now(timezone.utc).isoformat(),
                data={"source": source, "latency_ms": 18},
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
