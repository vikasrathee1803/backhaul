-- =============================================================================
-- Backhaul — Migration 001: Initial Schema
-- =============================================================================
-- Single-tenant AI returns-triage system. PostgreSQL 15+ (Neon).
-- Source of truth: docs/01d-schema.md. Keep the two in lockstep.
--
-- Design principles (see docs/01d-schema.md §1):
--   * audit_log and decision_steps are APPEND-ONLY (insert-only; guarded by trigger).
--   * decisions are IMMUTABLE after write (only `status` may change; guarded by trigger).
--   * money is integer cents (*_cents); LLM cost is numeric(10,6) USD.
--   * all timestamps are timestamptz (UTC).
--   * uuid PKs everywhere except the two append-only logs (bigserial for ordering).
--   * status columns are text + CHECK (no enums — easier to extend).
--   * agent output payloads are jsonb (fast for v1, normalizable in v2).
--
-- Idempotent: CREATE ... IF NOT EXISTS throughout; functions CREATE OR REPLACE;
-- triggers DROP IF EXISTS then CREATE. Safe to run more than once.
--
-- FK-safe run order:
--   marketplace_configs -> customers -> sku_catalog -> orders -> order_lines
--   -> returns -> return_lines -> agent_runs -> prompt_versions -> decisions
--   -> decision_steps -> audit_log -> eval_cases -> eval_results -> overrides
--   -> escalations -> comms_drafts
-- (Two deviations from the brief's stated order for referential integrity:
--  sku_catalog precedes orders/order_lines; prompt_versions precedes decisions.)
-- =============================================================================

BEGIN;

-- gen_random_uuid() is a core builtin in PG13+; create the extension defensively
-- so the migration also runs on older instances that bundle it under pgcrypto.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- Shared trigger functions
-- -----------------------------------------------------------------------------

-- Auto-maintain an updated_at column on UPDATE (used by `returns`).
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Block UPDATE/DELETE entirely — structural enforcement of append-only tables.
CREATE OR REPLACE FUNCTION block_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Table % is append-only: % is not permitted',
    TG_TABLE_NAME, TG_OP;
END;
$$ LANGUAGE plpgsql;

-- Enforce decision immutability: permit only the `status` column to change on
-- UPDATE; block all other column updates and block DELETE.
CREATE OR REPLACE FUNCTION guard_decision_immutability()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'decisions rows are immutable: DELETE is not permitted';
  END IF;

  -- On UPDATE, every column except `status` must be unchanged.
  IF ROW(NEW.id, NEW.return_id, NEW.run_id, NEW.disposition, NEW.confidence,
         NEW.reasoning, NEW.prompt_version_id, NEW.model_used, NEW.input_tokens,
         NEW.output_tokens, NEW.cost_usd, NEW.latency_ms, NEW.created_at)
     IS DISTINCT FROM
     ROW(OLD.id, OLD.return_id, OLD.run_id, OLD.disposition, OLD.confidence,
         OLD.reasoning, OLD.prompt_version_id, OLD.model_used, OLD.input_tokens,
         OLD.output_tokens, OLD.cost_usd, OLD.latency_ms, OLD.created_at)
  THEN
    RAISE EXCEPTION 'decisions rows are immutable: only the status column may change';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 0. app_meta  — single-row marker for the seeded admin user (single-tenant v1)
-- =============================================================================
CREATE TABLE IF NOT EXISTS app_meta (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id   text NOT NULL,            -- identifier of the single seeded admin
  admin_email     text,
  schema_version  text NOT NULL DEFAULT '001',
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 1. marketplace_configs  — channel registry (policy VALUES live in YAML)
-- =============================================================================
CREATE TABLE IF NOT EXISTS marketplace_configs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL UNIQUE,        -- wayfair, amazon_fba, ...
  display_name  text NOT NULL,
  config_path   text NOT NULL,               -- config/marketplaces/<slug>.yaml
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);
-- slug already UNIQUE-indexed.

-- =============================================================================
-- 2. customers
-- =============================================================================
CREATE TABLE IF NOT EXISTS customers (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id           text NOT NULL,
  email                 text,
  name                  text,
  lifetime_value_cents  integer NOT NULL DEFAULT 0,
  order_count           integer NOT NULL DEFAULT 0,
  return_count          integer NOT NULL DEFAULT 0,
  -- derived; NULL when order_count = 0 (NULLIF avoids divide-by-zero)
  return_rate           numeric(5,4)
                          GENERATED ALWAYS AS
                          (return_count::numeric / NULLIF(order_count, 0)) STORED,
  first_order_at        timestamptz,
  last_order_at         timestamptz,
  fraud_flag            boolean NOT NULL DEFAULT false,
  fraud_notes           text,
  created_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customers_external_id ON customers (external_id);
CREATE INDEX IF NOT EXISTS idx_customers_email       ON customers (email);

-- =============================================================================
-- 3. sku_catalog  (created before orders/order_lines: they FK it)
-- =============================================================================
CREATE TABLE IF NOT EXISTS sku_catalog (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_code                        text NOT NULL UNIQUE,
  name                            text NOT NULL,
  category                        text NOT NULL
                                    CHECK (category IN
                                      ('furniture','appliance','fitness','outdoor','industrial')),
  weight_lbs                      numeric(8,2) NOT NULL,
  length_in                       numeric(8,2),
  width_in                        numeric(8,2),
  height_in                       numeric(8,2),
  -- NMFC freight classes; text because 77.5 / 92.5 are non-integer canonical values
  freight_class                   text NOT NULL
                                    CHECK (freight_class IN
                                      ('50','55','60','65','70','77.5','85','92.5','100',
                                       '110','125','150','175','200','250','300','400','500')),
  refurb_difficulty               text NOT NULL
                                    CHECK (refurb_difficulty IN
                                      ('easy','moderate','hard','not_refurbishable')),
  refurb_cost_estimate_cents      integer,
  open_box_price_estimate_cents   integer,
  current_stock                   integer NOT NULL DEFAULT 0,
  is_active                       boolean NOT NULL DEFAULT true,
  created_at                      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sku_catalog_category      ON sku_catalog (category);
CREATE INDEX IF NOT EXISTS idx_sku_catalog_freight_class ON sku_catalog (freight_class);
-- sku_code already UNIQUE-indexed.

-- =============================================================================
-- 4. orders
-- =============================================================================
CREATE TABLE IF NOT EXISTS orders (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_order_id   text NOT NULL,
  marketplace         text NOT NULL
                        CHECK (marketplace IN
                          ('wayfair','amazon_fba','amazon_fbm','houzz','overstock','shopify')),
  customer_id         uuid NOT NULL REFERENCES customers (id),
  ordered_at          timestamptz NOT NULL,
  shipped_at          timestamptz,
  delivered_at        timestamptz,
  status              text NOT NULL
                        CHECK (status IN
                          ('pending','shipped','delivered','returned','cancelled')),
  subtotal_cents      integer NOT NULL,
  shipping_cents      integer NOT NULL DEFAULT 0,
  total_cents         integer NOT NULL,
  channel_order_url   text,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orders_external_order_id ON orders (external_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id       ON orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_marketplace       ON orders (marketplace);
CREATE INDEX IF NOT EXISTS idx_orders_ordered_at        ON orders (ordered_at);

-- =============================================================================
-- 5. order_lines
-- =============================================================================
CREATE TABLE IF NOT EXISTS order_lines (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          uuid NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  sku_id            uuid NOT NULL REFERENCES sku_catalog (id),
  quantity          integer NOT NULL CHECK (quantity > 0),
  unit_price_cents  integer NOT NULL,
  line_total_cents  integer NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_lines_order_id ON order_lines (order_id);
CREATE INDEX IF NOT EXISTS idx_order_lines_sku_id   ON order_lines (sku_id);

-- =============================================================================
-- 6. returns
-- =============================================================================
CREATE TABLE IF NOT EXISTS returns (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_return_id          text,                                   -- nullable until synced
  order_id                    uuid NOT NULL REFERENCES orders (id),
  customer_id                 uuid NOT NULL REFERENCES customers (id),
  marketplace                 text NOT NULL
                                CHECK (marketplace IN
                                  ('wayfair','amazon_fba','amazon_fbm','houzz','overstock','shopify')),
  return_reason               text NOT NULL
                                CHECK (return_reason IN
                                  ('damage_in_transit','defective','wrong_item',
                                   'buyer_remorse','not_as_described','other')),
  condition                   text NOT NULL
                                CHECK (condition IN
                                  ('new','like_new','good','fair','poor','unusable')),
  condition_notes             text,                                   -- parsed by Damage Signal Agent
  return_requested_at         timestamptz NOT NULL,
  return_window_expires_at    timestamptz,
  inbound_freight_cost_cents  integer,                                -- from carrier rate fixtures
  status                      text NOT NULL DEFAULT 'pending_triage'
                                CHECK (status IN
                                  ('pending_triage','triaging','decided',
                                   'escalated','resolved','closed')),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_returns_order_id            ON returns (order_id);
CREATE INDEX IF NOT EXISTS idx_returns_customer_id         ON returns (customer_id);
CREATE INDEX IF NOT EXISTS idx_returns_marketplace         ON returns (marketplace);
CREATE INDEX IF NOT EXISTS idx_returns_status              ON returns (status);
CREATE INDEX IF NOT EXISTS idx_returns_return_requested_at ON returns (return_requested_at);
-- composite for the dashboard queue (filters by status, often by channel)
CREATE INDEX IF NOT EXISTS idx_returns_marketplace_status  ON returns (marketplace, status);

-- updated_at trigger (returns is the only table with updated_at)
DROP TRIGGER IF EXISTS trg_returns_updated_at ON returns;
CREATE TRIGGER trg_returns_updated_at
  BEFORE UPDATE ON returns
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- 7. return_lines
-- =============================================================================
CREATE TABLE IF NOT EXISTS return_lines (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id       uuid NOT NULL REFERENCES returns (id) ON DELETE CASCADE,
  order_line_id   uuid NOT NULL REFERENCES order_lines (id),
  sku_id          uuid NOT NULL REFERENCES sku_catalog (id),
  quantity        integer NOT NULL CHECK (quantity > 0),
  condition       text NOT NULL
                    CHECK (condition IN
                      ('new','like_new','good','fair','poor','unusable')),
  condition_notes text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_return_lines_return_id     ON return_lines (return_id);
CREATE INDEX IF NOT EXISTS idx_return_lines_sku_id        ON return_lines (sku_id);
CREATE INDEX IF NOT EXISTS idx_return_lines_order_line_id ON return_lines (order_line_id);

-- =============================================================================
-- 8. agent_runs  (created before decisions/decision_steps: they FK it)
-- =============================================================================
CREATE TABLE IF NOT EXISTS agent_runs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger             text NOT NULL CHECK (trigger IN ('manual','scheduled','api')),
  triggered_by        text,
  return_ids          uuid[] NOT NULL,
  status              text NOT NULL DEFAULT 'running'
                        CHECK (status IN ('running','completed','failed','partial')),
  started_at          timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz,
  total_cost_usd      numeric(10,6) DEFAULT 0,
  total_decisions     integer DEFAULT 0,
  total_escalations   integer DEFAULT 0,
  graph_version       text NOT NULL                  -- commit SHA or semver
);
CREATE INDEX IF NOT EXISTS idx_agent_runs_status     ON agent_runs (status);
CREATE INDEX IF NOT EXISTS idx_agent_runs_started_at ON agent_runs (started_at);

-- =============================================================================
-- 9. prompt_versions  (created before decisions: decisions FKs it)
-- =============================================================================
CREATE TABLE IF NOT EXISTS prompt_versions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name    text NOT NULL,
  version       integer NOT NULL,
  file_path     text NOT NULL,                 -- prompts/<agent>/v<N>.md
  content_hash  text NOT NULL,                 -- SHA-256 of the prompt file
  notes         text,
  is_active     boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_prompt_versions_agent_version UNIQUE (agent_name, version)
);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_agent_name ON prompt_versions (agent_name);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_is_active  ON prompt_versions (is_active);

-- =============================================================================
-- 10. decisions  — APPEND-ONLY / IMMUTABLE (only `status` may change)
-- =============================================================================
CREATE TABLE IF NOT EXISTS decisions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id           uuid NOT NULL REFERENCES returns (id),
  run_id              uuid NOT NULL REFERENCES agent_runs (id),
  disposition         text NOT NULL
                        CHECK (disposition IN
                          ('refund','replace','repair','refurbish','donate','dispose','escalate')),
  confidence          numeric(4,3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  reasoning           text NOT NULL,
  prompt_version_id   uuid REFERENCES prompt_versions (id),
  model_used          text NOT NULL,
  input_tokens        integer,
  output_tokens       integer,
  cost_usd            numeric(10,6) NOT NULL DEFAULT 0,
  latency_ms          integer,
  status              text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','executed','overridden','failed')),
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_decisions_return_id         ON decisions (return_id);
CREATE INDEX IF NOT EXISTS idx_decisions_run_id            ON decisions (run_id);
CREATE INDEX IF NOT EXISTS idx_decisions_disposition       ON decisions (disposition);
CREATE INDEX IF NOT EXISTS idx_decisions_created_at        ON decisions (created_at);
CREATE INDEX IF NOT EXISTS idx_decisions_prompt_version_id ON decisions (prompt_version_id);

-- immutability guard: only `status` may change on UPDATE; DELETE blocked.
DROP TRIGGER IF EXISTS trg_decisions_immutable ON decisions;
CREATE TRIGGER trg_decisions_immutable
  BEFORE UPDATE OR DELETE ON decisions
  FOR EACH ROW EXECUTE FUNCTION guard_decision_immutability();

-- =============================================================================
-- 11. decision_steps  — APPEND-ONLY (one row per node visited; bigserial order)
-- =============================================================================
CREATE TABLE IF NOT EXISTS decision_steps (
  id                      bigserial PRIMARY KEY,           -- insertion order = replay order
  run_id                  uuid NOT NULL REFERENCES agent_runs (id),
  return_id               uuid NOT NULL REFERENCES returns (id),
  node_name               text NOT NULL,                   -- agent name as in graph topology
  status                  text NOT NULL
                            CHECK (status IN ('started','completed','failed','skipped')),
  started_at              timestamptz NOT NULL,
  completed_at            timestamptz,
  -- derived node latency in ms; NULL until completed_at is set
  latency_ms              integer
                            GENERATED ALWAYS AS
                            ((EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000)::int) STORED,
  input_state_snapshot    jsonb,                           -- curated projection into the node
  output_state_snapshot   jsonb,                           -- what the node wrote back
  error_message           text,
  cost_usd                numeric(10,6) DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_decision_steps_run_id     ON decision_steps (run_id);
CREATE INDEX IF NOT EXISTS idx_decision_steps_return_id  ON decision_steps (return_id);
CREATE INDEX IF NOT EXISTS idx_decision_steps_node_name  ON decision_steps (node_name);
CREATE INDEX IF NOT EXISTS idx_decision_steps_started_at ON decision_steps (started_at);
-- composite for fast Agent Ops replay (WHERE run_id = $1 ... ORDER BY id)
CREATE INDEX IF NOT EXISTS idx_decision_steps_run_return ON decision_steps (run_id, return_id);

-- append-only guard
DROP TRIGGER IF EXISTS trg_decision_steps_append_only ON decision_steps;
CREATE TRIGGER trg_decision_steps_append_only
  BEFORE UPDATE OR DELETE ON decision_steps
  FOR EACH ROW EXECUTE FUNCTION block_mutation();

-- =============================================================================
-- 12. audit_log  — APPEND-ONLY (cross-entity immutable history; bigserial order)
-- =============================================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id            bigserial PRIMARY KEY,
  entity_type   text NOT NULL
                  CHECK (entity_type IN ('return','decision','order','customer','override')),
  entity_id     uuid NOT NULL,
  action        text NOT NULL
                  CHECK (action IN
                    ('created','status_changed','disposition_executed',
                     'overridden','escalated','resolved','comms_drafted')),
  actor         text NOT NULL,                              -- agent name or human:{user_id}
  actor_type    text NOT NULL CHECK (actor_type IN ('agent','human')),
  before_state  jsonb,
  after_state   jsonb,
  run_id        uuid REFERENCES agent_runs (id),            -- nullable: human actions have no run
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity      ON audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor       ON audit_log (actor);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at  ON audit_log (created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_run_id      ON audit_log (run_id);

-- append-only guard
DROP TRIGGER IF EXISTS trg_audit_log_append_only ON audit_log;
CREATE TRIGGER trg_audit_log_append_only
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION block_mutation();

-- =============================================================================
-- 13. eval_cases  — golden test set (grows from human overrides)
-- =============================================================================
CREATE TABLE IF NOT EXISTS eval_cases (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source                      text NOT NULL
                                CHECK (source IN ('hand_crafted','human_override','synthetic')),
  return_snapshot             jsonb NOT NULL,                -- complete return context
  expected_disposition        text NOT NULL
                                CHECK (expected_disposition IN
                                  ('refund','replace','repair','refurbish','donate','dispose','escalate')),
  expected_confidence_floor   numeric(4,3),
  notes                       text,
  is_active                   boolean NOT NULL DEFAULT true,
  created_at                  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_eval_cases_source               ON eval_cases (source);
CREATE INDEX IF NOT EXISTS idx_eval_cases_expected_disposition ON eval_cases (expected_disposition);
CREATE INDEX IF NOT EXISTS idx_eval_cases_is_active            ON eval_cases (is_active);
-- composite for fast eval-run selection (active cases grouped by expected disposition)
CREATE INDEX IF NOT EXISTS idx_eval_cases_active_disposition
  ON eval_cases (is_active, expected_disposition);

-- =============================================================================
-- 14. eval_results  — per (case x run) score
-- =============================================================================
-- NOTE: a STORED GENERATED column can reference only same-row columns. The brief
-- defines `passed` as (actual_disposition = expected_disposition), but
-- expected_disposition lives in eval_cases. We therefore denormalize
-- expected_disposition onto this table (populated at insert from the joined
-- eval_cases row) so `passed` is a pure same-row generated column. Documented in
-- docs/01d-schema.md §3.14.
CREATE TABLE IF NOT EXISTS eval_results (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eval_case_id          uuid NOT NULL REFERENCES eval_cases (id),
  run_id                uuid NOT NULL REFERENCES agent_runs (id),
  expected_disposition  text NOT NULL,                       -- denormalized copy for `passed`
  actual_disposition    text NOT NULL,
  actual_confidence     numeric(4,3) NOT NULL,
  passed                boolean
                          GENERATED ALWAYS AS
                          (actual_disposition = expected_disposition) STORED,
  cost_usd              numeric(10,6),
  latency_ms            integer,
  evaluated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_eval_results_eval_case_id ON eval_results (eval_case_id);
CREATE INDEX IF NOT EXISTS idx_eval_results_run_id       ON eval_results (run_id);
CREATE INDEX IF NOT EXISTS idx_eval_results_passed       ON eval_results (passed);
CREATE INDEX IF NOT EXISTS idx_eval_results_evaluated_at ON eval_results (evaluated_at);

-- =============================================================================
-- 15. overrides  — human override capture (feeds the eval dataset)
-- =============================================================================
CREATE TABLE IF NOT EXISTS overrides (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id               uuid NOT NULL REFERENCES returns (id),
  original_decision_id    uuid NOT NULL REFERENCES decisions (id),
  override_disposition    text NOT NULL
                            CHECK (override_disposition IN
                              ('refund','replace','repair','refurbish','donate','dispose','escalate')),
  override_reason         text NOT NULL,
  overridden_by           text NOT NULL,
  added_to_eval_dataset   boolean NOT NULL DEFAULT false,
  eval_case_id            uuid REFERENCES eval_cases (id),   -- set when promoted
  created_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_overrides_return_id            ON overrides (return_id);
CREATE INDEX IF NOT EXISTS idx_overrides_created_at           ON overrides (created_at);
CREATE INDEX IF NOT EXISTS idx_overrides_original_decision_id ON overrides (original_decision_id);
CREATE INDEX IF NOT EXISTS idx_overrides_eval_case_id         ON overrides (eval_case_id);

-- =============================================================================
-- 16. escalations  — human-in-the-loop queue
-- =============================================================================
CREATE TABLE IF NOT EXISTS escalations (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id               uuid NOT NULL REFERENCES returns (id),
  run_id                  uuid NOT NULL REFERENCES agent_runs (id),
  decision_id             uuid NOT NULL REFERENCES decisions (id),
  escalation_reason       text NOT NULL,                     -- LLM-generated summary
  candidate_dispositions  jsonb NOT NULL,                    -- [{disposition, confidence, reasoning}]
  status                  text NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','resolved','expired')),
  resolved_by             text,
  resolved_at             timestamptz,
  resolution_disposition  text,
  resolution_notes        text,
  created_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_escalations_status      ON escalations (status);
CREATE INDEX IF NOT EXISTS idx_escalations_return_id   ON escalations (return_id);
CREATE INDEX IF NOT EXISTS idx_escalations_created_at  ON escalations (created_at);
CREATE INDEX IF NOT EXISTS idx_escalations_run_id      ON escalations (run_id);
CREATE INDEX IF NOT EXISTS idx_escalations_decision_id ON escalations (decision_id);

-- =============================================================================
-- 17. comms_drafts  — drafted customer messages (queued, never sent in v1)
-- =============================================================================
CREATE TABLE IF NOT EXISTS comms_drafts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id     uuid NOT NULL REFERENCES returns (id),
  decision_id   uuid NOT NULL REFERENCES decisions (id),
  channel       text NOT NULL
                  CHECK (channel IN
                    ('wayfair','amazon_fba','amazon_fbm','houzz','overstock','shopify')),
  draft_text    text NOT NULL,
  tone          text NOT NULL CHECK (tone IN ('formal','friendly','apologetic')),
  status        text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','approved','sent','discarded')),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comms_drafts_return_id   ON comms_drafts (return_id);
CREATE INDEX IF NOT EXISTS idx_comms_drafts_status      ON comms_drafts (status);
CREATE INDEX IF NOT EXISTS idx_comms_drafts_decision_id ON comms_drafts (decision_id);

-- =============================================================================
-- Seed data
-- =============================================================================

-- Single seeded admin user (single-tenant v1; see docs/01a-architecture.md §1.4).
INSERT INTO app_meta (admin_user_id, admin_email, schema_version)
SELECT 'admin', 'ops-lead@backhaul.local', '001'
WHERE NOT EXISTS (SELECT 1 FROM app_meta);

-- Marketplace channel registry. Policy VALUES live in config/marketplaces/*.yaml
-- (Hard Rule 15); these rows only register the channels and the YAML path.
INSERT INTO marketplace_configs (slug, display_name, config_path) VALUES
  ('wayfair',    'Wayfair',         'config/marketplaces/wayfair.yaml'),
  ('amazon_fba', 'Amazon (FBA)',    'config/marketplaces/amazon_fba.yaml'),
  ('amazon_fbm', 'Amazon (FBM)',    'config/marketplaces/amazon_fbm.yaml'),
  ('houzz',      'Houzz',           'config/marketplaces/houzz.yaml'),
  ('overstock',  'Overstock',       'config/marketplaces/overstock.yaml'),
  ('shopify',    'Direct Shopify',  'config/marketplaces/shopify.yaml')
ON CONFLICT (slug) DO NOTHING;

COMMIT;

-- Migration 001 complete: 18 tables, 56 indexes created
-- (app_meta, marketplace_configs, customers, sku_catalog, orders, order_lines,
--  returns, return_lines, agent_runs, prompt_versions, decisions, decision_steps,
--  audit_log, eval_cases, eval_results, overrides, escalations, comms_drafts;
--  plus 3 trigger functions and 5 triggers.)
