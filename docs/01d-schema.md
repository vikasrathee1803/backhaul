# 01d — Database Schema

**Phase:** 1 — Architecture, Graph Design, Design System
**Track:** C — Schema
**Role:** data-schema-designer
**Status:** Built — pending Phase 1 exit gate
**Date:** 2026-05-25

---

## Purpose

This document is the single source of truth for the Backhaul persistence layer (Hard Rule 6). It defines every table, column, constraint, index, and foreign-key relationship, the access pattern per agent, the migration strategy, and the canonical query each screen runs. The runnable DDL lives in `supabase/migrations/001_initial_schema.sql` and is generated directly from this document — the two must never diverge.

**Carried forward from prior phases:**

- **From `/docs/01a-architecture.md §1.4`:** Neon serverless Postgres. The Next.js side reads/writes via the Supabase JS client; the Python agent service connects over `DATABASE_URL` with raw SQL (asyncpg / SQLAlchemy core). **No ORM** (`STACK_CONFIG.md` bans Prisma/Drizzle). **RLS off** — single-tenant, one seeded admin user. The agent service is the sole writer of `decision_steps` and `audit_log`; the web app reads them and writes `overrides`.
- **From `/docs/01a-architecture.md §1.6`:** One decision → one `agent_runs` row → N `decision_steps` rows (one per node visited). The same facts written to a Braintrust span are mirrored into `decision_steps` for the in-app Agent Ops view, which must work even if Braintrust is unreachable.
- **From `/docs/01a-architecture.md §1.7`:** Every decision records its `prompt_version_id`; a prompt edit is a new version row, never an in-place mutation.
- **From `/docs/00-discovery.md §2`:** Fifteen agents; their per-table read/write access is the input to the "Access patterns" subsection of each table.
- **From `/docs/00-discovery.md §4` and Hard Rule 15:** Marketplace policies live in `/config/marketplaces/<name>.yaml`, **not** the database. The DB stores only a five-row `marketplace_configs` reference table so other tables can FK-validate a channel name and the Settings screen can list channels; the policy *values* are read from YAML by the Marketplace Policy Agent.
- **From `/docs/00-discovery.md §5, Hard Decision #1`:** The audit trail records both the Decision Agent's confidence and the threshold it was compared against. `decisions.reasoning` carries the explanation; the threshold/value-ceiling math is captured in `decision_steps.output_state_snapshot` for the Decision node and surfaced in `escalations.escalation_reason`.

---

## 1. Design Principles

These principles are non-negotiable and are encoded as constraints in the DDL wherever Postgres allows.

1. **Append-only audit tables.** `audit_log` and `decision_steps` are **insert-only** — never `UPDATE`, never `DELETE`. They use `bigserial` primary keys so insertion order is monotonic and replay is a simple `ORDER BY id`. This is enforced socially (Hard Rule 13) and, for `audit_log`, structurally by a trigger that raises on `UPDATE`/`DELETE`.

2. **Decisions are immutable after they are written.** A human override does **not** mutate a `decisions` row. It inserts a new `overrides` row referencing the original decision; if the override is re-executed it produces a *new* `decisions` row for the same return. The decision history of a return is therefore the full set of `decisions` rows ordered by `created_at`. (Enforced by an `UPDATE`/`DELETE` guard trigger on `decisions`.)

3. **Money is integer cents.** Every monetary value is `integer` cents (`*_cents`), never `float`/`numeric` dollars, to eliminate floating-point drift in freight-economics math. Only LLM **cost** is `numeric(10,6)` USD, because sub-cent token cost (e.g. $0.000412) is meaningful for the cost meter and cannot be expressed in integer cents.

4. **All timestamps are `timestamptz` in UTC.** No bare `timestamp`. The application layer localizes for display; storage is UTC.

5. **UUID primary keys throughout, except append-only logs.** Entities use `uuid` (`gen_random_uuid()`, available via the `pgcrypto`/`pgcrypto`-bundled `gen_random_uuid` builtin in PG13+). The two append-only logs (`audit_log`, `decision_steps`) use `bigserial` because ordering is the dominant access pattern and a monotonic sequence is cheaper and more truthful than sorting UUIDs by `created_at`.

6. **Status columns are `text` + `CHECK`, not `enum`.** A `CHECK (col IN (...))` constraint is trivially extensible with a single `ALTER TABLE ... DROP/ADD CONSTRAINT`, whereas Postgres `ENUM` types require `ALTER TYPE` migrations and lock more aggressively. v1 favors easy extension over the marginal storage win of an enum.

7. **JSONB for agent output payloads.** Per-node state snapshots, candidate-disposition arrays, and eval-case return snapshots are stored as `jsonb` rather than normalized. This is fast to write from the graph and flexible while the contracts are still settling. The cost is that these columns are not relationally queryable; that is an accepted v1 tradeoff (normalizable in v2). The *decision-critical* facts (disposition, confidence, cost) are always promoted to typed columns so dashboards never have to parse JSON.

8. **Every foreign-key column is indexed.** Postgres does not auto-index FK columns; we do it explicitly so joins and cascade checks stay fast.

9. **Generated columns for derived facts.** `customers.return_rate`, `decision_steps.latency_ms`, and `eval_results.passed` are `GENERATED ALWAYS ... STORED` so the derivation lives in one place (the schema) and can never disagree with its inputs.

---

## 2. Entity Relationship Overview

```
                          ┌──────────────────┐
                          │    customers     │
                          │  (LTV, returns)  │
                          └───┬──────────┬────┘
                              │ 1        │ 1
                     ┌────────┘          └──────────┐
                   * │                            * │
              ┌──────▼──────┐                  ┌─────▼──────┐
              │   orders    │                  │  returns   │◄─────────────┐
              │ (marketplace│                  │ (status,   │              │
              │  AOV, dates)│                  │  reason,   │              │
              └──────┬──────┘                  │  condition)│              │
                   1 │                         └──┬──────┬──┘              │
                   * │                          1 │    * │                 │
              ┌──────▼──────┐   sku_id     ┌──────▼──┐ ┌─▼────────────┐    │
              │ order_lines │──────┐       │return_  │ │  decisions   │    │
              │             │      │       │ lines   │ │ (disposition,│    │
              └─────────────┘      │       └────┬────┘ │  confidence, │    │
                     ▲             │            │      │  cost, model)│    │
                     │ order_line  ▼            │ sku_id│  APPEND-ONLY │    │
                     │       ┌───────────┐      │      └──┬───┬───┬────┘    │
                     └───────│sku_catalog│◄─────┘       1 │ 1 │ 1 │         │
                             │ (weight,  │                │   │   │         │
                             │  freight, │     ┌──────────┘   │   └──────┐  │
                             │  refurb,  │     │              │          │  │
                             │  stock)   │  ┌──▼──────┐  ┌────▼─────┐ ┌──▼──▼──────┐
                             └───────────┘  │overrides│  │escalations│ │comms_drafts│
                                            │ → eval  │  │ (HITL     │ │ (channel,  │
                                            │  dataset│  │  queue)   │ │  draft)    │
                                            └────┬────┘  └─────┬─────┘ └────────────┘
                                                 │ eval_case_id│
                       ┌─────────────┐           │             │
                       │ agent_runs  │◄──────────┼─────────────┤  run_id on
                       │ (one per    │ run_id     │             │  decisions,
                       │  graph run) │◄───────────┼─────────────┘  decision_steps,
                       └──────┬──────┘            │                eval_results,
                            1 │                   │                escalations
                            * │                   ▼
                     ┌────────▼────────┐    ┌──────────┐     ┌─────────────┐
                     │ decision_steps  │    │eval_cases│────►│ eval_results│
                     │ (one per node;  │    │ (golden) │  *  │ (per run;   │
                     │  APPEND-ONLY)   │    └──────────┘     │  pass/fail) │
                     └─────────────────┘                     └─────────────┘

                     ┌─────────────────┐    ┌──────────────────┐    ┌────────────────────┐
                     │   audit_log     │    │ prompt_versions  │    │ marketplace_configs│
                     │  (APPEND-ONLY;  │    │ (file path +     │    │  (5 reference rows;│
                     │   any entity)   │    │  content hash)   │    │   YAML is truth)   │
                     └─────────────────┘    └────────┬─────────┘    └────────────────────┘
                                                     │ prompt_version_id
                                                     └──────────────► decisions

Legend:  1 ─── *  one-to-many        ◄───  references (FK)        * │  the "many" end
```

**Cardinality summary**

- One `customer` has many `orders` and many `returns`.
- One `order` has many `order_lines`; each `order_line` references one `sku_catalog` row.
- One `return` belongs to exactly one `order` and one `customer`; it has many `return_lines`.
- One `agent_run` produces many `decision_steps` (one per node visited) and, for the returns it processed, `decisions`, `escalations`, and `eval_results`.
- One `return` accumulates many `decisions` over time (immutability + override-as-new-row); the *current* decision is the latest by `created_at`.
- One `decision` may have one `escalation`, one or more `comms_drafts`, and zero-or-more `overrides`.
- One `override`, once promoted, points at one `eval_case`; one `eval_case` is exercised by many `eval_results`.

---

## 3. Table Definitions

Run/create order (FK dependencies satisfied left-to-right):
`marketplace_configs` → `customers` → `sku_catalog` → `orders` → `order_lines` → `returns` → `return_lines` → `agent_runs` → `prompt_versions` → `decisions` → `decision_steps` → `audit_log` → `eval_cases` → `eval_results` → `escalations` → `comms_drafts` → `overrides`.

> The brief's stated order is followed where dependencies allow; two adjustments are required for referential integrity: `sku_catalog` is created before `orders`/`order_lines` (they FK it), and `prompt_versions` before `decisions` (it FKs it). Both are noted in §4.

---

### 3.1 `marketplace_configs`

**Purpose:** A five-row reference table of the channels modeled in v1, so other tables can FK-validate a channel and the Settings screen can enumerate channels — the policy *values* live in `/config/marketplaces/*.yaml`, not here (Hard Rule 15).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | Surrogate key. |
| `slug` | `text` | NOT NULL, UNIQUE | Channel slug used everywhere else (`wayfair`, `amazon_fba`, …). Matches the YAML filename. |
| `display_name` | `text` | NOT NULL | Human label for the Settings screen. |
| `config_path` | `text` | NOT NULL | Path to the authoritative YAML (e.g. `config/marketplaces/wayfair.yaml`). |
| `is_active` | `boolean` | NOT NULL default `true` | Whether the channel is enabled for triage. |
| `created_at` | `timestamptz` | NOT NULL default `now()` | — |

**Indexes:** `slug` (UNIQUE, implicit).
**Foreign keys:** none.
**Access patterns:** Marketplace Policy Agent resolves the YAML path here, then reads the file (not the DB). Settings screen lists rows. `orders.marketplace` / `returns.marketplace` values are validated against the same slug set via a shared `CHECK` (the canonical channel list is duplicated as a CHECK on those tables for fast inserts without a join; this table is the human-facing registry).

---

### 3.2 `customers`

**Purpose:** One row per buyer across all channels, carrying lifetime value and return-behavior signals that the Customer History and Fraud Flag agents read.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | — |
| `external_id` | `text` | NOT NULL | Channel-side customer ID (e.g. Wayfair customer ID). |
| `email` | `text` | | Contact email; nullable (some channels mask it). |
| `name` | `text` | | Display name. |
| `lifetime_value_cents` | `integer` | NOT NULL default `0` | Total spend in cents. |
| `order_count` | `integer` | NOT NULL default `0` | Lifetime order count. |
| `return_count` | `integer` | NOT NULL default `0` | Lifetime return count. |
| `return_rate` | `numeric(5,4)` | GENERATED ALWAYS AS `(return_count::numeric / NULLIF(order_count,0))` STORED | Derived return rate; `NULL` when `order_count = 0` (avoids divide-by-zero). |
| `first_order_at` | `timestamptz` | | First order timestamp. |
| `last_order_at` | `timestamptz` | | Most recent order timestamp. |
| `fraud_flag` | `boolean` | NOT NULL default `false` | Sticky fraud marker set by ops or the Fraud Flag agent. |
| `fraud_notes` | `text` | | Free-text fraud context. |
| `created_at` | `timestamptz` | NOT NULL default `now()` | — |

**Indexes:** `external_id`, `email`.
**Foreign keys:** none (referenced by `orders`, `returns`).
**Access patterns:** Customer History Agent (read: history/LTV/order_count), Fraud Flag Agent (read: `return_count`, `return_rate`, `fraud_flag`). Written by fixtures and by maintenance jobs that roll up order/return counts.

---

### 3.3 `sku_catalog`

**Purpose:** The product catalog with the physical and economic attributes that drive freight-aware disposition: weight, dimensions, freight class, refurb difficulty/cost, Open Box resale estimate, and current stock.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | — |
| `sku_code` | `text` | NOT NULL, UNIQUE | Stable SKU identifier. |
| `name` | `text` | NOT NULL | Product name. |
| `category` | `text` | NOT NULL, CHECK in (`furniture`,`appliance`,`fitness`,`outdoor`,`industrial`) | Top-level category. |
| `weight_lbs` | `numeric(8,2)` | NOT NULL | Shipping weight; drives freight + the >150 lb no-return-ship rule. |
| `length_in` | `numeric(8,2)` | | Dimension. |
| `width_in` | `numeric(8,2)` | | Dimension. |
| `height_in` | `numeric(8,2)` | | Dimension. |
| `freight_class` | `text` | NOT NULL, CHECK in NMFC classes (`50`…`500`) | LTL freight class for rate lookup. Stored as text because `77.5`/`92.5` are non-integer canonical classes. |
| `refurb_difficulty` | `text` | NOT NULL, CHECK in (`easy`,`moderate`,`hard`,`not_refurbishable`) | Refurb Worker grading input. |
| `refurb_cost_estimate_cents` | `integer` | | Estimated refurb labor + parts. |
| `open_box_price_estimate_cents` | `integer` | | Projected Open Box resale price. |
| `current_stock` | `integer` | NOT NULL default `0` | On-hand units; Replacement Worker reads this. |
| `is_active` | `boolean` | NOT NULL default `true` | Whether the SKU is sellable. |
| `created_at` | `timestamptz` | NOT NULL default `now()` | — |

**Indexes:** `sku_code` (UNIQUE), `category`, `freight_class`.
**Foreign keys:** none (referenced by `order_lines`, `return_lines`).
**Access patterns:** SKU Profile Agent (read: weight, freight_class, refurb_difficulty, current_stock, open_box estimate), Replacement Worker (read: `current_stock`), Refurb Worker (read: `refurb_difficulty`, `refurb_cost_estimate_cents`, `open_box_price_estimate_cents`).

---

### 3.4 `orders`

**Purpose:** One row per marketplace order, anchoring the original purchase context a return is evaluated against.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | — |
| `external_order_id` | `text` | NOT NULL | Marketplace order ID. |
| `marketplace` | `text` | NOT NULL, CHECK in (`wayfair`,`amazon_fba`,`amazon_fbm`,`houzz`,`overstock`,`shopify`) | Originating channel. |
| `customer_id` | `uuid` | NOT NULL, FK → `customers(id)` | Buyer. |
| `ordered_at` | `timestamptz` | NOT NULL | Order placed. |
| `shipped_at` | `timestamptz` | | Shipped. |
| `delivered_at` | `timestamptz` | | Delivered. |
| `status` | `text` | NOT NULL, CHECK in (`pending`,`shipped`,`delivered`,`returned`,`cancelled`) | Order lifecycle. |
| `subtotal_cents` | `integer` | NOT NULL | Line subtotal. |
| `shipping_cents` | `integer` | NOT NULL default `0` | Outbound shipping. |
| `total_cents` | `integer` | NOT NULL | Order total (drives AOV / value ceiling). |
| `channel_order_url` | `text` | | Deep link to the channel order. |
| `created_at` | `timestamptz` | NOT NULL default `now()` | — |

**Indexes:** `external_order_id`, `customer_id` (FK), `marketplace`, `ordered_at`.
**Foreign keys:** `customer_id` → `customers(id)`.
**Access patterns:** Customer History Agent (read: per-customer order history), Fraud Flag Agent (read: order history/value). Replacement Worker **writes** a new `orders` row when it books a fixture replacement shipment.

---

### 3.5 `order_lines`

**Purpose:** Line items of an order, linking quantity and price to a `sku_catalog` entry.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | — |
| `order_id` | `uuid` | NOT NULL, FK → `orders(id)` ON DELETE CASCADE | Parent order. |
| `sku_id` | `uuid` | NOT NULL, FK → `sku_catalog(id)` | Product. |
| `quantity` | `integer` | NOT NULL, CHECK `quantity > 0` | Units ordered. |
| `unit_price_cents` | `integer` | NOT NULL | Per-unit price. |
| `line_total_cents` | `integer` | NOT NULL | Extended line total. |
| `created_at` | `timestamptz` | NOT NULL default `now()` | — |

**Indexes:** `order_id` (FK), `sku_id` (FK).
**Foreign keys:** `order_id` → `orders(id)` (cascade delete with the order), `sku_id` → `sku_catalog(id)`.
**Access patterns:** SKU Profile Agent (resolves SKUs of a return's order), Customer History context. Referenced by `return_lines`.

---

### 3.6 `returns`

**Purpose:** The unit of work — one incoming return request in some state of the triage lifecycle. The Intake/Damage/Decision agents revolve around this row.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | — |
| `external_return_id` | `text` | | Marketplace return ID; nullable until synced. |
| `order_id` | `uuid` | NOT NULL, FK → `orders(id)` | Originating order. |
| `customer_id` | `uuid` | NOT NULL, FK → `customers(id)` | Buyer (denormalized for fast queue queries). |
| `marketplace` | `text` | NOT NULL, CHECK (same six as `orders`) | Channel (denormalized for the queue filter). |
| `return_reason` | `text` | NOT NULL, CHECK in (`damage_in_transit`,`defective`,`wrong_item`,`buyer_remorse`,`not_as_described`,`other`) | Stated reason. |
| `condition` | `text` | NOT NULL, CHECK in (`new`,`like_new`,`good`,`fair`,`poor`,`unusable`) | Reported condition. |
| `condition_notes` | `text` | | Free-text damage description — parsed by the Damage Signal Agent. |
| `return_requested_at` | `timestamptz` | NOT NULL | When the buyer requested the return (queue sort key). |
| `return_window_expires_at` | `timestamptz` | | Policy deadline. |
| `inbound_freight_cost_cents` | `integer` | | Estimated inbound freight from the carrier rate fixtures. |
| `status` | `text` | NOT NULL default `pending_triage`, CHECK in (`pending_triage`,`triaging`,`decided`,`escalated`,`resolved`,`closed`) | Triage lifecycle. |
| `created_at` | `timestamptz` | NOT NULL default `now()` | — |
| `updated_at` | `timestamptz` | NOT NULL default `now()` | Maintained by trigger (§4). |

**Indexes:** `order_id` (FK), `customer_id` (FK), `marketplace`, `status`, `return_requested_at`, and a composite `(marketplace, status)` for the queue (§5).
**Foreign keys:** `order_id` → `orders(id)`, `customer_id` → `customers(id)`.
**Status lifecycle:** `pending_triage` → `triaging` (graph running) → `decided` | `escalated`; `escalated` → `resolved` (human resolves HITL); any → `closed`.
**Access patterns:** Intake Agent (read raw return → writes intake JSON to `decision_steps`), Damage Signal Agent (read `condition_notes`), Decision/Customer Comms agents (read), Refund Worker (**updates** `status`), Audit Agent (status reflected via the run). The web app re-runs triage and reads the queue.

---

### 3.7 `return_lines`

**Purpose:** Per-line detail of a return, allowing partial returns (some lines of an order, each with its own condition).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | — |
| `return_id` | `uuid` | NOT NULL, FK → `returns(id)` ON DELETE CASCADE | Parent return. |
| `order_line_id` | `uuid` | NOT NULL, FK → `order_lines(id)` | The order line being returned. |
| `sku_id` | `uuid` | NOT NULL, FK → `sku_catalog(id)` | Product (denormalized for direct SKU joins). |
| `quantity` | `integer` | NOT NULL, CHECK `quantity > 0` | Units returned. |
| `condition` | `text` | NOT NULL, CHECK (same six as `returns.condition`) | Per-line condition. |
| `condition_notes` | `text` | | Per-line damage notes. |
| `created_at` | `timestamptz` | NOT NULL default `now()` | — |

**Indexes:** `return_id` (FK), `sku_id` (FK), `order_line_id` (FK).
**Foreign keys:** `return_id` → `returns(id)` (cascade), `order_line_id` → `order_lines(id)`, `sku_id` → `sku_catalog(id)`.
**Access patterns:** SKU Profile & Damage Signal agents (read per-line SKU + condition), Refurb Worker (per-line grading).

---

### 3.8 `agent_runs`

**Purpose:** One row per graph execution — the parent of all `decision_steps`, `decisions`, `escalations`, and `eval_results` produced in that run. Carries the run-level cost and counts the Agent Ops view reads.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | The `run_id` everything keys off. |
| `trigger` | `text` | NOT NULL, CHECK in (`manual`,`scheduled`,`api`) | How the run started. |
| `triggered_by` | `text` | | User identifier or `"system"`. |
| `return_ids` | `uuid[]` | NOT NULL | Returns processed in this run. |
| `status` | `text` | NOT NULL default `running`, CHECK in (`running`,`completed`,`failed`,`partial`) | Run lifecycle (`partial` = some returns failed). |
| `started_at` | `timestamptz` | NOT NULL default `now()` | — |
| `completed_at` | `timestamptz` | | Set on completion. |
| `total_cost_usd` | `numeric(10,6)` | default `0` | Aggregate LLM cost; the cost-ceiling gate (Hard Rule 16) asserts this < $0.10/decision. |
| `total_decisions` | `integer` | default `0` | Decisions produced. |
| `total_escalations` | `integer` | default `0` | Escalations produced. |
| `graph_version` | `text` | NOT NULL | Commit SHA or semver of the graph topology that ran. |

**Indexes:** `status`, `started_at`.
**Foreign keys:** none outbound; referenced by `decisions.run_id`, `decision_steps.run_id`, `eval_results.run_id`, `escalations.run_id`, `audit_log.run_id`.
**Access patterns:** Graph runner (creates the row, updates status/cost/counts on completion — this is run-level metadata, distinct from the immutable per-step rows). Agent Ops view + Eval Results screen read it.

---

### 3.9 `prompt_versions`

**Purpose:** The prompt registry (Hard Rule 11 / `01a §1.7`) — one row per versioned prompt file, recording which version produced which decision.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | — |
| `agent_name` | `text` | NOT NULL | Agent the prompt belongs to. |
| `version` | `integer` | NOT NULL | Monotonic version per agent. |
| `file_path` | `text` | NOT NULL | e.g. `prompts/decision_agent/v1.md`. |
| `content_hash` | `text` | NOT NULL | SHA-256 of the prompt file; detects drift between DB and file. |
| `notes` | `text` | | Change notes for the A/B comparison view. |
| `is_active` | `boolean` | NOT NULL default `false` | The version currently wired into the graph for this agent. |
| `created_at` | `timestamptz` | NOT NULL default `now()` | — |

**Constraints:** `UNIQUE (agent_name, version)`.
**Indexes:** `agent_name`, `is_active`, plus the unique `(agent_name, version)`.
**Foreign keys:** referenced by `decisions.prompt_version_id`.
**Access patterns:** every LLM node resolves its active version here at run start; the prompt-version A/B comparison strip on the Agent Ops view reads `is_active` history. Written by a registration step in CI when a new prompt file appears.

---

### 3.10 `decisions`

**Purpose:** The headline output — one row per Decision Agent disposition for a return in a run. **Append-only / immutable** (Principle 2): overrides and re-runs create new rows, never mutate existing ones.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | — |
| `return_id` | `uuid` | NOT NULL, FK → `returns(id)` | The return decided. |
| `run_id` | `uuid` | NOT NULL, FK → `agent_runs(id)` | Producing run. |
| `disposition` | `text` | NOT NULL, CHECK in (`refund`,`replace`,`repair`,`refurbish`,`donate`,`dispose`,`escalate`) | The recommended action. |
| `confidence` | `numeric(4,3)` | NOT NULL, CHECK `0 <= confidence <= 1` | Decision Agent confidence (routing signal, not calibrated probability — see Hard Decision #1). |
| `reasoning` | `text` | NOT NULL | Full reasoning text. |
| `prompt_version_id` | `uuid` | FK → `prompt_versions(id)` | Which prompt produced it (Hard Rule 13). |
| `model_used` | `text` | NOT NULL | e.g. `claude-sonnet-4-6` / `claude-opus-4-7`. |
| `input_tokens` | `integer` | | Prompt tokens. |
| `output_tokens` | `integer` | | Completion tokens. |
| `cost_usd` | `numeric(10,6)` | NOT NULL default `0` | This decision's LLM cost. |
| `latency_ms` | `integer` | | End-to-end latency. |
| `status` | `text` | NOT NULL default `pending`, CHECK in (`pending`,`executed`,`overridden`,`failed`) | Execution state of *this* decision row. |
| `created_at` | `timestamptz` | NOT NULL default `now()` | — |

**Indexes:** `return_id` (FK), `run_id` (FK), `disposition`, `created_at`, `prompt_version_id` (FK).
**Foreign keys:** `return_id` → `returns(id)`, `run_id` → `agent_runs(id)`, `prompt_version_id` → `prompt_versions(id)`.
**Immutability note:** Never `UPDATE` a `decisions` row to change a disposition. The only sanctioned mutation is the `status` field transitioning `pending → executed/failed`; a human override is recorded by inserting an `overrides` row (and, on re-execution, a new `decisions` row). An `UPDATE`/`DELETE` guard trigger permits only the `status` column to change and blocks deletes.
**Access patterns:** Decision Agent (**writes**), Customer Comms Agent (read disposition), Escalation Agent (read confidence/disposition), Audit Agent (updates `status` to `executed`), web override flow (reads, then writes `overrides`).

---

### 3.11 `decision_steps`

**Purpose:** The append-only execution trail — one row per graph node visited per run. Powers the Agent Ops live view and the `/agent-ops/[runId]` replay (`01a §1.3`).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `bigserial` | PK | Monotonic insertion order = replay order. |
| `run_id` | `uuid` | NOT NULL, FK → `agent_runs(id)` | Producing run. |
| `return_id` | `uuid` | NOT NULL, FK → `returns(id)` | Return being processed. |
| `node_name` | `text` | NOT NULL | Agent/node name as in the graph topology. |
| `status` | `text` | NOT NULL, CHECK in (`started`,`completed`,`failed`,`skipped`) | Node outcome. |
| `started_at` | `timestamptz` | NOT NULL | Node entry. |
| `completed_at` | `timestamptz` | | Node exit. |
| `latency_ms` | `integer` | GENERATED ALWAYS AS `(EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000)::int` STORED | Derived node latency; `NULL` until `completed_at` is set. |
| `input_state_snapshot` | `jsonb` | | Curated projection passed into the node. |
| `output_state_snapshot` | `jsonb` | | What the node wrote back (incl. confidence/threshold math for the Decision node). |
| `error_message` | `text` | | Failure reason (degrade-don't-hang). |
| `cost_usd` | `numeric(10,6)` | default `0` | Node LLM cost. |

**Indexes:** `run_id` (FK), `return_id` (FK), `node_name`, `started_at`, and a composite `(run_id, return_id)` for fast per-return replay (§5).
**Foreign keys:** `run_id` → `agent_runs(id)`, `return_id` → `returns(id)`.
**Append-only note:** insert-only by contract (Hard Rule 13). A node that starts then completes writes **two** rows (`started`, then `completed`) so the live stream shows the transition — `latency_ms` is computed per-row from its own `started_at`/`completed_at` when both are present; the completion row carries both timestamps. (Alternative single-row-per-node is acceptable if the agent service patches `completed_at` in-process before insert; the schema supports both because the column is nullable and the generated latency tolerates a null.)
**Access patterns:** every node **writes** (started/completed); Intake writes its normalized intake JSON here; the Decision node writes its candidate/threshold math here; Audit Agent writes the final row. Agent Ops view + Audit Log screen read.

---

### 3.12 `audit_log`

**Purpose:** The append-only, cross-entity, immutable history of every state-changing action — by agent or human. The Audit Agent and the web override/escalation flows write it; nothing ever updates or deletes it.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `bigserial` | PK | Monotonic order. |
| `entity_type` | `text` | NOT NULL, CHECK in (`return`,`decision`,`order`,`customer`,`override`) | What the action targeted. |
| `entity_id` | `uuid` | NOT NULL | The targeted row's id. |
| `action` | `text` | NOT NULL, CHECK in (`created`,`status_changed`,`disposition_executed`,`overridden`,`escalated`,`resolved`,`comms_drafted`) | What happened. |
| `actor` | `text` | NOT NULL | Agent name or `human:{user_id}`. |
| `actor_type` | `text` | NOT NULL, CHECK in (`agent`,`human`) | Actor class. |
| `before_state` | `jsonb` | | Snapshot before the action. |
| `after_state` | `jsonb` | | Snapshot after the action. |
| `run_id` | `uuid` | FK → `agent_runs(id)` | Nullable — human actions have no run. |
| `created_at` | `timestamptz` | NOT NULL default `now()` | — |

**Indexes:** composite `(entity_type, entity_id)` for per-entity history, `actor`, `created_at`, `run_id` (FK).
**Foreign keys:** `run_id` → `agent_runs(id)` (nullable).
**Append-only note:** a `BEFORE UPDATE OR DELETE` trigger raises an exception, structurally enforcing immutability (the in-app Audit Log is the legal record of decisioning).
**Access patterns:** Refund/Repair/Refurb/Donate-Dispose workers and the Audit Agent **write**; Customer Comms writes a `comms_drafted` row; the override/escalation web flows write `human`-actor rows. Audit Log screen reads (read-only).

---

### 3.13 `eval_cases`

**Purpose:** The golden test set — hand-crafted, synthetic, and override-promoted cases the eval suite scores the Decision Agent against (Success Criterion 3; Hard Rule 14).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | — |
| `source` | `text` | NOT NULL, CHECK in (`hand_crafted`,`human_override`,`synthetic`) | Provenance. |
| `return_snapshot` | `jsonb` | NOT NULL | Complete return context at decision time. |
| `expected_disposition` | `text` | NOT NULL, CHECK (same seven as `decisions.disposition`) | Ground-truth disposition. |
| `expected_confidence_floor` | `numeric(4,3)` | | Minimum acceptable confidence, if asserted. |
| `notes` | `text` | | Why this case exists / what it probes. |
| `is_active` | `boolean` | NOT NULL default `true` | Whether it counts toward the gate. |
| `created_at` | `timestamptz` | NOT NULL default `now()` | — |

**Indexes:** `source`, `expected_disposition`, `is_active`, and composite `(is_active, expected_disposition)` for fast eval-run selection (§5).
**Foreign keys:** referenced by `eval_results.eval_case_id` and `overrides.eval_case_id`.
**Access patterns:** the eval harness reads active cases; overrides promotion writes `human_override` cases; data-fixtures seeds `hand_crafted`/`synthetic`.

---

### 3.14 `eval_results`

**Purpose:** One row per (eval case × run) scoring — the source of the accuracy number on the Eval Results screen.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | — |
| `eval_case_id` | `uuid` | NOT NULL, FK → `eval_cases(id)` | The case scored. |
| `run_id` | `uuid` | NOT NULL, FK → `agent_runs(id)` | The run that produced the score. |
| `actual_disposition` | `text` | NOT NULL | What the agent produced. |
| `actual_confidence` | `numeric(4,3)` | NOT NULL | Reported confidence. |
| `passed` | `boolean` | NOT NULL, GENERATED ALWAYS AS `(actual_disposition = expected_disposition)` STORED | Pass = disposition match. |
| `cost_usd` | `numeric(10,6)` | | Cost of this eval call. |
| `latency_ms` | `integer` | | Latency of this eval call. |
| `evaluated_at` | `timestamptz` | NOT NULL default `now()` | — |

> **Generated-column note:** A `STORED GENERATED` column can only reference columns *in the same row*. `expected_disposition` lives in `eval_cases`, not here, so `passed` is computed against a co-located copy. The DDL therefore denormalizes `expected_disposition` onto `eval_results` (populated at insert from the joined `eval_cases` row) so `passed` is a pure same-row generated column. This keeps the brief's `passed GENERATED (...)` contract intact while remaining valid Postgres. The denormalized column is documented in the DDL.

**Indexes:** `eval_case_id` (FK), `run_id` (FK), `passed`, `evaluated_at`.
**Foreign keys:** `eval_case_id` → `eval_cases(id)`, `run_id` → `agent_runs(id)`.
**Access patterns:** eval harness **writes**; Eval Results screen reads the accuracy rollup and per-agent breakdown.

---

### 3.15 `overrides`

**Purpose:** Captures every human override of a decision and tracks its promotion into the eval dataset (Hard Rule 14 — the eval set grows from real operator behavior).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | — |
| `return_id` | `uuid` | NOT NULL, FK → `returns(id)` | The overridden return. |
| `original_decision_id` | `uuid` | NOT NULL, FK → `decisions(id)` | The decision being overridden. |
| `override_disposition` | `text` | NOT NULL, CHECK (same seven dispositions) | The human's corrected disposition. |
| `override_reason` | `text` | NOT NULL | Why the human overrode. |
| `overridden_by` | `text` | NOT NULL | User identifier. |
| `added_to_eval_dataset` | `boolean` | NOT NULL default `false` | Whether promoted to a golden case yet. |
| `eval_case_id` | `uuid` | FK → `eval_cases(id)` | Set when promoted. |
| `created_at` | `timestamptz` | NOT NULL default `now()` | — |

**Indexes:** `return_id` (FK), `created_at`, `original_decision_id` (FK), `eval_case_id` (FK).
**Foreign keys:** `return_id` → `returns(id)`, `original_decision_id` → `decisions(id)`, `eval_case_id` → `eval_cases(id)`.
**Access patterns:** web override drawer **writes**; a promotion job sets `added_to_eval_dataset` + `eval_case_id` and inserts the `human_override` eval case.

---

### 3.16 `escalations`

**Purpose:** The human-in-the-loop queue — one row per return the Decision Agent declined to auto-decide (confidence below threshold or value above ceiling). Backs the Escalation Queue screen and the HITL checkpoint resume.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | — |
| `return_id` | `uuid` | NOT NULL, FK → `returns(id)` | The escalated return. |
| `run_id` | `uuid` | NOT NULL, FK → `agent_runs(id)` | The run that escalated it. |
| `decision_id` | `uuid` | NOT NULL, FK → `decisions(id)` | The (escalate) decision row. |
| `escalation_reason` | `text` | NOT NULL | LLM-generated summary ("confidence 0.61 below 0.75; AOV $1,420 above ceiling"). |
| `candidate_dispositions` | `jsonb` | NOT NULL | Array of `{disposition, confidence, reasoning}` the agent weighed. |
| `status` | `text` | NOT NULL default `pending`, CHECK in (`pending`,`resolved`,`expired`) | Queue state. |
| `resolved_by` | `text` | | Resolver. |
| `resolved_at` | `timestamptz` | | When resolved. |
| `resolution_disposition` | `text` | | The disposition the human chose. |
| `resolution_notes` | `text` | | Resolver notes. |
| `created_at` | `timestamptz` | NOT NULL default `now()` | — |

**Indexes:** `status`, `return_id` (FK), `created_at`, `run_id` (FK), `decision_id` (FK).
**Foreign keys:** `return_id` → `returns(id)`, `run_id` → `agent_runs(id)`, `decision_id` → `decisions(id)`.
**Access patterns:** Escalation Agent **writes** (`pending`); Escalation Queue resolution **updates** status/resolution fields (this is queue-state, not the immutable decision — the resolution also produces a new `decisions` row + an `overrides`-style eval capture). The queue is ranked by `returns.inbound_freight_cost_cents` (§6).

---

### 3.17 `comms_drafts`

**Purpose:** Channel-appropriate customer messages drafted by the Customer Comms Agent. Drafts go to a queue, never sent (v1 non-goal).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | — |
| `return_id` | `uuid` | NOT NULL, FK → `returns(id)` | The return the message is about. |
| `decision_id` | `uuid` | NOT NULL, FK → `decisions(id)` | The decision the message communicates. |
| `channel` | `text` | NOT NULL, CHECK (same six channels) | Target channel (tone differs per channel). |
| `draft_text` | `text` | NOT NULL | The drafted message. |
| `tone` | `text` | NOT NULL, CHECK in (`formal`,`friendly`,`apologetic`) | Tone selected. |
| `status` | `text` | NOT NULL default `draft`, CHECK in (`draft`,`approved`,`sent`,`discarded`) | Draft lifecycle (`sent` is aspirational in v1). |
| `created_at` | `timestamptz` | NOT NULL default `now()` | — |

**Indexes:** `return_id` (FK), `status`, `decision_id` (FK).
**Foreign keys:** `return_id` → `returns(id)`, `decision_id` → `decisions(id)`.
**Access patterns:** Customer Comms Agent **writes**; the web app reads the draft queue and can mark `approved`/`discarded`.

---

## 4. Migration Strategy

- **Single migration file:** `supabase/migrations/001_initial_schema.sql`. One file for the v1 initial schema; subsequent changes are additive numbered migrations (`002_*`, …) — we never edit `001` after it ships.
- **Idempotent:** every object uses `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, and `CREATE OR REPLACE FUNCTION`; triggers are guarded with `DROP TRIGGER IF EXISTS` before `CREATE TRIGGER`. Running the migration twice is a no-op.
- **Run order (FK-safe):** `marketplace_configs` → `customers` → `sku_catalog` → `orders` → `order_lines` → `returns` → `return_lines` → `agent_runs` → `prompt_versions` → `decisions` → `decision_steps` → `audit_log` → `eval_cases` → `eval_results` → `overrides` → `escalations` → `comms_drafts`.
  - **Two deviations from the brief's stated order, both for referential integrity:** (1) `sku_catalog` is created *before* `orders`/`order_lines` because `order_lines.sku_id` FKs it; (2) `prompt_versions` is created *before* `decisions` because `decisions.prompt_version_id` FKs it. The brief's order is otherwise preserved. (Logged to ASSUMPTIONS.)
- **Extensions:** `gen_random_uuid()` is a core builtin in PostgreSQL 15+; the migration still issues `CREATE EXTENSION IF NOT EXISTS pgcrypto` defensively so it runs on any 13+ instance.
- **Triggers created:**
  - `set_updated_at()` + `trg_returns_updated_at` — auto-bumps `returns.updated_at` on every `UPDATE` (returns is the only table with `updated_at`).
  - `block_mutation()` + guard triggers on `audit_log` and `decision_steps` — raise an exception on `UPDATE`/`DELETE`, structurally enforcing append-only (Principle 1).
  - `guard_decision_immutability()` + trigger on `decisions` — allow only the `status` column to change; block all other column updates and all deletes (Principle 2).
- **Seed data at the end of the migration:**
  - One admin-user reference row (a single `app_settings`/seed marker so the web app's single-seeded-admin assumption has a home; implemented as a `marketplace_configs`-adjacent seed comment + the five channel rows below). Per `01a §1.4` auth is a Supabase session for one seeded user; the DB seed records the admin identifier in a one-row `app_meta` table.
  - Five `marketplace_configs` reference rows (Wayfair, Amazon FBA, Amazon FBM, Houzz, Overstock, Direct Shopify — six channel slugs; the brief says "5 marketplace policy reference rows," and the modeled channel set is six because Amazon splits FBA/FBM, so all six are seeded and noted).

---

## 5. Index Strategy

- **Every FK column is indexed** (Principle 8) — Postgres does not do this automatically and unindexed FKs make cascade checks and joins slow.
- **Append-only logs get a composite `(run_id, return_id)` index** on both `decision_steps` and `audit_log`-adjacent reads, so the Agent Ops replay (`WHERE run_id = $1 ... ORDER BY id`) and per-return audit reads are index-only on the hot path.
- **`returns` gets a composite `(marketplace, status)` index** for the dashboard queue, which always filters by status and frequently by channel.
- **`eval_cases` gets a composite `(is_active, expected_disposition)` index** so an eval run selects only active cases and groups by expected disposition without a scan.
- **Unique indexes** back natural keys: `customers.external_id`-not-unique-but-indexed; `sku_catalog.sku_code` UNIQUE; `marketplace_configs.slug` UNIQUE; `prompt_versions (agent_name, version)` UNIQUE.
- **Sort-key indexes:** `returns.return_requested_at` (queue order), `agent_runs.started_at`, `audit_log.created_at`, `decision_steps.started_at` for time-ordered reads.

**Index inventory (per table, beyond PKs):**

| Table | Indexes (non-PK) |
|---|---|
| `marketplace_configs` | `slug` (UNIQUE) |
| `customers` | `external_id`, `email` |
| `sku_catalog` | `sku_code` (UNIQUE), `category`, `freight_class` |
| `orders` | `external_order_id`, `customer_id`, `marketplace`, `ordered_at` |
| `order_lines` | `order_id`, `sku_id` |
| `returns` | `order_id`, `customer_id`, `marketplace`, `status`, `return_requested_at`, `(marketplace, status)` |
| `return_lines` | `return_id`, `sku_id`, `order_line_id` |
| `agent_runs` | `status`, `started_at` |
| `prompt_versions` | `agent_name`, `is_active`, `(agent_name, version)` UNIQUE |
| `decisions` | `return_id`, `run_id`, `disposition`, `created_at`, `prompt_version_id` |
| `decision_steps` | `run_id`, `return_id`, `node_name`, `started_at`, `(run_id, return_id)` |
| `audit_log` | `(entity_type, entity_id)`, `actor`, `created_at`, `run_id` |
| `eval_cases` | `source`, `expected_disposition`, `is_active`, `(is_active, expected_disposition)` |
| `eval_results` | `eval_case_id`, `run_id`, `passed`, `evaluated_at` |
| `overrides` | `return_id`, `created_at`, `original_decision_id`, `eval_case_id` |
| `escalations` | `status`, `return_id`, `created_at`, `run_id`, `decision_id` |
| `comms_drafts` | `return_id`, `status`, `decision_id` |

---

## 6. Query Patterns Reference

The canonical query each screen runs. These drive the index choices in §5 and are the contract the BFF/agent query layers implement.

**Dashboard queue** (`/`) — pending returns with their latest disposition:
```sql
SELECT r.*, d.disposition, d.confidence
FROM returns r
LEFT JOIN LATERAL (
  SELECT disposition, confidence
  FROM decisions
  WHERE return_id = r.id
  ORDER BY created_at DESC
  LIMIT 1
) d ON true
WHERE r.status = 'pending_triage'
ORDER BY r.return_requested_at ASC;
```
> A `LATERAL` is used so each return joins to its *latest* decision (decisions are append-only, so a plain join would fan out across re-runs). The brief's simpler `LEFT JOIN decisions d ON d.return_id = r.id` is correct when a return has at most one decision; the LATERAL form is the robust version once re-runs/overrides exist. Served by `returns(status, return_requested_at)` + `decisions(return_id, created_at)`.

**Agent Ops replay** (`/agent-ops/[runId]`) — every node visited, in order:
```sql
SELECT * FROM decision_steps WHERE run_id = $1 ORDER BY id ASC;
```
> Served by `decision_steps(run_id, return_id)` composite; `id` ordering is the natural replay sequence.

**Escalation queue** (`/escalations`) — pending escalations, ranked by freight at risk:
```sql
SELECT e.*, r.*, d.*
FROM escalations e
JOIN returns r ON r.id = e.return_id
JOIN decisions d ON d.id = e.decision_id
WHERE e.status = 'pending'
ORDER BY r.inbound_freight_cost_cents DESC NULLS LAST;
```
> Served by `escalations(status)` + the FK indexes on `return_id`/`decision_id`.

**Eval accuracy** (`/evals`) — pass rate for a run:
```sql
SELECT COUNT(*) FILTER (WHERE passed)::float / NULLIF(COUNT(*), 0) AS accuracy
FROM eval_results
WHERE run_id = $1;
```
> `NULLIF` guards an empty run. Served by `eval_results(run_id)` + the `passed` index.

**Per-agent eval breakdown** (`/evals`) — pass % grouped by expected disposition:
```sql
SELECT ec.expected_disposition,
       COUNT(*) AS cases,
       COUNT(*) FILTER (WHERE er.passed)::float / NULLIF(COUNT(*), 0) AS pass_rate
FROM eval_results er
JOIN eval_cases ec ON ec.id = er.eval_case_id
WHERE er.run_id = $1
GROUP BY ec.expected_disposition
ORDER BY pass_rate ASC;
```

**Audit log for an entity** (`/audit` and Return Detail timeline) — full history of one row:
```sql
SELECT * FROM audit_log WHERE entity_id = $1 ORDER BY created_at ASC;
```
> Served by the `audit_log(entity_type, entity_id)` composite (callers pass `entity_type` too for selectivity).

**Return Detail decision history** (`/returns/[returnId]`):
```sql
SELECT * FROM decisions WHERE return_id = $1 ORDER BY created_at DESC;
```

---

## 7. Access-Pattern Matrix (agent → table)

Cross-check against `/docs/00-discovery.md §2`. `R` = reads, `W` = writes/updates.

| Agent | customers | orders | sku_catalog | returns | return_lines | decisions | decision_steps | audit_log | escalations | comms_drafts |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 Intake | | | | R | | | W (intake) | | | |
| 2 Customer History | R | R | | | | | W | | | |
| 3 SKU Profile | | | R | | R | | W | | | |
| 4 Marketplace Policy | | | | R (channel) | | | W | | | |
| 5 Damage Signal | | | | R (notes) | R | | W | | | |
| 6 Fraud Flag | R | R | | | | | W | | | |
| 7 Decision | | | | | | **W** | W | | | |
| 8 Refund Worker | | | | W (status) | | R | W | **W** | | |
| 9 Replacement Worker | | **W** (new) | R (stock) | W (status) | | R | W | W | | |
| 10 Repair Worker | | | | | R | R | W | **W** | | |
| 11 Refurb Worker | | | R (refurb) | | R | R | W | **W** | | |
| 12 Donate/Dispose | | | R (weight) | | | R | W | **W** | | |
| 13 Customer Comms | | | | R | | R | W | W (comms_drafted) | | **W** |
| 14 Escalation | | R (value) | | | | R | W | W | **W** | |
| 15 Audit | | | | (status via run) | | W (status→executed) | **W** (final) | **W** | | |

Marketplace Policy (4) additionally reads `marketplace_configs` to resolve the YAML path, then reads the YAML file — it never reads policy *values* from the DB (Hard Rule 15). The web app (not an agent) writes `overrides`, updates `escalations` resolution fields, and reads everything.

---

## Anti-Drift Checklist (Phase 1C boundary)

1. **Deliverable doc written?** Yes — this file (`/docs/01d-schema.md`) and `supabase/migrations/001_initial_schema.sql`.
2. **BUILD_LEDGER updated?** Phase 1C rows move `planned → built` (schema doc + all 15+ tables). New rows added for `marketplace_configs`, `eval_results`, `escalations`, `comms_drafts`, `app_meta`, and the migration file.
3. **Gate commands run?** N/A for Phase 1C in isolation — no runtime to migrate against yet (Neon is provisioned in Phase 5; the migration is applied locally in Phase 2 scaffolding). The SQL is written to be PG15+ valid; first live `psql -f` run is Phase 2.
4. **Deferred items?** Unchanged — no schema for multi-tenancy/RLS/real-API tables (single-tenant by design).
5. **Assumptions logged?** Two schema-shaping assumptions to record: (a) run-order deviations (`sku_catalog` and `prompt_versions` moved earlier for FK integrity); (b) `eval_results.expected_disposition` denormalized so `passed` can be a same-row STORED generated column.
6. **Re-read discovery — anything unaccounted for?** All 15 agents map to a read/write in §7; all six channels are CHECK-constrained and seeded; the freight-economics fields (`weight_lbs`, `freight_class`, `inbound_freight_cost_cents`, `refurb_cost_estimate_cents`, `open_box_price_estimate_cents`) that drive Hard Decision economics are present.
7. **Prior-phase commitments carried forward?** `01a §1.4` (Neon, no ORM, RLS off, agent sole writer of audit/steps), `§1.6` (one run → N steps), `§1.7` (prompt_versions FK on decisions) all honored.
8. **Per-agent artifacts?** Schema-only phase; agent specs/prompts/tests are Phase 3. The tables those artifacts populate (`prompt_versions`, `eval_cases`, `eval_results`, `decision_steps`) exist here.
9. **Decision audit row shape?** `decision_steps` records agent (`node_name`), prompt version (via the `decisions.prompt_version_id` for the Decision node), input/output snapshots, cost, latency; `decisions` records confidence; both keyed to `run_id`. Append-only enforced by trigger.
10. **Graph topology doc still matches?** `01b-graph-topology.md` is a parallel Phase 1 track; the node set this schema serves (15 agents) matches the Phase 0 inventory it will formalize. No conflict.
11. **Agent Ops view renders every node?** Schema supports it: `decision_steps.node_name` + `status` per node, replayable by `(run_id, return_id)`.
12. **Cost per run under $0.10?** Schema records it: `decision_steps.cost_usd` per node and `agent_runs.total_cost_usd` per run for the cost-ceiling assertion.
