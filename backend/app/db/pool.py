"""asyncpg connection pool for raw SQL / bulk operations.

PostgREST is still the primary CRUD layer (via `supabase_client`). This pool is
reserved for things that don't fit REST well: bulk row inserts, large scans,
column-typed reads that feed the report engine.
"""

import logging

import asyncpg

from app.config import settings

logger = logging.getLogger(__name__)

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        dsn = settings.database_url
        logger.info("Creating asyncpg pool to %s", dsn.split("@")[-1])
        _pool = await asyncpg.create_pool(dsn, min_size=1, max_size=10)
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
