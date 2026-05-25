"""Eval tests for SkuProfileAgent — reads from fixture cache, no DB."""
import pytest


def test_fallback_on_unknown_sku():
    from app.graph.nodes.sku_profile import _build_fallback_sku_profile

    result = _build_fallback_sku_profile("SKU-UNKNOWN")
    assert result["sku_code"] == "SKU-UNKNOWN"
    assert result["refurb_difficulty"] == "not_feasible"
    assert result["weight_lbs"] == 0.0
    assert result["current_stock"] == 0
    assert result["name"] == "Unknown SKU"


def test_known_sku_loads_from_fixture():
    from app.graph.nodes.sku_profile import _SKUS, _lookup_sku

    if not _SKUS:
        pytest.skip("Fixture file not found — skipping fixture-dependent test")

    first_code = list(_SKUS.keys())[0]
    result = _lookup_sku(first_code)
    assert result["sku_code"] == first_code
    assert result["weight_lbs"] > 0
    assert result["refurb_difficulty"] in ("easy", "moderate", "hard", "not_feasible")


def test_sku_furn_sect_sofa_gry():
    from app.graph.nodes.sku_profile import _SKUS, _lookup_sku

    sku_code = "FURN-SECT-SOFA-GRY"
    if sku_code not in _SKUS:
        pytest.skip(f"{sku_code} not in fixture")

    result = _lookup_sku(sku_code)
    assert result["sku_code"] == sku_code
    assert result["weight_lbs"] == 286.0
    assert result["freight_class"] == "100"
    assert result["refurb_difficulty"] == "moderate"
    assert result["open_box_price_estimate_cents"] == 109900
    assert result["refurb_cost_estimate_cents"] == 28000


def test_sku_lookup_empty_string_returns_fallback():
    from app.graph.nodes.sku_profile import _build_fallback_sku_profile

    result = _build_fallback_sku_profile("")
    assert result["sku_code"] == ""
    assert result["refurb_difficulty"] == "not_feasible"


def test_fixtures_loaded_at_import():
    from app.graph.nodes.sku_profile import _SKUS

    assert isinstance(_SKUS, dict)


def test_all_fixture_skus_have_required_fields():
    from app.graph.nodes.sku_profile import _SKUS, _lookup_sku

    if not _SKUS:
        pytest.skip("No fixture data")

    required_fields = [
        "sku_code",
        "name",
        "weight_lbs",
        "freight_class",
        "refurb_difficulty",
        "open_box_price_estimate_cents",
        "refurb_cost_estimate_cents",
        "current_stock",
    ]
    for sku_code in list(_SKUS.keys())[:10]:  # spot-check first 10
        result = _lookup_sku(sku_code)
        for field in required_fields:
            assert field in result, f"Field {field!r} missing for SKU {sku_code}"
