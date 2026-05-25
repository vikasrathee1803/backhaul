# Audit Agent — Agent Spec

## Role
Writes the complete, immutable decision record for every graph run to the append-only audit log, capturing every upstream signal, the final disposition, all cost and latency metrics, human override status, and the full agent reasoning — providing the source of truth for decision accountability, eval dataset growth, and operator review.

---

## Input Contract

The Audit Agent reads the complete `BackhaulState` at the end of every graph run:

| Key | Type | Source | Description |
|-----|------|--------|-------------|
| `intake` | `ReturnIntakeSchema` | `BackhaulState` | Full parsed intake |
| `customer_history` | `CustomerHistorySchema` | `BackhaulState` | Customer context |
| `sku_profile` | `SkuProfileSchema` | `BackhaulState` | SKU context |
| `marketplace_policy` | `MarketplacePolicySchema` | `BackhaulState` | Policy context |
| `damage_signal` | `DamageSignalSchema` | `BackhaulState` | Damage assessment |
| `fraud_flag_result` | `FraudFlagSchema` | `BackhaulState` | Fraud score and flags |
| `decision` | `DispositionDecisionSchema` | `BackhaulState` | Disposition, confidence, reasoning, cost, latency |
| `worker_result` | `WorkerResultSchema` | `BackhaulState` | Worker execution result |
| `comms_draft` | `CommsDraftSchema` | `BackhaulState` | Customer communication draft |
| `escalation_record` | `dict \| None` | `BackhaulState` | Escalation record if escalated |
| `run_id` | `str` | `BackhaulState` | The graph run identifier |
| `run_started_at` | `str` | `BackhaulState` | ISO timestamp when this graph run started |

---

## Output Contract

1. **Writes an audit record** to the `audit_log` table in Postgres (or appends to `fixtures/audit_log.jsonl` in v1 fixture mode).
2. **Writes `state["audit_record_id"]`** — the generated audit log record ID.
3. **Emits a `run_completed` GraphEvent** to the SSE stream.
4. **Optionally appends to eval dataset** if `is_override: true` (captured from state if a human override occurred during this run).

---

## Audit Record Schema

The audit record written to the log is a flat, comprehensive structure:

```json
{
  "audit_id": "AUD-{run_id}-{timestamp}",
  "run_id": "string",
  "return_id": "string",
  "created_at": "ISO timestamp",
  
  "intake_marketplace": "string",
  "intake_return_reason": "string",
  "intake_condition": "string",
  "intake_order_total_cents": "integer",
  "intake_inbound_freight_cost_cents": "integer",
  "intake_sku_code": "string",
  "intake_customer_id": "string",
  
  "customer_lifetime_value_cents": "integer",
  "customer_return_rate": "float",
  "customer_fraud_flag": "boolean",
  
  "sku_refurb_difficulty": "string",
  "sku_open_box_price_estimate_cents": "integer",
  "sku_refurb_cost_estimate_cents": "integer",
  "sku_current_stock": "integer",
  "sku_weight_lbs": "float",
  
  "policy_return_window_days": "integer",
  "policy_freight_subsidy_pct": "float",
  "policy_damage_allowance_pct": "float",
  "policy_restocking_fee_pct": "float",
  "policy_auto_decide_ceiling_cents": "integer",
  
  "damage_has_damage": "boolean",
  "damage_severity": "string",
  "damage_components": ["string"],
  "damage_repair_feasibility": "string",
  
  "fraud_score": "float",
  "fraud_flags": ["string"],
  "fraud_exceeds_threshold": "boolean",
  
  "disposition": "string",
  "confidence": "float",
  "reasoning": "string",
  "prompt_version": "string",
  "model_used": "string",
  "decision_input_tokens": "integer",
  "decision_output_tokens": "integer",
  "decision_cost_usd": "float",
  "decision_latency_ms": "integer",
  "candidate_dispositions": [{"disposition": "string", "score": "float", "rationale": "string"}],
  
  "worker": "string",
  "worker_status": "string",
  "worker_actions_taken": ["string"],
  "worker_notes": "string",
  
  "comms_channel": "string",
  "comms_tone": "string",
  "comms_draft_text": "string",
  
  "escalation_id": "string | null",
  "escalation_priority": "string | null",
  "escalation_reason": "string | null",
  
  "net_refurb_value_cents": "integer",
  "total_run_cost_usd": "float",
  "total_run_latency_ms": "integer",
  
  "is_override": "boolean",
  "override_disposition": "string | null",
  "override_reason": "string | null",
  "override_by": "string | null",
  "override_at": "string | null"
}
```

---

## Model

**No LLM — pure data assembly and persistence.** The audit agent assembles data that already exists in state and writes it to storage. No inference needed or appropriate.

---

## Processing Logic

1. **Compute derived fields**:
   ```python
   net_refurb_value_cents = (
       sku_profile.open_box_price_estimate_cents
       - sku_profile.refurb_cost_estimate_cents
       - int(intake.inbound_freight_cost_cents * (1.0 - marketplace_policy.freight_subsidy_pct))
   )
   
   # Sum cost across all LLM-calling agents (intake, damage_signal, decision, customer_comms)
   total_run_cost_usd = (
       intake_agent_cost + damage_signal_cost + decision_cost + comms_cost
   )
   # These costs are stored in individual state keys by each agent:
   # state["intake_cost_usd"], state["damage_signal_cost_usd"], etc.
   
   total_run_latency_ms = sum of all agent latencies from state
   ```

2. **Assemble the audit record** by extracting fields from each schema in state.

3. **Handle optional fields**: `escalation_id`, `escalation_priority`, `escalation_reason` are `None` if no escalation occurred. `override_*` fields are `None` if no human override occurred.

4. **Generate audit ID**: `AUD-{run_id}-{int(time.time()*1000)}`.

5. **Write to storage**:
   - **v1 fixture mode** (no Postgres configured): Append as a JSON line to `fixtures/audit_log.jsonl`. Thread-safe append using a file lock.
   - **Production mode** (Postgres available): Insert into the `audit_log` table using the configured DB connection. The insert is wrapped in a try/except; failure does not crash the graph.

6. **Write** `state["audit_record_id"] = audit_id`.

7. **Emit `run_completed` GraphEvent** to the SSE stream:
   ```json
   {
     "event": "run_completed",
     "run_id": "<run_id>",
     "return_id": "<return_id>",
     "disposition": "<disposition>",
     "confidence": "<float>",
     "total_cost_usd": "<float>",
     "total_latency_ms": "<int>",
     "escalated": "<boolean>"
   }
   ```

8. **Eval dataset append** (if override):
   If `state.get("is_override") == True`, append the audit record to `evals/golden_cases.jsonl` with `label = override_disposition`. This is the mechanism by which human overrides grow the eval dataset.

---

## Append-Only Guarantee

The audit log is append-only — no update or delete operations are ever performed on existing records. In v1 fixture mode, the `audit_log.jsonl` file is opened in append mode (`"a"`). In production Postgres, the `audit_log` table has no `UPDATE` or `DELETE` permissions granted to the application user.

Human overrides are recorded as **new** audit records (with `is_override: true` and the original `audit_id` referenced in `original_audit_id`), not as modifications to the original record.

---

## Acceptance Criteria

1. **Complete record on happy path**: Given a completed graph run for a refund decision, the audit record contains all required fields with non-null values (except escalation fields which are null).
2. **Append-only behavior**: Running 10 graph runs creates exactly 10 lines in `audit_log.jsonl` — no line is modified or removed.
3. **net_refurb_value_cents is computed correctly**: Given known inputs, verify the formula produces the expected integer.
4. **total_run_cost_usd is accurate**: The sum of all LLM agent costs matches the individual cost records. Verify at least 3 decimal places.
5. **run_completed event emitted**: The SSE stream receives a `run_completed` event within 500ms of the audit write.
6. **Escalation fields are null when not escalated**: For a `refund` disposition run, `escalation_id` is `None` in the audit record.
7. **Override captured in eval dataset**: When `is_override: true`, a new line is appended to `evals/golden_cases.jsonl` with the override label.
8. **Postgres failure is non-fatal**: If the DB write fails, the Audit Agent logs the error but does not crash the graph. The `run_completed` event still fires.
9. **Thread-safe file append**: Concurrent graph runs do not corrupt `audit_log.jsonl`. Verify with a 10-concurrent-run test.
10. **Fixture test**: The test in `/evals/audit/` verifies that all required fields are present and correctly typed in the audit record.

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| `comms_draft` missing from state (comms agent failed) | Set `comms_*` fields to `None`. Do not crash. |
| `worker_result` missing | Set `worker_*` fields to `None`. |
| `decision` missing | This is a critical failure. Set `disposition: "unknown"`, `confidence: 0.0`. Flag `status: "incomplete_run"`. Still write the record. |
| `audit_log.jsonl` file lock contention | Retry up to 3 times with 10ms backoff. If still locked, log error and skip the write (non-fatal). |
| Total cost calculation has rounding error | Use Python `Decimal` for cost arithmetic, convert to float for storage. |

---

## Cost Target

**$0.00 per call.** No LLM. Data assembly and file/DB I/O only.

---

## Fallback

The Audit Agent does not have a traditional fallback (it is the last node in the graph and its job is to record the state). If the agent fails to write:

1. Log the full audit record as a WARNING in the application log (so it is not lost entirely).
2. Set `state["audit_record_id"] = None`.
3. Emit the `run_completed` SSE event anyway (the run is complete even if the audit write failed).

---

## Braintrust Span

**Span name**: `backhaul.audit_agent`

**Attributes to log**:
| Attribute | Value |
|-----------|-------|
| `return_id` | from intake |
| `run_id` | from state |
| `audit_id` | generated |
| `disposition` | from decision |
| `total_run_cost_usd` | computed |
| `total_run_latency_ms` | computed |
| `is_override` | from state |
| `storage_mode` | `"file" \| "postgres"` |
| `write_success` | `true \| false` |
| `latency_ms` | wall-clock time for write operation |
