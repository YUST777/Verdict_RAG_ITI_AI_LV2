import os
from typing import Any
import requests
from dotenv import load_dotenv

load_dotenv()

class RAGClient:
    def __init__(self, base_url: str | None = None, api_key: str | None = None):
        self.base_url = (base_url or os.getenv("API_BASE_URL") or "http://localhost:8000").rstrip("/")
        self.api_key = api_key or os.getenv("RAG_API_KEY")

    def _headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["x-rag-api-key"] = self.api_key
        return headers

    def check_health(self) -> dict[str, Any]:
        """Call GET /api/health to inspect backend and vector store status."""
        try:
            response = requests.get(f"{self.base_url}/api/health", headers=self._headers(), timeout=5)
            response.raise_for_status()
            return response.json()
        except Exception as exc:
            return {"status": "error", "error": str(exc), "document_count": 0}

    def query(
        self,
        question: str,
        mode: str = "teach",
        problem_statement: str | None = None,
        code: str | None = None,
        language: str | None = "cpp",
        top_k: int = 5,
    ) -> dict[str, Any]:
        """Call POST /api/query to retrieve grounded answer with citations."""
        payload = {
            "question": question,
            "mode": mode,
            "problem_statement": problem_statement or None,
            "code": code or None,
            "language": language,
            "top_k": top_k,
        }
        response = requests.post(
            f"{self.base_url}/api/query",
            json=payload,
            headers=self._headers(),
            timeout=180,
        )
        response.raise_for_status()
        return response.json()
