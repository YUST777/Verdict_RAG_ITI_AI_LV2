import time
from fastapi import APIRouter, Header, HTTPException, Request
from app.schemas.query import Citation, HealthResponse, QueryRequest, QueryResponse

router = APIRouter()

@router.get("/health", response_model=HealthResponse)
async def health(request: Request):
    retriever, settings, history = request.app.state.retriever, request.app.state.settings, request.app.state.history
    return HealthResponse(status="ok", chroma_ready=retriever.ready, ollama_configured=bool(settings.ollama_url and settings.ollama_model), database_configured=history.configured, document_count=retriever.count())

@router.post("/query", response_model=QueryResponse)
async def query(payload: QueryRequest, request: Request, x_rag_api_key: str | None = Header(default=None)):
    started = time.perf_counter()
    retriever, generator, history, settings = request.app.state.retriever, request.app.state.generator, request.app.state.history, request.app.state.settings
    if getattr(settings, "rag_api_key", None) and x_rag_api_key != settings.rag_api_key:
        raise HTTPException(status_code=401, detail="Invalid RAG API key")
    # Quiz questions are grounded in the supplied problem/code themselves; a
    # generic "generate five questions" phrase should not retrieve unrelated
    # algorithm articles. Other modes use the problem and question first, with
    # a bounded code slice only when no statement is available.
    if payload.mode == "quiz":
        query_text = ""
    else:
        statement_summary = ""
        if payload.problem_statement:
            first_lines = [line.strip() for line in payload.problem_statement.splitlines() if line.strip()][:3]
            statement_summary = " ".join(first_lines)[:300]
        parts = [payload.question, statement_summary]
        if not payload.problem_statement and payload.code:
            parts.append((payload.code or "")[:500])
        query_text = " ".join(p for p in parts if p).strip()

    context = retriever.search(query_text, payload.top_k or settings.retrieval_k) if query_text.strip() else []
    answer = await generator.generate(
        payload.question,
        context,
        payload.mode,
        payload.problem_statement,
        payload.code,
        payload.problem_id,
        payload.language,
    )
    citations = [Citation(id=x["id"], title=x["metadata"].get("title", "Untitled source"), source=x["metadata"].get("source_url", x["metadata"].get("source", x["metadata"].get("path", "indexed document"))), chunk=x["metadata"].get("chunk"), score=x.get("score"), metadata=x["metadata"]) for x in context]
    sources = [c.source for c in citations]
    await history.record(payload.question, answer, [c.model_dump() for c in citations], payload.mode)
    return QueryResponse(answer=answer, citations=citations, sources=sources, retrieved_context=context, model=settings.ollama_model, grounded=bool(context), latency_ms=round((time.perf_counter() - started) * 1000))

