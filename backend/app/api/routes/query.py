import time
from fastapi import APIRouter, Request
from app.schemas.query import Citation, HealthResponse, QueryRequest, QueryResponse
from app.services.known_solutions import known_answer

router = APIRouter()

@router.get("/health", response_model=HealthResponse)
async def health(request: Request):
    retriever, settings, history = request.app.state.retriever, request.app.state.settings, request.app.state.history
    return HealthResponse(status="ok", chroma_ready=retriever.ready, ollama_configured=bool(settings.ollama_url and settings.ollama_model), database_configured=history.configured, document_count=retriever.count())

@router.post("/query", response_model=QueryResponse)
async def query(payload: QueryRequest, request: Request):
    started = time.perf_counter()
    retriever, generator, history, settings = request.app.state.retriever, request.app.state.generator, request.app.state.history, request.app.state.settings
    deterministic_answer = known_answer(payload.problem_id, payload.problem_statement, payload.language)
    if deterministic_answer and payload.mode != "quiz":
        # Exact, deterministic solutions must not be diluted with unrelated
        # nearest-neighbour articles from the general algorithm corpus.
        await history.record(payload.question, deterministic_answer, [], payload.mode)
        return QueryResponse(
            answer=deterministic_answer,
            citations=[],
            retrieved_context=[],
            model="deterministic",
            grounded=True,
            latency_ms=round((time.perf_counter() - started) * 1000),
            verified=True,
        )

    # Quiz questions are grounded in the supplied problem/code themselves; a
    # generic "generate five questions" phrase should not retrieve unrelated
    # algorithm articles. Other modes use the problem and question first, with
    # a bounded code slice only when no statement is available.
    if payload.mode == "quiz":
        # Quiz generation is about the supplied problem/code, not a nearest
        # algorithm article. Avoid unrelated retrieval and citations entirely.
        query_text = ""
    else:
        query_text = "\n".join(x for x in [payload.question, payload.problem_statement or "", (payload.code or "")[:4000] if not payload.problem_statement else ""] if x)
    context = retriever.search(query_text, payload.top_k or settings.retrieval_k) if query_text.strip() else []
    answer = await generator.generate(payload.question, context, payload.mode, payload.problem_statement, payload.code)
    citations = [Citation(id=x["id"], title=x["metadata"].get("title", "Untitled source"), source=x["metadata"].get("source_url", x["metadata"].get("source", x["metadata"].get("path", "indexed document"))), chunk=x["metadata"].get("chunk"), score=x.get("score"), metadata=x["metadata"]) for x in context]
    await history.record(payload.question, answer, [c.model_dump() for c in citations], payload.mode)
    return QueryResponse(answer=answer, citations=citations, retrieved_context=context, model=settings.ollama_model, grounded=bool(context), latency_ms=round((time.perf_counter() - started) * 1000))
