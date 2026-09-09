import logging
import httpx
from app.core.config import Settings

logger = logging.getLogger(__name__)

class Generator:
    def __init__(self, settings: Settings):
        self.settings = settings

    async def generate(self, question: str, context: list[dict], mode: str, problem_statement: str | None = None, code: str | None = None) -> str:
        source_text = "\n\n".join(f"[{i+1}] {x['metadata'].get('title', 'Source')}:\n{x['document']}" for i, x in enumerate(context))
        if not source_text:
            source_text = "No indexed source supports this question. State that limitation clearly and avoid invented citations."
        prompt = f"""You are Verdict, a competitive-programming tutor. Use only the supplied sources for factual claims. Never invent citations. If sources are insufficient, say so. Give a practical, correct response in {mode} mode. Include algorithm reasoning and complexity when relevant.\n\nPROBLEM:\n{problem_statement or '(not provided)'}\n\nCODE:\n{code or '(not provided)'}\n\nQUESTION:\n{question}\n\nSOURCES:\n{source_text}\n\nCite sources inline as [1], [2]."""
        try:
            async with httpx.AsyncClient(timeout=90) as client:
                response = await client.post(f"{self.settings.ollama_url.rstrip('/')}/api/generate", json={"model": self.settings.ollama_model, "prompt": prompt, "stream": False, "options": {"temperature": 0.2}})
                response.raise_for_status()
                return response.json().get("response", "").strip() or "The model returned an empty answer."
        except Exception as exc:
            logger.error("Ollama generation failed: %s", exc)
            return "Ollama is unavailable. Start the local Ollama service and try again."
