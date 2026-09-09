import logging
import httpx
from app.core.config import Settings

logger = logging.getLogger(__name__)

class Generator:
    def __init__(self, settings: Settings):
        self.settings = settings

    @staticmethod
    def _clip(value: str, limit: int) -> str:
        """Keep prompts inside the small model's context window."""
        value = value or ""
        return value if len(value) <= limit else value[:limit] + "\n[truncated]"

    async def generate(self, question: str, context: list[dict], mode: str, problem_statement: str | None = None, code: str | None = None) -> str:
        source_text = "\n\n".join(
            f"[{i+1}] {x['metadata'].get('title', 'Source')}:\n{self._clip(x['document'], 700)}"
            for i, x in enumerate(context[:3])
        )
        source_text = self._clip(source_text, 2200)
        if not source_text:
            source_text = "No indexed source supports this question. State that limitation clearly and avoid invented citations."
        if mode == "quiz":
            task = "Return ONLY a JSON array of exactly five objects with keys q, type, line, and difficulty. Questions must test the supplied problem and code, progress from easy to hard, and use real 1-based code line numbers when possible. Do not include markdown or commentary."
        else:
            task = f"Give a practical, correct response in {mode} mode. Include algorithm reasoning and complexity when relevant."
        prompt = f"""You are Verdict, a competitive-programming tutor. Use only the supplied sources for factual claims. Never invent citations. If sources are insufficient, say so. {task}\n\nPROBLEM:\n{self._clip(problem_statement or '(not provided)', 1800)}\n\nCODE:\n{self._clip(code or '(not provided)', 900)}\n\nQUESTION:\n{self._clip(question, 500)}\n\nSOURCES:\n{source_text}\n\nCite sources inline as [1], [2]."""
        try:
            async with httpx.AsyncClient(timeout=self.settings.ollama_timeout_seconds) as client:
                response = await client.post(
                    f"{self.settings.ollama_url.rstrip('/')}/api/generate",
                    json={
                        "model": self.settings.ollama_model,
                        "prompt": prompt,
                        "stream": False,
                        "options": {
                            "temperature": 0.2,
                            "num_predict": self.settings.ollama_num_predict,
                            "num_ctx": self.settings.ollama_num_ctx,
                            "num_thread": self.settings.ollama_num_thread,
                        },
                    },
                )
                response.raise_for_status()
                return response.json().get("response", "").strip() or "The model returned an empty answer."
        except Exception as exc:
            logger.error("Ollama generation failed: %s", exc)
            if mode == "quiz":
                return self._quiz_fallback(code, problem_statement)
            if context:
                # Keep the demo useful when Ollama is not installed: retrieval is
                # still real, so expose a short grounded excerpt instead of a
                # blank chat response. The UI can show the same citations below it.
                excerpts = []
                for index, item in enumerate(context[:3], start=1):
                    excerpt = " ".join(item.get("document", "").split())[:420]
                    title = item.get("metadata", {}).get("title", "source")
                    excerpts.append(f"[{index}] {title}: {excerpt}")
                return (
                    "Ollama is unavailable, so here is the retrieved guidance "
                    "without a generated explanation:\n\n"
                    + "\n\n".join(excerpts)
                )
            return "Ollama is unavailable and no indexed source matched this question. Start Ollama and try again."

    @staticmethod
    def _quiz_fallback(code: str | None, problem_statement: str | None) -> str:
        """Keep the quiz UI usable when the local model is still loading."""
        lines = [line.strip() for line in (code or "").splitlines() if line.strip()]
        line_numbers = [min(index + 1, len(lines)) for index in (0, max(0, len(lines) // 2), max(0, len(lines) - 1))] if lines else [1]
        questions = [
            {"q": "What is the main goal of this program?", "type": "general", "line": line_numbers[0], "difficulty": "easy"},
            {"q": "What does the input parsing establish before the main computation?", "type": "line_explain", "line": line_numbers[0], "difficulty": "easy"},
            {"q": "Which condition makes the program accept or reject the candidate answer?", "type": "logic", "line": line_numbers[min(1, len(line_numbers) - 1)], "difficulty": "medium"},
            {"q": "What edge case could break this implementation, and how would you test it?", "type": "edge_case", "line": line_numbers[min(1, len(line_numbers) - 1)], "difficulty": "medium"},
            {"q": "What is the time complexity and why does it satisfy the problem limits?", "type": "complexity", "line": line_numbers[-1], "difficulty": "hard"},
        ]
        import json
        return json.dumps(questions)
