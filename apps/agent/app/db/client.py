"""
Postgres connection helpers.
Phase 2: connection is a stub. Phase 3 will wire asyncpg pool.
"""
from __future__ import annotations

from ..config import settings


class DatabaseClient:
    """Thin wrapper around asyncpg connection pool."""

    def __init__(self) -> None:
        self._pool = None

    @property
    def database_url(self) -> str:
        return settings.database_url

    async def connect(self) -> None:
        """Initialize the asyncpg connection pool."""
        # STUB: In Phase 3, initialize asyncpg pool
        # import asyncpg
        # self._pool = await asyncpg.create_pool(self.database_url)
        pass

    async def disconnect(self) -> None:
        """Close the asyncpg connection pool."""
        if self._pool is not None:
            await self._pool.close()
            self._pool = None

    async def fetch_one(self, query: str, *args) -> dict | None:
        """Execute a query and return a single row."""
        # STUB: Phase 3 implementation
        raise NotImplementedError("Database not connected in Phase 2 stub")

    async def fetch_all(self, query: str, *args) -> list[dict]:
        """Execute a query and return all rows."""
        # STUB: Phase 3 implementation
        raise NotImplementedError("Database not connected in Phase 2 stub")

    async def execute(self, query: str, *args) -> str:
        """Execute a write query."""
        # STUB: Phase 3 implementation
        raise NotImplementedError("Database not connected in Phase 2 stub")


# Module-level singleton
db = DatabaseClient()
