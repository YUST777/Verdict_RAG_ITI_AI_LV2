import time
from fastapi import APIRouter, Request
from app.schemas.query import Citation, HealthResponse, QueryRequest, QueryResponse

router = APIRouter()

@router.get("/health", response_model=HealthResponse)
async def health(request: Request):
    retriever, settings, history = request.app.state.retriever, request.app.state.settings, request.app.state.history
    return HealthResponse(status="ok", chroma_ready=retriever.ready, ollama_configured=bool(settings.ollama_url and settings.ollama_model), database_configured=history.configured, document_count=retriever.count())

@router.post("/query", response_model=QueryResponse)
async def query(payload: QueryRequest, request: Request):
    started = time.perf_counter()
    retriever, generator, history, settings = request.app.state.retriever, request.app.state.generator, request.app.state.history, request.app.state.settings
    query_text = "\n".join(x for x in [payload.question, payload.problem_statement or "", payload.code or ""] if x)
    context = retriever.search(query_text, payload.top_k or settings.retrieval_k)
    answer = await generator.generate(payload.question, context, payload.mode, payload.problem_statement, payload.code)
    citations = [Citation(id=x["id"], title=x["metadata"].get("title", "Untitled source"), source=x["metadata"].get("source", x["metadata"].get("path", "indexed document")), chunk=x["metadata"].get("chunk"), score=x.get("score"), metadata=x["metadata"]) for x in context]
    await history.record(payload.question, answer, [c.model_dump() for c in citations], payload.mode)
    return QueryResponse(answer=answer, citations=citations, retrieved_context=context, model=settings.ollama_model, grounded=bool(context), latency_ms=round((time.perf_counter() - started) * 1000))
