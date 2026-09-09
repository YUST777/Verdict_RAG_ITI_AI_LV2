import logging
from typing import Any
from app.core.config import Settings

logger = logging.getLogger(__name__)

class HistoryStore:
    """Optional PostgreSQL/Supabase history writer. It never blocks query responses."""
    def __init__(self, settings: Settings):
        self.url = settings.database_url
        self._pool = None

    @property
    def configured(self) -> bool:
        return bool(self.url)

    async def record(self, question: str, answer: str, citations: list[dict[str, Any]], mode: str) -> None:
        if not self.url:
            return
        try:
            import asyncpg
            if self._pool is None:
                self._pool = await asyncpg.create_pool(self.url, min_size=1, max_size=3)
            async with self._pool.acquire() as conn:
                await conn.execute("""CREATE TABLE IF NOT EXISTS rag_query_history (id BIGSERIAL PRIMARY KEY, question TEXT NOT NULL, answer TEXT NOT NULL, citations JSONB NOT NULL DEFAULT '[]', mode TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())""")
                await conn.execute("INSERT INTO rag_query_history(question, answer, citations, mode) VALUES($1, $2, $3::jsonb, $4)", question, answer, __import__('json').dumps(citations), mode)
        except Exception as exc:
            logger.warning("History persistence skipped: %s", exc)

    async def record_documents(self, documents: list[dict[str, Any]]) -> None:
        """Persist a lightweight metadata catalog for reproducible ingestion runs."""
        if not self.url or not documents:
            return
        try:
            import asyncpg
            if self._pool is None:
                self._pool = await asyncpg.create_pool(self.url, min_size=1, max_size=3)
            async with self._pool.acquire() as conn:
                await conn.execute("""CREATE TABLE IF NOT EXISTS rag_documents (source_id TEXT PRIMARY KEY, title TEXT NOT NULL, source TEXT NOT NULL, chunk INTEGER, indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW())""")
                await conn.executemany("INSERT INTO rag_documents(source_id, title, source, chunk) VALUES($1, $2, $3, $4) ON CONFLICT (source_id) DO UPDATE SET title=EXCLUDED.title, source=EXCLUDED.source, chunk=EXCLUDED.chunk, indexed_at=NOW()", [(d["source_id"], d.get("title", "Untitled"), d.get("source", ""), d.get("chunk")) for d in documents])
        except Exception as exc:
            logger.warning("Document metadata persistence skipped: %s", exc)
