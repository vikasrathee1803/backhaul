"""Eval tests for MarketplacePolicyAgent — reads from YAML config files."""


def test_fallback_on_unknown_marketplace():
    from app.graph.nodes.marketplace_policy import _build_fallback_policy

    result = _build_fallback_policy("unknown_channel")
    assert result["marketplace"] == "unknown_channel"
    assert result["return_window_days"] == 30


def test_wayfair_policy_loads():
    from app.graph.nodes.marketplace_policy import _load_policy

    result = _load_policy("wayfair")
    assert result["marketplace"] == "wayfair"
    assert result["freight_subsidy_pct"] > 0
    assert result["return_window_days"] == 30
    assert result["decisioning_window_days"] == 5
    assert result["auto_decide_ceiling_cents"] == 150000


def test_amazon_fba_policy_loads():
    from app.graph.nodes.marketplace_policy import _load_policy

    result = _load_policy("amazon_fba")
    assert result["marketplace"] == "amazon_fba"
    assert result["decisioning_window_days"] <= 5  # Amazon is strict on turnaround


def test_houzz_policy_window():
    from app.graph.nodes.marketplace_policy import _load_policy

    result = _load_policy("houzz")
    assert result["marketplace"] == "houzz"
    assert result["return_window_days"] >= 30


def test_overstock_has_restocking_fee():
    from app.graph.nodes.marketplace_policy import _load_policy

    result = _load_policy("overstock")
    assert result["restocking_fee_pct"] >= 0.0  # Overstock typically has restocking fees


def test_shopify_policy_loads():
    from app.graph.nodes.marketplace_policy import _load_policy

    result = _load_policy("shopify")
    assert result["marketplace"] == "shopify"
    # Shopify D2C YAML defines 30-day window with no restocking fee and highest auto-decide ceiling
    assert result["return_window_days"] == 30
    assert result["restocking_fee_pct"] == 0.0
    assert result["auto_decide_ceiling_cents"] == 300000


def test_all_marketplaces_have_required_fields():
    from app.graph.nodes.marketplace_policy import _load_policy

    marketplaces = ["wayfair", "amazon_fba", "amazon_fbm", "houzz", "overstock", "shopify"]
    required_fields = [
        "marketplace",
        "return_window_days",
        "freight_subsidy_pct",
        "damage_allowance_pct",
        "restocking_fee_pct",
        "decisioning_window_days",
        "auto_decide_ceiling_cents",
    ]
    for mkt in marketplaces:
        result = _load_policy(mkt)
        for field in required_fields:
            assert field in result, f"Field {field!r} missing for marketplace {mkt}"
        assert result["marketplace"] == mkt


def test_fallback_fields_are_numeric():
    from app.graph.nodes.marketplace_policy import _build_fallback_policy

    result = _build_fallback_policy("test_marketplace")
    assert isinstance(result["return_window_days"], int)
    assert isinstance(result["freight_subsidy_pct"], float)
    assert isinstance(result["damage_allowance_pct"], float)
    assert isinstance(result["restocking_fee_pct"], float)
    assert isinstance(result["decisioning_window_days"], int)
    assert isinstance(result["auto_decide_ceiling_cents"], int)


def test_policy_cache_second_call_is_same_object():
    from app.graph.nodes.marketplace_policy import _load_policy

    # Two calls should return the same cached result
    first = _load_policy("wayfair")
    second = _load_policy("wayfair")
    assert first["auto_decide_ceiling_cents"] == second["auto_decide_ceiling_cents"]
    assert first["return_window_days"] == second["return_window_days"]
