from functools import lru_cache
from pathlib import Path
try:
    from pydantic_settings import BaseSettings, SettingsConfigDict
except ImportError:  # allows lightweight API tests before optional requirements are installed
    import os
    from pydantic import BaseModel, ConfigDict
    class BaseSettings(BaseModel):
        model_config = ConfigDict(extra="ignore")
        def __init__(self, **values):
            fields = self.__class__.model_fields
            for name in fields:
                env_name = name.upper()
                if name not in values and os.getenv(env_name) is not None:
                    values[name] = os.getenv(env_name)
            super().__init__(**values)
    def SettingsConfigDict(**kwargs):
        return kwargs

BASE_DIR = Path(__file__).resolve().parents[2]

class Settings(BaseSettings):
    app_name: str = "Verdict RAG API"
    app_version: str = "1.0.0"
    environment: str = "development"
    host: str = "0.0.0.0"
    port: int = 8000
    chroma_persist_dir: str = str(BASE_DIR / "data" / "chroma")
    chroma_collection: str = "verdict_knowledge"
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    ollama_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2:3b"
    ollama_timeout_seconds: float = 15.0
    ollama_num_predict: int = 384
    # Keep the small Railway Ollama container under its 1 GB memory limit.
    # Larger contexts make the KV cache consume the remaining memory after
    # Chroma and the 135M model are loaded.
    ollama_num_ctx: int = 1024
    retrieval_k: int = 5
    retrieval_min_score: float = 0.0
    database_url: str | None = None
    cors_origins: str = "*"
    model_config = SettingsConfigDict(env_file=(".env", "../.env"), env_file_encoding="utf-8", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [x.strip() for x in self.cors_origins.split(",") if x.strip()]

@lru_cache
def get_settings() -> Settings:
    return Settings()
