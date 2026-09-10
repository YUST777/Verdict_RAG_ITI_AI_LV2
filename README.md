# Verdict RAG — ITI AI LV2 Graduation Project

A grounded competitive-programming and algorithms tutor powered by Retrieval-Augmented Generation (RAG). Built for the **ITI AI Level 2 Summer Training Graduation Project ("RAG-Powered Document Assistant")**.

Verdict RAG indexes algorithmic documents into a persistent Chroma vector database, performs semantic retrieval, grounds user queries with inline citations, and generates verified code solutions using a local LLM.

---

## 🌟 Features & Dual Frontend Architecture

1. **Streamlit UI (`frontend/app.py`)**:
   - Built to strictly fulfill **Phase 4** of the ITI Project Specification.
   - Features pre-loaded problem templates (including **"A. Say Hello With C++"** and **"Watermelon"**).
   - Mode toggles: `teach`, `hint`, `full` solution, `debug`, and `explain`.
   - Real-time display of answer, latency, model used, and expandable cited sources with similarity scores and URLs.

2. **Verdict Mirror IDE (`src/app/`, Next.js 16)**:
   - Polished Monaco editor workspace with Codeforces problem parsing.
   - Grounded AI panel embedded next to the problem statement and test cases.

3. **FastAPI Backend (`backend/app/`)**:
   - `GET /health`: Health status, Chroma readiness, LLM connectivity, and document count.
   - `POST /query`: Semantic retrieval with Chroma, grounded prompt composition, citation generation, and history tracking.
   - Fully compliant with ITI schema: returns `{answer: str, sources: list[str], citations: list[Citation], grounded: bool}`.

4. **106 Indexed Knowledge Documents**:
   - Curated core CP notes: C++ basic I/O & strings, binary search, two pointers, prefix sums, graph traversals, and dynamic programming.
   - 100 algorithmic deep-dives from [cp-algorithms.com](https://cp-algorithms.com/) with public article URLs preserved.

---

## 🏗️ Architecture

```
[ User Query / Problem Statement ]
               │
               ▼
   [ Streamlit / Next.js UI ]
               │
               ▼  POST /api/query
    [ FastAPI Backend (Port 8000) ]
       │                      │
       ▼                      ▼
 [ Chroma Vector Store ]   [ Local LLM Service ]
 (all-MiniLM-L6-v2 ONNX)   (Ollama / llama.cpp Qwen2.5-Coder)
       │                      │
       └──────────┬───────────┘
                  ▼
   [ Grounded Answer with Citations ]
```

---

## 🚀 Quickstart & Setup

### Prerequisites
- Python 3.10+
- Node.js 18+ (if running the Next.js mirror)
- Docker (for the local GPU model container) or Ollama on host

---

### Step 1. Backend Setup & Ingestion

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Ingest all knowledge documents into Chroma vector store
python -m scripts.ingest --input data/knowledge

# Launch FastAPI server
uvicorn app.main:app --reload --port 8000
```

Verify backend health:
```bash
curl http://localhost:8000/api/health
```
Expected output:
```json
{"status":"ok","chroma_ready":true,"ollama_configured":true,"database_configured":false,"document_count":2128}
```

---

### Step 2. Run the Streamlit Frontend (Phase 4 Deliverable)

In a new terminal:
```bash
cd frontend
# Uses the backend venv or your active environment
../backend/.venv/bin/streamlit run app.py --server.port 8501
```
Open **[http://localhost:8501](http://localhost:8501)** in your browser.

---

### Step 3. Run the Next.js Mirror Interface (Optional)

```bash
npm install
npm run dev
```
Open **[http://localhost:3002](http://localhost:3002)**.

---

## 🧪 Demo: Solving "A. Say Hello With C++"

Send a test request directly to the API:

```bash
curl -X POST http://localhost:8000/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Solve this problem in C++ and explain how standard input and output works.",
    "problem_statement": "A. Say Hello With C++\nGiven a name S. Print \"Hello, (name)\" without parentheses.\n\nInput\nOnly one line containing a string S.\n\nOutput\nPrint \"Hello, \" without quotes, then print name.\n\nExample\nInput\nprogrammer\nOutput\nHello, programmer",
    "mode": "full",
    "language": "cpp"
  }'
```

### Generated Solution:
```cpp
#include <iostream>
#include <string>

int main() {
    std::string name;
    std::cin >> name;
    std::cout << "Hello, " << name << std::endl;
    return 0;
}
```
**Cited Source:** `https://codeforces.com/blog/entry/73285` (`cpp_basics_io.md`).

---

## 📊 Retrieval Evaluation (Phase 2.6)

Run the automated evaluation benchmark:
```bash
cd backend
.venv/bin/python -m scripts.evaluate_retrieval --persist-dir data/chroma --k 3
```

### Results Table:

| Question ID | Topic | Expected Source | Top Retrieved Sources | Result |
|---|---|---|---|---|
| `bs-1` | Monotonic Time Feasibility | `binary_search` | `binary_search`, `segment_tree` | **HIT** ✅ |
| `bs-2` | Maximize Minimum Distance | `binary_search` | `binary_search`, `knuth-optimization` | **HIT** ✅ |
| `prefix-1` | Static Subarray Sum Queries | `prefix_sums` | `prefix_sums`, `segment_tree` | **HIT** ✅ |
| `prefix-2` | Offline Range Additions | `prefix_sums` | `prefix_sums`, `fenwick` | **HIT** ✅ |
| `tp-1` | Opposing Target Sum Search | `two_pointers` | `two_pointers`, `sqrt_decomposition` | **HIT** ✅ |
| `tp-2` | Longest Nonnegative Window | `two_pointers` | `two_pointers`, `segment_tree` | **HIT** ✅ |
| `graph-1` | Unweighted Shortest Path | `graph` | `graph__breadth-first-search`, `01_bfs` | **HIT** ✅ |
| `graph-2` | Grid Connected Components | `graph` | `graph__search-for-connected-components` | **HIT** ✅ |
| `dp-1` | 0/1 Knapsack Optimization | `dynamic_programming` | `dynamic_programming__knapsack` | **HIT** ✅ |
| `dp-2` | Longest Increasing Subsequence | `dynamic_programming` | `dynamic_programming__longest_increasing_subsequence` | **HIT** ✅ |
| `cpp-1` | C++ Standard I/O Formatted String | `cpp_basics_io` | `cpp_basics_io`, `big-integer` | **HIT** ✅ |
| `ood-1` | Football Match (Out-of-Domain) | *None (Abstain)* | `breadth-first-search`, `2SAT` | **OOD Correct** (Miss) |
| `ood-2` | Medical Advice (Out-of-Domain) | *None (Abstain)* | `min_cost_flow`, `sparse-table` | **OOD Correct** (Miss) |

**Overall Retrieval Accuracy (Hit@3): 11/11 (100.0%)**

---

## 🔍 Failure Analysis & Mitigations

1. **Domain Over-matching on Large Problem Statements**:
   - *Problem*: Passing an entire 2,000-word problem statement into vector search caused Chroma to match complex algorithms (e.g. Max Flow, Heavy-Light Decomposition) due to incidental vocabulary overlaps.
   - *Mitigation*: Extracted problem title and header lines to form a concise domain summary, combining it with the user question. This keeps vector search focused on relevant techniques.

2. **Jupyter Event Loop Collisions in Notebooks**:
   - *Problem*: Calling `asyncio.run()` inside IPython cells fails with `RuntimeError: cannot be called from a running event loop`.
   - *Mitigation*: Used `nest_asyncio` and top-level `await` so `notebooks/rag_pipeline.ipynb` runs top-to-bottom without errors.

3. **Small-Model Solution Filtering**:
   - *Problem*: Small local models occasionally emit repetitive sentences or omit fences on simple tasks.
   - *Mitigation*: Implemented a validation filter in `Generator._usable_full_solution()` that inspects code blocks, checks entry points (`main`), and rejects degenerative repetitions.

---

## ⚙️ Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PORT` | FastAPI listener port | `8000` |
| `OLLAMA_URL` | Endpoint for Ollama or llama.cpp OpenAI server | `http://172.23.0.2:8080` (Docker GPU) / `http://localhost:11434` |
| `OLLAMA_MODEL` | LLM model identifier | `qwen2.5-coder:3b-q3-cuda` / `llama3.2:3b` |
| `MODEL_API_STYLE` | API format (`ollama` or `llama` for OpenAI completions) | `llama` |
| `CHROMA_PERSIST_DIR` | Directory containing persisted vector store | `data/chroma` |
| `CHROMA_COLLECTION` | Chroma collection name | `verdict_knowledge` |
| `RETRIEVAL_K` | Number of context chunks retrieved | `5` |
| `DATABASE_URL` | Optional PostgreSQL/Supabase query history database | `None` |
| `RAG_API_URL` | Backend URL used by frontend bridges | `http://localhost:8000` |

---

## 🧪 Automated Testing

Run the full pytest test suite:
```bash
cd backend
.venv/bin/python -m pytest -v
```
All 6 unit and contract tests pass (including `/health`, happy-path query, and 422 schema validation).
