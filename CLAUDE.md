# MASTER BUILD PROMPT — Backhaul

Paste this into Claude Code as your opening instruction.

(Working name "Backhaul" because it is a freight term for the return trip after delivery, and the domain is big-ticket returns. Rename if you prefer. The brief stays the same.)

---

## 0. Project Brief

```
PROJECT NAME:        Backhaul (working title, rename freely)

ONE-LINE PURPOSE:    Backhaul is an AI agent that triages and resolves returns
                     for big-ticket marketplace sellers, deciding refund vs.
                     replace vs. repair vs. refurbish vs. dispose for every
                     incoming return across Wayfair, Amazon, Houzz, Overstock,
                     and direct channels, so a 2-person ops team handles the
                     volume that used to take 10.

DOMAIN:              Multi-marketplace returns operations for big-ticket and
                     heavy goods (furniture, appliances, fitness equipment,
                     outdoor, industrial). Average order value north of $400.
                     Freight is a real line item. Damage in transit is common.
                     Each marketplace has its own return policy, freight subsidy,
                     damage allowance, and decisioning window.

WHY THIS IS NOT NAVI / FINI / LOOP / CLAIMLANE:
                     Existing players assume one channel and small-ticket
                     economics. NAVI targets DTC Shopify post-purchase. Loop is
                     Shopify-exchange-focused. Fini handles the conversation,
                     not the decisioning layer. Claimlane does image and video
                     analysis. None of them target the multi-marketplace
                     big-ticket seller with channel-specific decisioning and
                     freight-aware refurbish-or-dispose logic. That is the
                     wedge, and it is real because the math is different: when
                     a $1,200 sofa comes back damaged, the decision is not just
                     "refund or exchange," it is "is it cheaper to refurbish and
                     resell as Open Box, donate locally, or dispose," and that
                     calculation depends on inbound freight cost, refurb labor,
                     local Open Box demand, and the originating marketplace's
                     reimbursement policy.

PRIMARY USER:        Returns Ops Lead at a big-ticket multi-marketplace seller.
                     Single user role for v1. No multi-tenant. No RBAC. No
                     workspaces. This is a single-tenant internal tool built
                     for one seller persona.

CORE JOBS-TO-BE-DONE:
  1. Ingest every incoming return across all configured marketplaces and
     direct channels, with the original order context attached.
  2. Decide the right disposition for each return (refund, replace, exchange,
     repair, refurbish-and-resell, donate, dispose, escalate) using
     channel-specific policy, customer history, freight economics, item
     condition signals, and fraud flags.
  3. Execute the disposition: issue refunds, book replacement shipments,
     schedule repair pickups, route to refurb queue, route to donate/dispose,
     draft customer comms, log audit trail.
  4. Surface the decision in an Agent Ops view inside the app, where the user
     can watch the graph execute live, inspect any decision, override or
     re-route, and see cost-per-decision and quality scores in real time.
  5. Learn from human overrides. Every override is captured into the eval
     dataset for the next iteration of the prompts.

DEMO SOURCE STORY:   The portfolio narrative for hiring managers reads as:
                     "I was Director of Business Analytics at Cymax Group, a
                     marketplace seller of furniture and big-ticket goods. I
                     watched the returns ops team manually triage every return
                     across eight channels. I built the system I wished we had."
                     This is the framing. Reference it in the README.

DESIGN SOURCE:       No external design exists. The architect and designer roles
                     own the design system from scratch. Aim for an opinionated,
                     operator-grade UI. Reference points: Linear, Vercel
                     dashboard, Retool. Dense information, fast keyboard nav,
                     fewer rounded corners than the SaaS norm. The product
                     reads "I am a serious tool for serious operators."

MARKETPLACES MODELED IN V1 (with fixture data, no real API connections):
  - Wayfair             (the dominant big-ticket marketplace)
  - Amazon              (FBA and FBM)
  - Houzz               (designer / trade channel)
  - Overstock           (clearance and liquidation dynamics)
  - Direct Shopify D2C  (comparison channel, simplest policy)

  Connector framework is pluggable so adding Williams-Sonoma trade, Home Depot
  Pro, or a custom B2B channel is a config addition, not a rewrite.

DATA MODEL:          Single-tenant, fixture-driven for the v1 demo. Real-API
                     mode is a phase 5 stretch only if time permits.
                     Generate realistic fixture data covering:
                       - 200+ historical orders across all marketplaces
                       - 50+ returns in various states, including damage,
                         defect, buyer remorse, wrong item, fraud-flagged
                       - Customer profiles with order history and LTV
                       - SKU catalog with weight, dimensions, freight class,
                         refurb-difficulty score, current marketplace stock
                       - Marketplace policy fixtures (return window, freight
                         subsidy, damage threshold, restocking fee rules)
                       - Carrier rate fixtures for inbound freight cost
                         estimation

AGENT FRAMEWORK:     Architect decides between Python LangGraph and
                     TypeScript LangGraph.js, with a written tradeoff in
                     /docs/01a-architecture.md. Defaults if no strong reason
                     emerges: Python for the agent layer (LangGraph maturity,
                     richer ecosystem, better tracing integrations), TypeScript
                     Next.js for the frontend and BFF. Two-runtime split is
                     acceptable because the BFF talks to the Python agent
                     service over HTTP or a job queue.

OBSERVABILITY:       Two layers, both first-class:
                     1. In-app Agent Ops view: live graph visualization, per
                        decision audit trail, cost per run, quality scores,
                        human escalation queue, drift indicators, prompt
                        version A/B comparison. This is a USER-FACING product
                        feature, not a dev tool. The Ops Lead lives here.
                     2. Dev-facing observability via Braintrust: full traces,
                        eval-gated CI, regression detection, cost analytics.

AI POSTURE:          The product is the agent system. Every decision the system
                     makes is made by an AI agent in the graph. Use
                     ai-feature-spec for every agent in the graph before
                     building. Use prompt-engineer to write every system prompt.
                     Default model: claude-sonnet-4 for most agents.
                     For the Decision Agent specifically, evaluate claude-opus-4
                     in the eval suite and document the cost vs quality tradeoff
                     in the ai-feature-spec.

TARGET STACK HINT:   Let the architect decide, with these constraints:
                     - TypeScript Next.js (App Router) frontend and BFF.
                     - Python FastAPI for the agent service (default), exposing
                       graph runs and decision endpoints.
                     - LangGraph for the agent orchestration (default Python).
                     - Postgres for orders, returns, decisions, audit log,
                       eval cases, prompt versions, user overrides.
                     - Redis or a managed queue for graph job state.
                     - A WebSocket or SSE channel from the agent service to
                       the frontend, so the in-app Agent Ops view can render
                       graph execution in real time.
                     - Stripe in test mode for the refund worker. Everything
                       else is fixture or mock for v1.
                     - Tailwind plus an opinionated, dense design system. No
                       rounded-everything SaaS look.
                     - Auth: minimal. Single seeded admin user is fine for v1.

DEPLOY TARGET:       Vercel for the Next.js app. Render or Railway for the
                     Python agent service. Neon or Supabase for Postgres.
                     Upstash for Redis. Braintrust free tier for observability.
                     Sentry free tier for error monitoring.

SCOPE AND TIMEBOX:   This is a portfolio piece, not a startup. Target a
                     4 to 6 week build with Claude Code. Cut features
                     aggressively if you fall behind. The non-negotiables for
                     "done" are the success criteria below. Everything else
                     defers to v2.

SUCCESS CRITERIA (drives the "done" gate):
  1. Demo flow works end to end on fixture data: 12 returns load on the
     dashboard, "Run triage" fires the graph, the in-app Agent Ops view
     shows nodes activating in real time, decisions stream in across
     refund / replace / repair / refurbish / escalate, total cost displays
     under one cent per decision, escalation queue has at least one item
     for human review.
  2. Every agent in the graph has a written ai-feature-spec, a versioned
     prompt in /prompts/, a JSON output contract, a defensive parser, a
     fallback for model failure, and a fixture-based test that runs in CI
     without calling the live API.
  3. Eval suite of 50+ golden cases passes at 90%+ accuracy in CI. The eval
     suite is the source of truth for "the agent works." Hiring managers
     can read /evals/ and see exactly what was tested.
  4. The in-app Agent Ops view is genuinely visceral. Watching it for 60
     seconds tells a non-technical viewer what the product does and why
     it works. No explanation needed.
  5. The architecture is written up in /docs/ARCHITECTURE.md as the
     portfolio artifact. Decision log included (why LangGraph, why this
     graph shape, why these agents, why Braintrust, why single-tenant).
     This doc is what hiring managers will actually read.
  6. README is sharp: 90-second pitch up top, demo gif or loom link,
     architecture diagram, "why this is not NAVI/Loop/Fini" section,
     run-locally instructions, eval results, cost analytics.

NON-GOALS FOR V1 (log to BUILD_LEDGER as deferred, do not silently drop):
  - Multi-tenancy, RBAC, workspaces.
  - Real marketplace API connections. Fixtures only.
  - Real Stripe charges. Test mode only.
  - Image and video analysis of damage (Claimlane already does this; not
    the wedge).
  - SMS or email gateway integration. Drafts go to a queue, not actual sends.
  - Mobile app. Desktop-first operator tool.
  - White label or admin console for managing multiple users.
```

---

## 1. Operating Model

You are not one developer. You are a coordinated team. Adopt these role-skills in sequence and in parallel where the dependency graph allows.

```
stakeholder          Defines what done means, signs off at gates
product-owner        Translates the brief into specs and acceptance criteria
architect            Locks stack, framework choices, graph shape, runtime split
designer             Builds the dense operator-grade design system
data-schema-designer Designs the order / return / decision / audit / eval model
code-auditor         Audits at phase boundaries
frontend-dev         Builds the Next.js app and the in-app Agent Ops view
backend-dev          Builds the Python agent service, graph, workers, integrations
ai-feature-spec      Specs every agent in the graph before it gets built
prompt-engineer      Writes every system prompt, versions them
data-fixtures        Generates realistic fund data, holdings, return scenarios
qa-engineer          Verifies every checkpoint
devops-deploy        Vercel, Render, Postgres, Redis, Braintrust, Sentry
```

Read each `SKILL.md` before adopting that role. Roles are constraint sets, not personalities.

---

## 2. Hard Rules

1. **No phase exits without a written deliverable.** Markdown file in `/docs/`. Code without a doc does not count as done.
2. **Re-read before you proceed.** Open the prior phase's doc, state what is carried forward.
3. **Maintain `/docs/BUILD_LEDGER.md` from minute one.** `feature | status | spec link | tests | known gaps`. Status: `planned | in-progress | built | qa-passed | deferred`.
4. **Run gate commands before declaring any phase done.** Typecheck, lint, build, and tests must all pass. Both runtimes. Paste output.
5. **Acceptance criteria first, code second.** No code without a spec doc.
6. **One source of truth per concern.** Design tokens. API contracts. Agent registry. Marketplace policy registry. Decision taxonomy. Prompt registry.
7. **Parallelize across independent tracks only.** Never parallelize work that shares files or schema.
8. **Surface assumptions.** Log every gap-filling assumption to `/docs/ASSUMPTIONS.md`.
9. **Touching it means logging it.** Out-of-scope file edits go in the ledger.
10. **Failing means stopping.** Three failed gate-command attempts means stop, write `/docs/BLOCKERS.md`, propose a path.
11. **Agent rule.** Every agent in the graph has: an ai-feature-spec doc, a versioned prompt in `/prompts/`, a JSON output contract, a defensive parser, a fallback path for model failure, a cost estimate per call, a Braintrust span, and a fixture-based test in `/evals/` that runs in CI without calling the live API.
12. **Graph rule.** The graph topology lives in one file. Every node, every edge, every conditional, every checkpoint is declared there. No node added without updating the graph topology doc and the in-app visualization config.
13. **Decision rule.** Every decision the system produces records: which agent, which prompt version, which input, what reasoning, what confidence, what cost, what latency. The decision audit log is append-only.
14. **Override rule.** Every human override is captured into the eval dataset with a label. The eval suite grows over time from real user behavior.
15. **Marketplace policy rule.** Marketplace policies live in `/config/marketplaces/<name>.yaml` and nowhere else. The agents read policy from there. Adding a marketplace means adding a YAML file, not modifying agent code.
16. **Cost rule.** Every graph run logs total cost. The in-app Agent Ops view shows running cost per decision and aggregate cost per day. If a graph run exceeds $0.10 in v1, that is a bug, not a feature. Cheaper models for cheaper agents.

---

## 3. Phase Plan

### Phase 0. Discovery and Architecture Sketch
- **Roles:** stakeholder + code-auditor + architect (light).
- **Do:** Read the brief. Inventory every screen the app will need (dashboard, return detail, agent ops view, escalation queue, eval results, settings, audit log). Inventory every agent that will need to exist in the graph. Inventory every marketplace policy dimension that affects decisioning. Sketch the graph topology at a high level. Identify the hardest 3 decisions in the build.
- **Deliverable:** `/docs/00-discovery.md` containing screen inventory, agent inventory, graph topology sketch, marketplace policy dimensions, hard-decision list, risks.
- **Exit gate:** Stakeholder signs off.

### Phase 1. Architecture, Graph Design, Design System (parallel)
- **Roles:** architect, designer, data-schema-designer in parallel.
- **Tracks:**
  - **A — Architecture and graph topology:** Stack confirmed. Runtime split. Python vs TS for agents decided with reasoning logged. LangGraph topology fully designed: every node, every edge, every conditional, every parallel fan-out, every human-in-loop checkpoint. WebSocket or SSE protocol between agent service and frontend specified. Observability wiring to Braintrust specified. Env var schema. Gate commands. CI scaffold.
  - **B — Design system:** Operator-grade dense UI. Tokens, type, spacing, color, motion. Component primitives. Layout rules. Keyboard-first interaction patterns. The in-app Agent Ops view design is the centerpiece: graph node states, edge animations, decision drawer, override UI, cost meter, eval pass-fail indicator.
  - **C — Schema:** orders, order_lines, customers, returns, return_lines, decisions, decision_steps (one per graph node visited), audit_log (append-only), agent_runs, prompt_versions, eval_cases, eval_results, overrides, marketplace_configs (or filesystem), sku_catalog.
- **Deliverable:** `/docs/01a-architecture.md`, `/docs/01b-graph-topology.md`, `/docs/01c-design-system.md`, `/docs/01d-schema.md`. Tokens committed. Graph topology committed as a structured spec.
- **Exit gate:** Every agent identified in phase 0 has a node in the topology. Every screen has a design primitive. Every entity has a table.

### Phase 2. Scaffolding (parallel)
- **Roles:** frontend-dev + backend-dev + data-fixtures.
- **Tracks:**
  - **A — Frontend scaffold:** Next.js init, App Router, tokens wired, routing shell, layout shell, empty page stubs for every screen, WebSocket/SSE client wired, mock graph rendering with placeholder nodes.
  - **B — Agent service scaffold:** FastAPI (or Express if TS path chosen), LangGraph installed, graph topology loaded as data, empty agent stubs (one per node), Braintrust client wired, health endpoint, error handler, env loader. Single graph run end-to-end with all agents stubbed to return canned responses.
  - **C — Fixtures:** Generate all fixture data: 200+ orders, 50+ returns, SKU catalog, customer profiles, marketplace policy YAMLs, carrier rate sheet. Commit to `/fixtures/`.
- **Deliverable:** `/docs/02-scaffolding.md`. Working app with stubbed graph end to end.
- **Exit gate:** Gate commands pass on both runtimes. A stub graph run completes and renders in the in-app Agent Ops view. Fixtures load. Paste outputs.

### Phase 3. Agents and Decisioning (the hard part)
- **Roles:** product-owner first (sequential), then ai-feature-spec + prompt-engineer + backend-dev in parallel across agents that don't depend on each other.
- **Agents to build, in dependency order:**
  1. Intake Agent (parses incoming return request into structured form)
  2. Customer History Agent (pulls order history, LTV, prior return rate)
  3. SKU Profile Agent (pulls weight, freight class, refurb difficulty, current stock)
  4. Marketplace Policy Agent (reads applicable policy from config)
  5. Damage Signal Agent (parses any provided text or condition codes)
  6. Fraud Flag Agent (checks customer return rate, abuse patterns)
  7. Decision Agent (the headline agent: takes all upstream context, recommends disposition with reasoning and confidence)
  8. Refund Worker (Stripe test mode)
  9. Replacement Worker (inventory check plus fixture shipping booking)
  10. Repair Worker (schedules pickup, drafts work order)
  11. Refurb Worker (routes to refurb queue with grading)
  12. Donate/Dispose Worker (routes by region)
  13. Customer Comms Agent (drafts channel-appropriate message)
  14. Escalation Agent (when confidence below threshold or value above threshold)
  15. Audit Agent (writes the full decision record)
- **Process per agent:**
  1. product-owner writes `/docs/specs/agents/<name>.md` with input contract, output contract, acceptance criteria, edge cases.
  2. ai-feature-spec writes the AI contract: model, prompt structure, output schema, fallback, cost target.
  3. prompt-engineer writes the system prompt in `/prompts/<name>.md`, versioned.
  4. backend-dev implements the agent node in LangGraph.
  5. data-fixtures contributes test cases to `/evals/<name>/`.
  6. qa-engineer adds the agent's tests to CI, verifies golden cases pass.
- **Exit gate:** Every agent passes its evals. Full graph runs end to end on every fixture return. Decision Agent passes 90%+ on a 50-case golden set. Paste eval output.

### Phase 4. In-App Agent Ops View and Polish
- **Roles:** frontend-dev + designer + qa-engineer.
- **Do:** Build the in-app Agent Ops view to demo-quality: live graph visualization with node states (idle, running, complete, failed), edge animations as control flows, decision drawer showing full reasoning for any return, override UI that captures into eval dataset, cost meter (running total and per decision), eval status badge (X/Y golden cases passing), escalation queue with reasoning summaries, drift indicator (rolling window comparison), prompt version A/B comparison (last week vs this week). Empty, loading, error states everywhere. Keyboard navigation. Performance pass (graph viz must run smooth at 60fps with 20 nodes animating).
- **Deliverable:** `/docs/04-polish.md` with the polish checklist.
- **Exit gate:** Record a 90-second demo video. If the video does not make the product obvious to a non-technical viewer, the view is not done.

### Phase 5. Deploy and Portfolio Packaging
- **Role:** devops-deploy + you (the portfolio author).
- **Do:** Deploy Next.js to Vercel. Deploy agent service to Render or Railway. Postgres on Neon. Redis on Upstash. Braintrust account configured. Sentry configured. Custom domain pointed. Smoke test the full demo flow on prod. Write the `/README.md`: 90-second pitch, embed the demo video, architecture diagram (from `/docs/01b-graph-topology.md`), the "why this is not NAVI/Loop/Fini" section, run-locally instructions, eval results screenshot, cost analytics screenshot, decision log link.
  - **Stretch (only if time permits):** Real Stripe test-mode wire-up for refund worker. Toggle to swap one marketplace from fixture to real API.
- **Deliverable:** `/docs/05-deploy.md` runbook. Live URL. README that hiring managers can skim in 90 seconds.
- **Exit gate:** A hiring manager who has never seen the project before can open the README, watch the video, and within 90 seconds explain back what it does and why it's interesting. Test this on a real human before declaring done.

---

## 4. Parallelization Mechanics

Sub-agents via the task tool when tracks are independent. Each gets role, scope, deliverable, gate, non-overlap rule. Main thread is the integrator.

Never parallelize tracks that share files. Graph topology blocks every agent. Schema blocks the audit pipeline. Design tokens block the Agent Ops view.

The agent build in phase 3 has a real dependency graph: Decision Agent depends on Customer History, SKU Profile, Marketplace Policy, Damage Signal, and Fraud Flag agents. Build the upstream agents first, parallelize where the dependency graph allows.

---

## 5. Anti-Drift Checklist (run at every phase boundary)

1. Deliverable doc written? Path?
2. BUILD_LEDGER updated? Paste new rows.
3. Gate commands run? Both runtimes? Paste output.
4. Deferred items in the ledger with reasons?
5. Assumptions in `/docs/ASSUMPTIONS.md`?
6. Re-read discovery. Anything not accounted for?
7. Re-read prior phase doc. Commitments carried forward?
8. Every agent in this phase: spec doc, prompt file, JSON contract, fixture test, Braintrust span, cost target?
9. Every decision: append-only audit row with agent, prompt version, input, reasoning, confidence, cost, latency?
10. Graph topology doc still matches the actual graph?
11. In-app Agent Ops view still renders every graph node correctly?
12. Cost per graph run under $0.10?

If any answer is no, do not advance.

---

## 6. Tool and Resource Discipline

- Frontend: Vercel.
- Agent service: Render or Railway free tier.
- Postgres: Neon or Supabase.
- Redis: Upstash.
- Observability: Braintrust free tier.
- Monitoring: Sentry free tier.
- AI: Anthropic API. Default claude-sonnet-4. Evaluate claude-opus-4 for Decision Agent only.
- Stripe: test mode only.
- LangGraph: Python preferred. LangGraph.js if architect makes the case.
- Before adding any paid dependency, log to `/docs/COSTS.md` with projected monthly cost.

---

## 7. Communication Format

Every message back to me:

```
PHASE:        <current phase>
ROLE:         <which skill you are currently running>
TRACK:        <if parallel, which track>
ACTION:       <one-line summary>
ARTIFACT:     <file path>
LEDGER:       <one-line ledger update>
NEXT:         <next step>
GATE STATUS:  <pending | passed | failed>
```

Non-negotiable.

---

## 8. Starting Instruction

Begin with Phase 0. Read this entire brief. Produce `/docs/00-discovery.md`. Stop at the exit gate. Wait for my signoff before proceeding to Phase 1.

Do not skip ahead. Do not start coding. Do not start scaffolding.

Confirm you have read this entire prompt by replying with:
  (a) the phase plan summarized in your own words,
  (b) any skills referenced above that are missing from your environment,
  (c) the agents you understand the graph will contain,
  (d) the marketplaces you understand will be modeled in v1,
  (e) the runtime split you are leaning toward (Python agents + TS frontend vs full TS) and your one-paragraph reasoning, with the caveat that final architecture decisions land in phase 1,
  (f) the demo's hero moment in 90 seconds, in your own words. If you cannot make the hero moment land in 90 seconds in writing, the build will not land in 90 seconds either.

Then begin Phase 0.
