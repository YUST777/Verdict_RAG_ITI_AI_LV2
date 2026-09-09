import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes.query import router
from app.core.config import get_settings
from app.services.database import HistoryStore
from app.services.generation import Generator
from app.services.retrieval import Retriever

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
settings = get_settings()
app = FastAPI(title=settings.app_name, version=settings.app_version, description="Grounded competitive-programming RAG coach")
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origin_list or ["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(router, prefix="/api")
# Keep the documented root paths available for simple clients while retaining /api
# aliases for the frontend.
app.include_router(router)
app.state.settings = settings
app.state.retriever = Retriever(settings.chroma_persist_dir, settings.chroma_collection, settings.embedding_model)
app.state.generator = Generator(settings)
app.state.history = HistoryStore(settings)

@app.get("/", include_in_schema=False)
async def root():
    return {"service": settings.app_name, "docs": "/docs", "health": "/api/health"}
