"""Eval tests for IntakeAgent — NO live API calls."""
import json


def test_parse_intake_valid_json():
    from app.graph.nodes.intake import _parse_intake_response

    mock_json = json.dumps(
        {
            "return_id": "ret-001",
            "marketplace": "wayfair",
            "return_reason": "damage_in_transit",
            "condition": "poor",
            "condition_notes": "cracked armrest",
            "order_total_cents": 129900,
            "inbound_freight_cost_cents": 18400,
            "sku_code": "SOF-3SEAT-GRY",
            "customer_id": "cust-001",
        }
    )
    result = _parse_intake_response(mock_json, "ret-001", "wayfair", "cracked armrest")
    assert result["return_reason"] == "damage_in_transit"
    assert result["order_total_cents"] == 129900
    assert result["inbound_freight_cost_cents"] == 18400
    assert result["sku_code"] == "SOF-3SEAT-GRY"


def test_parse_intake_bad_json_falls_back():
    from app.graph.nodes.intake import _parse_intake_response

    result = _parse_intake_response("not json!!!", "ret-002", "amazon_fba", "broken table")
    assert result["return_id"] == "ret-002"
    assert result["marketplace"] == "amazon_fba"
    assert result["return_reason"] == "buyer_remorse"  # default fallback


def test_parse_intake_markdown_fenced_json():
    from app.graph.nodes.intake import _parse_intake_response

    mock_json = '```json\n{"return_id": "ret-005", "marketplace": "houzz", "return_reason": "defective", "condition": "fair", "condition_notes": "drawer broken", "order_total_cents": 55000, "inbound_freight_cost_cents": 9000, "sku_code": "DESK-001", "customer_id": "cust-005"}\n```'
    result = _parse_intake_response(mock_json, "ret-005", "houzz", "drawer broken")
    assert result["return_reason"] == "defective"
    assert result["order_total_cents"] == 55000


def test_build_fallback_intake():
    from app.graph.nodes.intake import _build_fallback_intake

    result = _build_fallback_intake("ret-003", "houzz", "chair is damaged")
    assert result["return_id"] == "ret-003"
    assert result["marketplace"] == "houzz"
    assert result["condition_notes"] == "chair is damaged"
    assert result["order_total_cents"] == 0
    assert result["inbound_freight_cost_cents"] == 0


def test_parse_intake_missing_optional_fields():
    from app.graph.nodes.intake import _parse_intake_response

    # Only some fields present — should fill defaults for missing ones
    minimal_json = json.dumps(
        {"return_reason": "wrong_item", "condition": "good"}
    )
    result = _parse_intake_response(minimal_json, "ret-004", "overstock", "wrong color delivered")
    assert result["return_reason"] == "wrong_item"
    assert result["condition"] == "good"
    assert result["return_id"] == "ret-004"
    assert result["marketplace"] == "overstock"
    assert result["order_total_cents"] == 0
