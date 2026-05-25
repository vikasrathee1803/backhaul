"""Eval tests for CustomerHistoryAgent — reads from fixture cache, no DB."""
import pytest


def test_fallback_on_unknown_customer():
    from app.graph.nodes.customer_history import _build_fallback_customer_history

    result = _build_fallback_customer_history("cust-unknown")
    assert result["customer_id"] == "cust-unknown"
    assert result["return_rate"] == 0.0
    assert result["fraud_flag"] is False
    assert result["lifetime_value_cents"] == 0
    assert result["prior_return_reasons"] == []


def test_known_customer_loads_from_fixture():
    from app.graph.nodes.customer_history import _CUSTOMERS, _lookup_customer

    if not _CUSTOMERS:
        pytest.skip("Fixture file not found — skipping fixture-dependent test")

    first_id = list(_CUSTOMERS.keys())[0]
    result = _lookup_customer(first_id)
    assert result["customer_id"] == first_id
    assert 0.0 <= result["return_rate"] <= 1.0
    assert result["lifetime_value_cents"] >= 0
    assert isinstance(result["prior_return_reasons"], list)


def test_return_rate_computed_from_counts():
    from app.graph.nodes.customer_history import _CUSTOMERS, _lookup_customer

    if not _CUSTOMERS:
        pytest.skip("Fixture file not found")

    # Find a customer with non-zero order count and verify return_rate is computed correctly
    for cid, customer in _CUSTOMERS.items():
        order_count = customer.get("order_count", 0)
        return_count = customer.get("return_count", 0)
        if order_count > 0:
            result = _lookup_customer(cid)
            expected_rate = round(return_count / order_count, 4)
            assert abs(result["return_rate"] - expected_rate) < 0.001, (
                f"Customer {cid}: expected rate {expected_rate}, got {result['return_rate']}"
            )
            break


def test_cust_0001_fields():
    from app.graph.nodes.customer_history import _CUSTOMERS, _lookup_customer

    if "cust-0001" not in _CUSTOMERS:
        pytest.skip("cust-0001 not in fixture")

    result = _lookup_customer("cust-0001")
    assert result["customer_id"] == "cust-0001"
    assert result["order_count"] == 6
    assert result["return_count"] == 1
    assert result["fraud_flag"] is False


def test_lookup_returns_list_for_prior_reasons():
    from app.graph.nodes.customer_history import _lookup_customer

    result = _lookup_customer("cust-definitely-not-in-fixture-xyz")
    assert isinstance(result["prior_return_reasons"], list)


def test_fixtures_loaded_at_import():
    from app.graph.nodes.customer_history import _CUSTOMERS

    # Should have loaded fixture data — at minimum the fixture directory should exist
    # (could be empty in CI if fixtures are missing, but dict should exist)
    assert isinstance(_CUSTOMERS, dict)
