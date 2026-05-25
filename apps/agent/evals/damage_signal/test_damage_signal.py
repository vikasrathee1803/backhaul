"""Eval tests for DamageSignalAgent — no live API calls."""
import json


def test_parse_damage_valid_json():
    from app.graph.nodes.damage_signal import _parse_damage_signal_response

    mock = json.dumps(
        {
            "has_damage": True,
            "damage_severity": "cosmetic",
            "damage_components": ["left armrest"],
            "repair_feasibility": "feasible",
            "raw_signal": "scratch on armrest",
        }
    )
    result = _parse_damage_signal_response(mock, "scratch on armrest")
    assert result["damage_severity"] == "cosmetic"
    assert result["has_damage"] is True
    assert result["repair_feasibility"] == "feasible"
    assert "left armrest" in result["damage_components"]


def test_parse_damage_structural():
    from app.graph.nodes.damage_signal import _parse_damage_signal_response

    mock = json.dumps(
        {
            "has_damage": True,
            "damage_severity": "structural",
            "damage_components": ["frame", "left leg"],
            "repair_feasibility": "not_feasible",
            "raw_signal": "frame is bent, structural damage",
        }
    )
    result = _parse_damage_signal_response(mock, "frame is bent, structural damage")
    assert result["damage_severity"] == "structural"
    assert result["repair_feasibility"] == "not_feasible"
    assert len(result["damage_components"]) == 2


def test_parse_damage_bad_json_falls_back():
    from app.graph.nodes.damage_signal import _parse_damage_signal_response

    result = _parse_damage_signal_response("garbage", "some notes")
    assert result["has_damage"] is False
    assert result["damage_severity"] == "none"
    assert result["repair_feasibility"] == "not_feasible"


def test_parse_damage_markdown_fenced():
    from app.graph.nodes.damage_signal import _parse_damage_signal_response

    mock = '```json\n{"has_damage": true, "damage_severity": "functional", "damage_components": ["motor"], "repair_feasibility": "uncertain", "raw_signal": "motor makes noise"}\n```'
    result = _parse_damage_signal_response(mock, "motor makes noise")
    assert result["damage_severity"] == "functional"
    assert result["has_damage"] is True


def test_build_fallback_empty_text():
    from app.graph.nodes.damage_signal import _build_fallback_damage_signal

    result = _build_fallback_damage_signal("")
    assert result["has_damage"] is False
    assert result["damage_severity"] == "none"
    assert result["damage_components"] == []
    assert result["raw_signal"] == ""


def test_build_fallback_preserves_raw_signal():
    from app.graph.nodes.damage_signal import _build_fallback_damage_signal

    notes = "item has a dent on the back panel"
    result = _build_fallback_damage_signal(notes)
    assert result["raw_signal"] == notes
    assert result["has_damage"] is False  # fallback always false


def test_parse_damage_no_damage_response():
    from app.graph.nodes.damage_signal import _parse_damage_signal_response

    mock = json.dumps(
        {
            "has_damage": False,
            "damage_severity": "none",
            "damage_components": [],
            "repair_feasibility": "not_feasible",
            "raw_signal": "item is in perfect condition",
        }
    )
    result = _parse_damage_signal_response(mock, "item is in perfect condition")
    assert result["has_damage"] is False
    assert result["damage_severity"] == "none"
    assert result["damage_components"] == []
