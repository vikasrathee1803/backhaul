# Assumptions Log — Backhaul

Every gap-filling assumption made during the build, logged per Hard Rule 8. Each carries an impact-if-wrong line so the cost of being wrong is visible before it bites. Revisit this list at every phase boundary (Anti-Drift Checklist item 5).

**Last updated:** 2026-05-25

---

## Runtime & Architecture

1. **Python LangGraph is the right choice for agent orchestration.**
   Assuming LangGraph Python (not LangGraph.js) because it has more mature streaming support, a richer ecosystem (LangSmith, Braintrust integrations), and better documentation.
   → Impact if wrong: migration to LangGraph.js in Phase 1 would cost ~1 week.

2. **SSE over WebSocket for graph event streaming.**
   Assuming SSE is sufficient for one-way server→client streaming of graph execution events to the Agent Ops view.
   → Impact if wrong: a bidirectional comms requirement discovered in Phase 4 would require a WebSocket retrofit.

3. **FastAPI is the right Python web framework.**
   Assuming FastAPI (async, auto-generated docs, pydantic validation) for the agent service.
   → Impact if wrong: negligible; framework swap is low-risk.

4. **Neon Postgres is sufficient for single-tenant demo scale.**
   Assuming the free tier handles 200+ orders, 50+ returns, and the eval dataset without performance issues.
   → Impact if wrong: upgrade to paid tier (~$19/mo).

## Data & Fixtures

5. **Fixture data is sufficient for 90%+ eval accuracy.**
   Assuming hand-crafted golden cases are representative enough to demonstrate 90%+ accuracy without real-world data.
   → Impact if wrong: lower-quality evals; require more cases or calibration.

6. **Freight cost estimation without a real carrier API.**
   Assuming carrier rate fixtures (per freight class + weight + zone) are accurate enough for the refurb/dispose decision.
   → Impact if wrong: decision quality degrades for borderline cases; a real API is needed for production.

7. **Five marketplaces cover the meaningful policy variation.**
   Assuming Wayfair + Amazon FBA + Amazon FBM + Houzz + Overstock + Direct Shopify cover the policy diversity needed to demonstrate the multi-channel wedge.
   → Impact if wrong: add more marketplace YAMLs in Phase 3+.

8. **Damage condition can be parsed from text.**
   Assuming the seller provides text descriptions of damage (e.g., "scratched corner, torn fabric") rather than structured codes. The Damage Signal Agent will parse this text.
   → Impact if wrong: need a structured intake form.

## Design & UX

9. **Dark theme is the default for an operator-grade feel.**
   Assuming a dark theme (OKLch color system from lineaiq-app) is appropriate for this ops tool. The portfolio site is light; lineaiq-app is dark. Backhaul defaults to dark, with a light theme toggle deferred to v2.
   → Impact if wrong: cosmetic; light theme support can be added in Phase 4.

10. **ReactFlow (@xyflow/react) is the right graph visualization library.**
    Assuming @xyflow/react handles the Agent Ops LangGraph visualization. This is proven in lineaiq-app for a similar DAG topology.
    → Impact if wrong: migrate to a D3 force graph; ~3 days of work.

11. **A 380px right detail panel is sufficient for decision reasoning display.**
    Assuming the decision drawer (agent reasoning, confidence, cost, override button) fits in a 380px right panel.
    → Impact if wrong: widen to 480px or use a full-screen modal.

18. **Accent hue is the lineaiq cyan-blue (`oklch(0.74 0.13 225)`), not the portfolio cobalt (#1D3FE3).**
    The brief named two design sources. On a dark operator canvas a luminous cyan reads as a clear action/live signal, where a saturated cobalt fights the dark background. The portfolio's *discipline* (minimal radius, no shadows on flat surfaces, restraint) is honored; its specific palette is not. All disposition/node/confidence/cost tokens derive from this accent + the semantic palette.
    → Impact if wrong: re-hue `--accent` (one token; OKLch lightness/contrast unaffected since only H changes) and the `--disposition-replace`/`--mp-shopify` derivations; ~1 hour.

## Scope

12. **A single seeded admin user is sufficient for the v1 demo.**
    Assuming no auth complexity; a hardcoded admin session is fine for a portfolio demo.
    → Impact if wrong: add Supabase Auth in Phase 2 (1–2 hours).

13. **Stripe test mode (no real charges) is sufficient.**
    Assuming test-mode Stripe webhooks are enough to demonstrate the refund flow.
    → Impact if wrong: not a risk; this is intentional per the v1 non-goals.

14. **Fifteen agents is the right decomposition.**
    Assuming the 15-agent graph covers all decision paths. Additional specialized agents (e.g., an Open Box pricing agent, a regional donation coordinator) are deferred to v2.
    → Impact if wrong: add agents as a Phase 3 extension; the graph is designed to be pluggable.

15. **Under $0.10 per full graph run is achievable.**
    Assuming claude-haiku-4-5 for the cheaper agents and claude-sonnet-4-6 for the Decision Agent keeps per-run cost under $0.10. claude-opus-4-7 is only evaluated for Decision Agent comparison.
    → Impact if wrong: redesign prompt sizes and model assignments.

## Schema (Phase 1C)

19. **Migration run-order may deviate from the brief's stated order for FK integrity.**
    The brief lists `customers → orders → order_lines → sku_catalog → …` and `… → decisions → …` before `prompt_versions`. `001_initial_schema.sql` moves `sku_catalog` before `orders`/`order_lines` (they FK it) and `prompt_versions` before `decisions` (it FKs it). The set of objects is identical; only ordering changed.
    → Impact if wrong: none — ordering is internal to a single transactional migration; the brief's logical grouping is preserved in `docs/01d-schema.md`.

20. **`eval_results.expected_disposition` is denormalized so `passed` can be a same-row STORED generated column.**
    Postgres `STORED GENERATED` columns may reference only same-row columns, but the brief defines `passed` against `eval_cases.expected_disposition`. The expected disposition is copied onto `eval_results` at insert (from the joined `eval_cases` row) so `passed = (actual_disposition = expected_disposition)` is valid PG.
    → Impact if wrong: low — the copy is write-once at insert; if eval-case expectations are ever edited after results exist, historical `passed` reflects the expectation at scoring time (arguably correct for an audit record).

## Observability

16. **The Braintrust free tier is sufficient for the eval suite.**
    Assuming the free tier handles 50+ golden cases plus per-run traces for a single demo.
    → Impact if wrong: $0/mo to start; upgrade if needed.

17. **The Sentry free tier error rate is sufficient.**
    Assuming under 5,000 errors/month in demo usage.
    → Impact if wrong: upgrade Sentry; negligible cost.
