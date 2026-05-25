import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.health import router as health_router
from .api.runs import router as runs_router
from .api.stream import router as stream_router
from .config import settings

if settings.sentry_dsn:
    sentry_sdk.init(dsn=settings.sentry_dsn, environment=settings.environment)

app = FastAPI(title="Backhaul Agent Service", version="0.1.0")

_ORIGINS = [
    "http://localhost:3000",
    "https://backhaul.vercel.app",
]
if settings.allowed_origins:
    _ORIGINS.extend(settings.allowed_origins.split(","))

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Agent-Secret"],
)

app.include_router(health_router)
app.include_router(runs_router)
app.include_router(stream_router)


@app.get("/")
async def root() -> dict:
    return {"service": "backhaul-agent", "version": "0.1.0"}
