from typing import Any
from pydantic import BaseModel, Field

class QueryRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=20000)
    problem_statement: str | None = Field(default=None, max_length=50000)
    problem_id: str | None = Field(default=None, max_length=100)
    code: str | None = Field(default=None, max_length=50000)
    language: str | None = Field(default=None, max_length=30)
    mode: str = Field(default="explain", pattern="^(hint|teach|similar|debug|full|explain|quiz)$")
    top_k: int | None = Field(default=None, ge=1, le=20)

class Citation(BaseModel):
    id: str
    title: str
    source: str
    chunk: int | None = None
    score: float | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)

class QueryResponse(BaseModel):
    answer: str
    citations: list[Citation] = Field(default_factory=list)
    sources: list[str] = Field(default_factory=list)
    retrieved_context: list[dict[str, Any]] = Field(default_factory=list)
    model: str
    grounded: bool
    latency_ms: int

class HealthResponse(BaseModel):
    status: str
    chroma_ready: bool
    ollama_configured: bool
    database_configured: bool
    document_count: int
