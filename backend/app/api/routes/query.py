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
        # Quiz generation is about the supplied problem/code, not a nearest
        # algorithm article. Avoid unrelated retrieval and citations entirely.
        query_text = ""
    elif payload.mode == "full" or payload.problem_statement:
        # The current corpus is algorithm notes, not a catalog of exact
        # Codeforces statements. Feeding nearest neighbours into a supplied
        # problem caused unrelated articles to replace easy problem solutions.
        # When the client supplies the statement, generation must be based on
        # that statement for every mode, not a nearest-neighbour article.
        query_text = ""
    else:
        query_text = "\n".join(x for x in [payload.question, payload.problem_statement or "", (payload.code or "")[:4000] if not payload.problem_statement else ""] if x)
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
    await history.record(payload.question, answer, [c.model_dump() for c in citations], payload.mode)
    return QueryResponse(answer=answer, citations=citations, retrieved_context=context, model=settings.ollama_model, grounded=bool(context), latency_ms=round((time.perf_counter() - started) * 1000))
