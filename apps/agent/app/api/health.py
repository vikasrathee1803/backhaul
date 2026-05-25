from datetime import datetime, timezone

from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health_check() -> dict:
    return {
        "status": "ok",
        "service": "backhaul-agent",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
