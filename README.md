# Verdict RAG — ITI AI LV2

Verdict RAG is a focused competitive-programming tutor built on the polished Verdict mirror interface. Paste a Codeforces URL, open a local mirror with the original editor and test cases, then ask the tutor for a hint, explanation, or debugging help grounded in a small indexed algorithms corpus.

The UI is intentionally the Verdict workspace rather than a Gradio demo: it gives the RAG system a realistic product surface while keeping the retrieval pipeline and evaluation easy to inspect.

## What is included

- Next.js mirror UI with contest, problemset, gym, group, and ACM SGURU URL parsing.
- Anonymous local mode: no login page, auth redirect, or account is required. Editor code, tests, and chat history use browser storage.
- FastAPI `/health` and `/query` endpoints.
- Chroma persistent vector store with a bundled local ONNX embedding function.
- Ollama generation with grounded prompts and inline citations.
- A 105-document algorithm corpus: five focused local notes plus 100 pages from [cp-algorithms](https://cp-algorithms.com/), with public source URLs preserved in citations.
- Twelve labeled retrieval questions plus a Hit@k evaluation script.
- Optional Supabase/PostgreSQL query-history storage. The app still works when the database is not configured.

## Run locally

### 1. Frontend

```bash
npm install
npm run dev
```

Open [http://localhost:3002](http://localhost:3002).

### 2. RAG API

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m scripts.ingest --input data/knowledge
.venv/bin/uvicorn app.main:app --reload --port 8000
```

The first ingestion downloads Chroma's small embedding model. Later runs use the persisted store in `backend/data/chroma/`.

The expanded `backend/data/knowledge/cp_algorithms/` corpus is derived from the cp-algorithms repository and its CC BY-SA 4.0 license. Each document keeps its original article URL in the `Source:` line so answers can be audited.

Optional local generation requires [Ollama](https://ollama.com/) and the configured model (default `llama3.2:3b`):

```bash
ollama pull llama3.2:3b
```

The graduation brief requires a local Ollama generation path; it does not name a required model and does not mention Gemini. `OLLAMA_TIMEOUT_SECONDS` (default `15`) bounds the wait when a remote deployment has not finished loading its model, after which the API returns the retrieved, cited evidence.

Set `RAG_API_URL` if the FastAPI service runs somewhere other than `http://localhost:8000`.

## Evaluate retrieval

After ingestion:

```bash
cd backend
.venv/bin/python -m scripts.evaluate_retrieval --persist-dir data/chroma --k 3
```

The command prints one hit/miss per labeled question and the aggregate Hit@3. Use the misses for failure analysis: add or split a source document, adjust chunk size/overlap, or refine the question wording, then rerun the evaluation.

## Database configuration

Copy `.env.example` to `.env` and set `DATABASE_URL` only when query history is needed. Percent-encode special characters in a password (for example `@` becomes `%40`). `.env` is ignored by Git and must never be committed.

## Project map

- `src/app/page.tsx` — launcher and Codeforces mirror entry point.
- `src/app/contest/` and `src/components/mirror/` — stripped Verdict workspace UI.
- `src/app/api/ai/chat/route.ts` — compatibility adapter used by the workspace chat panel.
- `src/app/api/rag/query/route.ts` — same-origin bridge to FastAPI.
- `backend/app/` — API, retrieval, generation, and optional history services.
- `backend/data/knowledge/` — indexed corpus.
- `backend/evaluation/questions.json` — labeled retrieval test set.
- `notebooks/rag_pipeline.ipynb` — walkthrough of loading, chunking, embedding, retrieval, generation, and evaluation.

## Verification

```bash
npm run build
cd backend && .venv/bin/python -m pytest -q
```

The frontend remains usable without Ollama; the API returns a clear unavailable message until a local model is running.
