import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

class Retriever:
    """Lazy Chroma retriever; startup remains healthy when no index exists."""
    def __init__(self, persist_dir: str, collection_name: str, embedding_model: str):
        self.persist_dir, self.collection_name, self.embedding_model_name = persist_dir, collection_name, embedding_model
        self._collection = None
        self._chroma = None
        self._embedder = None
        self.error: str | None = None

    def _ensure(self) -> bool:
        if self._collection is not None:
            return True
        try:
            import chromadb
            from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction
            Path(self.persist_dir).mkdir(parents=True, exist_ok=True)
            self._chroma = chromadb.PersistentClient(path=self.persist_dir)
            self._embedder = SentenceTransformerEmbeddingFunction(model_name=self.embedding_model_name)
            self._collection = self._chroma.get_or_create_collection(self.collection_name, embedding_function=self._embedder, metadata={"hnsw:space": "cosine"})
            self.error = None
            return True
        except Exception as exc:  # optional dependencies or model download may be unavailable
            self.error = str(exc)
            logger.warning("Chroma unavailable: %s", exc)
            return False

    @property
    def ready(self) -> bool:
        return self._ensure()

    def count(self) -> int:
        return int(self._collection.count()) if self._ensure() else 0

    def add(self, documents: list[str], ids: list[str], metadatas: list[dict[str, Any]]) -> int:
        if not documents or not self._ensure():
            return 0
        self._collection.upsert(documents=documents, ids=ids, metadatas=metadatas)
        return len(documents)

    def search(self, query: str, k: int = 5) -> list[dict[str, Any]]:
        if not query.strip() or not self._ensure() or self.count() == 0:
            return []
        result = self._collection.query(query_texts=[query], n_results=k, include=["documents", "metadatas", "distances"])
        docs, metas = result.get("documents", [[]])[0], result.get("metadatas", [[]])[0]
        distances = result.get("distances", [[]])[0]
        items = []
        for idx, doc in enumerate(docs):
            metadata = metas[idx] or {}
            items.append({"id": metadata.get("source_id", f"doc-{idx}"), "document": doc, "metadata": metadata, "distance": distances[idx] if idx < len(distances) else None, "score": 1 - distances[idx] if idx < len(distances) else None})
        return items
