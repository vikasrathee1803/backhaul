import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..graph.state import BackhaulState
from ..graph.topology import graph

router = APIRouter()


class RunRequest(BaseModel):
    return_ids: list[str]
    trigger: str = "manual"


class RunResponse(BaseModel):
    run_id: str
    status: str
    return_count: int


@router.post("/graph/run", response_model=RunResponse)
async def start_graph_run(req: RunRequest) -> RunResponse:
    if not req.return_ids:
        raise HTTPException(status_code=400, detail="return_ids cannot be empty")

    run_id = str(uuid.uuid4())
    # Phase 2 stub: run only the first return synchronously
    initial_state: BackhaulState = {
        "run_id": run_id,
        "return_id": req.return_ids[0],
        "marketplace": "wayfair",
        "raw_return_text": "Stub return text for Phase 2 testing.",
        "intake": None,
        "customer_history": None,
        "sku_profile": None,
        "marketplace_policy": None,
        "damage_signal": None,
        "fraud_flags": None,
        "decision": None,
        "worker_result": None,
        "comms_draft": None,
        "audit_written": False,
        "escalation_reason": None,
        "human_override": None,
        "errors": {},
        "events": [],
        "total_cost_usd": 0.0,
        "started_at": datetime.now(timezone.utc).isoformat(),
    }
    config = {"configurable": {"thread_id": run_id}}
    await graph.ainvoke(initial_state, config=config)
    return RunResponse(run_id=run_id, status="completed", return_count=len(req.return_ids))
