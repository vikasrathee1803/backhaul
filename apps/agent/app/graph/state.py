from __future__ import annotations

import operator
from typing import Annotated, Any, Literal, TypedDict

Marketplace = Literal["wayfair", "amazon_fba", "amazon_fbm", "houzz", "overstock", "shopify"]
Disposition = Literal["refund", "replace", "repair", "refurbish", "donate", "dispose", "escalate"]
NodeStatus = Literal["started", "completed", "failed", "skipped"]


class ReturnIntakeSchema(TypedDict):
    return_id: str
    marketplace: Marketplace
    return_reason: str
    condition: str
    condition_notes: str
    order_total_cents: int
    inbound_freight_cost_cents: int
    sku_code: str
    customer_id: str


class CustomerHistorySchema(TypedDict):
    customer_id: str
    lifetime_value_cents: int
    order_count: int
    return_count: int
    return_rate: float
    fraud_flag: bool
    prior_return_reasons: list[str]


class SkuProfileSchema(TypedDict):
    sku_code: str
    name: str
    weight_lbs: float
    freight_class: str
    refurb_difficulty: str
    open_box_price_estimate_cents: int
    refurb_cost_estimate_cents: int
    current_stock: int


class MarketplacePolicySchema(TypedDict):
    marketplace: Marketplace
    return_window_days: int
    freight_subsidy_pct: float
    damage_allowance_pct: float
    restocking_fee_pct: float
    decisioning_window_days: int
    auto_decide_ceiling_cents: int


class DamageSignalSchema(TypedDict):
    has_damage: bool
    damage_severity: str  # none | cosmetic | functional | structural | total_loss
    damage_components: list[str]
    repair_feasibility: str  # feasible | uncertain | not_feasible
    raw_signal: str


class FraudFlagSchema(TypedDict):
    fraud_score: float  # 0.0 - 1.0
    flags: list[str]
    high_return_rate: bool
    exceeds_fraud_threshold: bool


class DispositionDecisionSchema(TypedDict):
    disposition: Disposition
    confidence: float
    reasoning: str
    prompt_version: str
    model_used: str
    input_tokens: int
    output_tokens: int
    cost_usd: float
    latency_ms: int
    candidate_dispositions: list[dict[str, Any]]


class WorkerResultSchema(TypedDict):
    worker: str
    status: str
    actions_taken: list[str]
    notes: str


class CommsDraftSchema(TypedDict):
    channel: Marketplace
    draft_text: str
    tone: str


class HumanOverrideSchema(TypedDict):
    override_disposition: Disposition
    override_reason: str
    overridden_by: str


class GraphEvent(TypedDict):
    run_id: str
    event_type: Literal[
        "node_started",
        "node_completed",
        "node_failed",
        "decision_made",
        "escalation",
        "cost_update",
        "run_completed",
        "run_failed",
    ]
    node_name: str | None
    timestamp: str
    data: dict[str, Any]
    cost_delta_usd: float
    total_cost_usd: float


class BackhaulState(TypedDict):
    run_id: str
    return_id: str
    marketplace: Marketplace
    raw_return_text: str
    # Parallel agent outputs
    intake: ReturnIntakeSchema | None
    customer_history: CustomerHistorySchema | None
    sku_profile: SkuProfileSchema | None
    marketplace_policy: MarketplacePolicySchema | None
    damage_signal: DamageSignalSchema | None
    fraud_flags: FraudFlagSchema | None
    # Decision and execution
    decision: DispositionDecisionSchema | None
    worker_result: WorkerResultSchema | None
    comms_draft: CommsDraftSchema | None
    audit_written: bool
    escalation_reason: str | None
    human_override: HumanOverrideSchema | None
    # Meta — use reducers so parallel nodes can safely write to shared fields
    errors: Annotated[dict[str, str], lambda a, b: {**a, **b}]
    events: Annotated[list[GraphEvent], operator.add]
    total_cost_usd: Annotated[float, operator.add]
    started_at: str
