// All demo data — single source of truth for the demo workspace

export const DEMO_WORKSPACE = {
  id: "demo",
  name: "Cymax Returns",
  plan: "pro" as const,
  returns_today: 12,
  avg_cost_per_decision_cents: 1,
  escalation_rate: 0.08,
  eval_accuracy: 0.94,
};

// SKUs
export type SkuCatalogItem = {
  id: string;
  sku_code: string;
  name: string;
  category: string;
  weight_lbs: number;
  freight_class: string;
  refurb_difficulty: "easy" | "moderate" | "hard" | "not_refurbishable";
  open_box_price_estimate_cents: number;
  current_stock: number;
};

export const DEMO_SKUS: SkuCatalogItem[] = [
  { id: "sku-001", sku_code: "SOF-3SEAT-GRY", name: "Linden 3-Seat Sectional Sofa", category: "furniture", weight_lbs: 186, freight_class: "85", refurb_difficulty: "moderate", open_box_price_estimate_cents: 89900, current_stock: 4 },
  { id: "sku-002", sku_code: "BED-KING-WAL", name: "Morrison King Platform Bed — Walnut", category: "furniture", weight_lbs: 142, freight_class: "70", refurb_difficulty: "easy", open_box_price_estimate_cents: 64900, current_stock: 2 },
  { id: "sku-003", sku_code: "TRDM-COMM-BLK", name: "TreadMaster Commercial Treadmill", category: "fitness", weight_lbs: 287, freight_class: "100", refurb_difficulty: "hard", open_box_price_estimate_cents: 119900, current_stock: 1 },
  { id: "sku-004", sku_code: "REFRIG-FRNCH-SS", name: "Kenmore French Door Refrigerator SS", category: "appliance", weight_lbs: 312, freight_class: "125", refurb_difficulty: "moderate", open_box_price_estimate_cents: 149900, current_stock: 3 },
  { id: "sku-005", sku_code: "PATIO-TBL-6PC", name: "Ridgeline 6-Piece Patio Dining Set", category: "outdoor", weight_lbs: 164, freight_class: "77.5", refurb_difficulty: "easy", open_box_price_estimate_cents: 74900, current_stock: 6 },
  { id: "sku-006", sku_code: "DESK-EXEC-OAK", name: "Executive L-Desk — Oak", category: "furniture", weight_lbs: 98, freight_class: "70", refurb_difficulty: "easy", open_box_price_estimate_cents: 54900, current_stock: 8 },
  { id: "sku-007", sku_code: "WASH-FL-WHT", name: "LG Front Load Washer 5.2 cu.ft", category: "appliance", weight_lbs: 198, freight_class: "92.5", refurb_difficulty: "hard", open_box_price_estimate_cents: 79900, current_stock: 2 },
  { id: "sku-008", sku_code: "BIKE-SPIN-PRO", name: "ProCycle Studio Spin Bike", category: "fitness", weight_lbs: 112, freight_class: "70", refurb_difficulty: "easy", open_box_price_estimate_cents: 44900, current_stock: 5 },
];

// Customers
export type CustomerProfile = {
  id: string;
  name: string;
  email: string;
  lifetime_value_cents: number;
  order_count: number;
  return_count: number;
  return_rate: number;
  fraud_flag: boolean;
};

export const DEMO_CUSTOMERS: CustomerProfile[] = [
  { id: "cust-001", name: "Marcus Holloway", email: "m.holloway@email.com", lifetime_value_cents: 421800, order_count: 6, return_count: 1, return_rate: 0.167, fraud_flag: false },
  { id: "cust-002", name: "Priya Nair", email: "priya.n@domain.com", lifetime_value_cents: 189900, order_count: 2, return_count: 0, return_rate: 0, fraud_flag: false },
  { id: "cust-003", name: "Devon Carter", email: "dcarter@webmail.net", lifetime_value_cents: 87400, order_count: 3, return_count: 2, return_rate: 0.667, fraud_flag: true },
  { id: "cust-004", name: "Sofia Reyes", email: "s.reyes@company.org", lifetime_value_cents: 312500, order_count: 4, return_count: 1, return_rate: 0.25, fraud_flag: false },
  { id: "cust-005", name: "Jared Kim", email: "jared.kim@email.com", lifetime_value_cents: 654000, order_count: 8, return_count: 1, return_rate: 0.125, fraud_flag: false },
  { id: "cust-006", name: "Aaliyah Brooks", email: "a.brooks@mail.com", lifetime_value_cents: 98700, order_count: 1, return_count: 0, return_rate: 0, fraud_flag: false },
];

// Returns
export type ReturnDecision = {
  disposition: "refund" | "replace" | "repair" | "refurbish" | "donate" | "dispose" | "escalate";
  confidence: number;
  reasoning: string;
  cost_usd: number;
  latency_ms: number;
  model: string;
  prompt_version: string;
  candidate_dispositions: Array<{ disposition: string; score: number; reason: string }>;
  escalation_reason?: string;
};

export type ReturnItem = {
  id: string;
  order_id: string;
  customer_id: string;
  marketplace: "wayfair" | "amazon_fba" | "amazon_fbm" | "houzz" | "overstock" | "shopify";
  sku: SkuCatalogItem;
  customer: CustomerProfile;
  return_reason: "damage_in_transit" | "defective" | "wrong_item" | "buyer_remorse" | "not_as_described" | "other";
  condition: "new" | "like_new" | "good" | "fair" | "poor" | "unusable";
  condition_notes: string;
  order_total_cents: number;
  inbound_freight_cost_cents: number;
  status: "pending_triage" | "triaging" | "decided" | "escalated" | "resolved";
  return_requested_at: string;
  decision?: ReturnDecision;
  escalation_reason?: string;
};

export const DEMO_RETURNS: ReturnItem[] = [
  {
    id: "RTN-2024-001", order_id: "ORD-2024-0891", customer_id: "cust-001",
    marketplace: "wayfair", sku: DEMO_SKUS[0], customer: DEMO_CUSTOMERS[0],
    return_reason: "damage_in_transit", condition: "poor",
    condition_notes: "Corner of sofa frame broken, fabric torn on left armrest. Photos attached. Box was clearly damaged on arrival.",
    order_total_cents: 129900, inbound_freight_cost_cents: 18400, status: "decided",
    return_requested_at: "2024-11-14T09:22:00Z",
    decision: { disposition: "refurbish", confidence: 0.87, reasoning: "Freight cost ($184) + refurb labor est. ($220) < open box resale ($899). Wayfair damage allowance covers 30% — partial reimbursement approved. Route to refurb queue.", cost_usd: 0.0082, latency_ms: 1240, model: "claude-sonnet-4-6", prompt_version: "v1", candidate_dispositions: [{ disposition: "refurbish", score: 0.87, reason: "Net refurb value exceeds 30% of order total" }, { disposition: "repair", score: 0.61, reason: "Damage is functional; repair feasible but margins tight" }, { disposition: "refund", score: 0.42, reason: "Default fallback if refurb economics unfavorable" }] },
  },
  {
    id: "RTN-2024-002", order_id: "ORD-2024-0902", customer_id: "cust-002",
    marketplace: "amazon_fba", sku: DEMO_SKUS[2], customer: DEMO_CUSTOMERS[1],
    return_reason: "defective", condition: "fair",
    condition_notes: "Motor makes grinding noise after 30 minutes. Speed display intermittent. Unit runs but is not safe.",
    order_total_cents: 189900, inbound_freight_cost_cents: 32100, status: "escalated",
    return_requested_at: "2024-11-13T14:05:00Z",
    decision: { disposition: "escalate", confidence: 0.61, reasoning: "AOV $1,899 exceeds auto-decide ceiling $1,500. Confidence 0.61 below threshold 0.75. Safety concern on fitness equipment. Recommend repair or replace — needs human review.", cost_usd: 0.0091, latency_ms: 1890, model: "claude-sonnet-4-6", prompt_version: "v1", candidate_dispositions: [{ disposition: "repair", score: 0.71, reason: "Motor repair est. $350 well below replacement cost" }, { disposition: "replace", score: 0.64, reason: "Safety concern justifies replacement for fitness equipment" }, { disposition: "refund", score: 0.49, reason: "Full refund if repair infeasible at this AOV" }], escalation_reason: "High-value order ($1,899) with safety concern on fitness equipment — confidence 0.61 below 0.75 threshold" },
    escalation_reason: "High-value order ($1,899) with safety concern on fitness equipment — confidence 0.61 below 0.75 threshold",
  },
  {
    id: "RTN-2024-003", order_id: "ORD-2024-0881", customer_id: "cust-003",
    marketplace: "wayfair", sku: DEMO_SKUS[4], customer: DEMO_CUSTOMERS[2],
    return_reason: "buyer_remorse", condition: "like_new",
    condition_notes: "Never used. Still in original packaging. Customer says it doesn't fit the space.",
    order_total_cents: 109900, inbound_freight_cost_cents: 12800, status: "decided",
    return_requested_at: "2024-11-15T11:30:00Z",
    decision: { disposition: "refund", confidence: 0.92, reasoning: "Customer return rate 66.7% — fraud flag active. However item is like-new in original packaging. Wayfair policy: full refund within 30-day window. Issue refund, flag account.", cost_usd: 0.0071, latency_ms: 980, model: "claude-sonnet-4-6", prompt_version: "v1", candidate_dispositions: [{ disposition: "refund", score: 0.92, reason: "Policy-compliant within 30-day window; item like-new" }, { disposition: "refurbish", score: 0.55, reason: "Item condition allows Open Box resale" }, { disposition: "escalate", score: 0.38, reason: "Fraud flag warrants manual review" }] },
  },
  {
    id: "RTN-2024-004", order_id: "ORD-2024-0867", customer_id: "cust-004",
    marketplace: "houzz", sku: DEMO_SKUS[1], customer: DEMO_CUSTOMERS[3],
    return_reason: "not_as_described", condition: "good",
    condition_notes: "Color is noticeably different from photos — appears more orange than walnut. No damage.",
    order_total_cents: 98900, inbound_freight_cost_cents: 9200, status: "decided",
    return_requested_at: "2024-11-12T16:45:00Z",
    decision: { disposition: "replace", confidence: 0.88, reasoning: "Not-as-described on Houzz qualifies for replacement. Customer LTV $3,125 — high value. Item in good condition; re-list as Open Box. Ship replacement.", cost_usd: 0.0078, latency_ms: 1120, model: "claude-sonnet-4-6", prompt_version: "v1", candidate_dispositions: [{ disposition: "replace", score: 0.88, reason: "Houzz not-as-described policy mandates replacement; high-LTV customer" }, { disposition: "refund", score: 0.62, reason: "Refund acceptable if replacement stock unavailable" }, { disposition: "refurbish", score: 0.44, reason: "Good condition item could re-list as Open Box instead" }] },
  },
  {
    id: "RTN-2024-005", order_id: "ORD-2024-0855", customer_id: "cust-005",
    marketplace: "amazon_fba", sku: DEMO_SKUS[3], customer: DEMO_CUSTOMERS[4],
    return_reason: "damage_in_transit", condition: "poor",
    condition_notes: "Refrigerator door hinges bent, ice maker not functioning. Compressor appears intact. Could be repaired by appliance tech.",
    order_total_cents: 219900, inbound_freight_cost_cents: 42000, status: "decided",
    return_requested_at: "2024-11-11T08:15:00Z",
    decision: { disposition: "repair", confidence: 0.81, reasoning: "Repair est. $280 < open box resale diff $800. Amazon FBA: seller covered, freight reimbursed 80%. Schedule appliance tech pickup. Customer LTV $6,540 — send goodwill $50 credit.", cost_usd: 0.0094, latency_ms: 1560, model: "claude-sonnet-4-6", prompt_version: "v1", candidate_dispositions: [{ disposition: "repair", score: 0.81, reason: "Repair economics favorable; compressor intact reduces risk" }, { disposition: "replace", score: 0.68, reason: "High-LTV customer warrants replacement consideration" }, { disposition: "refurbish", score: 0.52, reason: "Structural damage repairable; refurb viable if repair fails" }] },
  },
  {
    id: "RTN-2024-006", order_id: "ORD-2024-0843", customer_id: "cust-006",
    marketplace: "overstock", sku: DEMO_SKUS[7], customer: DEMO_CUSTOMERS[5],
    return_reason: "defective", condition: "unusable",
    condition_notes: "Pedal assembly completely stripped, flywheel wobbles. Unit fell from pallet during delivery per carrier notes.",
    order_total_cents: 64900, inbound_freight_cost_cents: 8800, status: "decided",
    return_requested_at: "2024-11-15T13:22:00Z",
    decision: { disposition: "dispose", confidence: 0.94, reasoning: "Refurb cost est. $380 exceeds open box value $449 — margin too thin. Overstock: file carrier damage claim, issue full refund. Dispose unit locally.", cost_usd: 0.0065, latency_ms: 840, model: "claude-haiku-4-5-20251001", prompt_version: "v1", candidate_dispositions: [{ disposition: "dispose", score: 0.94, reason: "Refurb margin negative; carrier claim filed" }, { disposition: "donate", score: 0.51, reason: "Local charity pickup viable if carrier claim approved" }, { disposition: "refurbish", score: 0.22, reason: "Economics too thin — margin under 5%" }] },
  },
  {
    id: "RTN-2024-007", order_id: "ORD-2024-0831", customer_id: "cust-001",
    marketplace: "shopify", sku: DEMO_SKUS[5], customer: DEMO_CUSTOMERS[0],
    return_reason: "wrong_item", condition: "new",
    condition_notes: "Received executive desk in black finish, ordered oak. Completely sealed, never opened.",
    order_total_cents: 84900, inbound_freight_cost_cents: 7600, status: "pending_triage",
    return_requested_at: "2024-11-15T15:00:00Z",
  },
  {
    id: "RTN-2024-008", order_id: "ORD-2024-0820", customer_id: "cust-002",
    marketplace: "wayfair", sku: DEMO_SKUS[6], customer: DEMO_CUSTOMERS[1],
    return_reason: "defective", condition: "fair",
    condition_notes: "Washer drum makes loud banging on spin cycle. Clothes not spinning fully dry. 3 weeks old.",
    order_total_cents: 119900, inbound_freight_cost_cents: 21000, status: "pending_triage",
    return_requested_at: "2024-11-15T14:30:00Z",
  },
  {
    id: "RTN-2024-009", order_id: "ORD-2024-0812", customer_id: "cust-004",
    marketplace: "amazon_fbm", sku: DEMO_SKUS[0], customer: DEMO_CUSTOMERS[3],
    return_reason: "buyer_remorse", condition: "good",
    condition_notes: "Customer says sofa is too large for the room. No damage. Delivered 12 days ago.",
    order_total_cents: 129900, inbound_freight_cost_cents: 18400, status: "pending_triage",
    return_requested_at: "2024-11-15T10:45:00Z",
  },
  {
    id: "RTN-2024-010", order_id: "ORD-2024-0799", customer_id: "cust-005",
    marketplace: "houzz", sku: DEMO_SKUS[1], customer: DEMO_CUSTOMERS[4],
    return_reason: "damage_in_transit", condition: "poor",
    condition_notes: "Headboard cracked in two places, one nightstand leg snapped. Packaging intact — likely manufacturing defect.",
    order_total_cents: 98900, inbound_freight_cost_cents: 9200, status: "pending_triage",
    return_requested_at: "2024-11-15T09:00:00Z",
  },
  {
    id: "RTN-2024-011", order_id: "ORD-2024-0788", customer_id: "cust-003",
    marketplace: "overstock", sku: DEMO_SKUS[4], customer: DEMO_CUSTOMERS[2],
    return_reason: "not_as_described", condition: "new",
    condition_notes: "Listed as rust-resistant but shows surface rust after one rain. Photos match listing color accurately.",
    order_total_cents: 109900, inbound_freight_cost_cents: 12800, status: "pending_triage",
    return_requested_at: "2024-11-14T18:00:00Z",
  },
  {
    id: "RTN-2024-012", order_id: "ORD-2024-0776", customer_id: "cust-006",
    marketplace: "amazon_fba", sku: DEMO_SKUS[2], customer: DEMO_CUSTOMERS[5],
    return_reason: "defective", condition: "fair",
    condition_notes: "Incline motor stopped working on day 4. Belt tracks correctly. Otherwise functional.",
    order_total_cents: 189900, inbound_freight_cost_cents: 32100, status: "pending_triage",
    return_requested_at: "2024-11-14T20:15:00Z",
  },
];

// Graph run events for Agent Ops demo
export type NodeState = "idle" | "running" | "complete" | "failed" | "escalated";

export type GraphNode = {
  id: string;
  label: string;
  type: "llm" | "deterministic";
  state: NodeState;
  model?: string;
  latency_ms?: number;
  cost_usd?: number;
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  active: boolean;
};

export const DEMO_GRAPH_NODES: GraphNode[] = [
  { id: "intake_agent", label: "Intake Agent", type: "llm", model: "haiku", state: "complete", latency_ms: 420, cost_usd: 0.0004 },
  { id: "customer_history_agent", label: "Customer History", type: "deterministic", state: "complete", latency_ms: 85 },
  { id: "sku_profile_agent", label: "SKU Profile", type: "deterministic", state: "complete", latency_ms: 62 },
  { id: "marketplace_policy_agent", label: "Policy Agent", type: "deterministic", state: "complete", latency_ms: 28 },
  { id: "damage_signal_agent", label: "Damage Signal", type: "llm", model: "haiku", state: "complete", latency_ms: 380, cost_usd: 0.0006 },
  { id: "fraud_flag_agent", label: "Fraud Flags", type: "deterministic", state: "complete", latency_ms: 41 },
  { id: "decision_agent", label: "Decision Agent", type: "llm", model: "sonnet", state: "complete", latency_ms: 1240, cost_usd: 0.0082 },
  { id: "refurb_worker", label: "Refurb Worker", type: "deterministic", state: "complete", latency_ms: 95 },
  { id: "customer_comms_agent", label: "Customer Comms", type: "llm", model: "haiku", state: "complete", latency_ms: 520, cost_usd: 0.0005 },
  { id: "audit_agent", label: "Audit Agent", type: "deterministic", state: "complete", latency_ms: 38 },
];

export const DEMO_GRAPH_EDGES: GraphEdge[] = [
  { id: "e1", source: "intake_agent", target: "customer_history_agent", active: true },
  { id: "e2", source: "intake_agent", target: "sku_profile_agent", active: true },
  { id: "e3", source: "intake_agent", target: "marketplace_policy_agent", active: true },
  { id: "e4", source: "intake_agent", target: "damage_signal_agent", active: true },
  { id: "e5", source: "intake_agent", target: "fraud_flag_agent", active: true },
  { id: "e6", source: "customer_history_agent", target: "decision_agent", active: true },
  { id: "e7", source: "sku_profile_agent", target: "decision_agent", active: true },
  { id: "e8", source: "marketplace_policy_agent", target: "decision_agent", active: true },
  { id: "e9", source: "damage_signal_agent", target: "decision_agent", active: true },
  { id: "e10", source: "fraud_flag_agent", target: "decision_agent", active: true },
  { id: "e11", source: "decision_agent", target: "refurb_worker", active: true },
  { id: "e12", source: "refurb_worker", target: "customer_comms_agent", active: true },
  { id: "e13", source: "customer_comms_agent", target: "audit_agent", active: true },
];

export const DEMO_RUN = {
  id: "run-demo-001",
  status: "completed" as const,
  total_cost_usd: 0.0082,
  total_decisions: 1,
  started_at: "2024-11-14T09:22:00Z",
  completed_at: "2024-11-14T09:22:02Z",
};
