#!/bin/sh
set -eu

# Railway supplies PORT at runtime.  Keep the local default useful when the
# same image is run with `docker run`.
PORT="${PORT:-8000}"
OLLAMA_URL="${OLLAMA_URL:-http://127.0.0.1:11434}"
OLLAMA_MODEL="${OLLAMA_MODEL:-llama3.2:3b}"
OLLAMA_MODELS="${OLLAMA_MODELS:-/root/.ollama/models}"
OLLAMA_STARTUP_TIMEOUT="${OLLAMA_STARTUP_TIMEOUT:-120}"
CHROMA_PERSIST_DIR="${CHROMA_PERSIST_DIR:-/app/data/chroma}"
export OLLAMA_URL OLLAMA_MODEL OLLAMA_MODELS CHROMA_PERSIST_DIR

is_local_ollama() {
    case "$OLLAMA_URL" in
        http://localhost:*|https://localhost:*|http://127.*|https://127.*|http://0.0.0.0:*|https://0.0.0.0:*|http://[::1]*|https://[::1]*) return 0 ;;
        *) return 1 ;;
    esac
}

start_local_ollama() {
    echo "Starting Ollama at ${OLLAMA_URL}"
    mkdir -p "$OLLAMA_MODELS"
    # OLLAMA_HOST controls the listener used by `ollama serve`; callers can
    # override it for local Docker development, while Railway defaults to the
    # loopback interface because FastAPI shares this container.
    OLLAMA_HOST="${OLLAMA_HOST:-127.0.0.1:11434}"
    export OLLAMA_HOST
    ollama serve > /tmp/ollama.log 2>&1 &

    ready=0
    attempt=1
    while [ "$attempt" -le "$OLLAMA_STARTUP_TIMEOUT" ]; do
        if curl -fsS "${OLLAMA_URL%/}/api/tags" >/dev/null 2>&1; then
            ready=1
            break
        fi
        sleep 1
        attempt=$((attempt + 1))
    done

    if [ "$ready" -ne 1 ]; then
        echo "Warning: Ollama did not become ready within ${OLLAMA_STARTUP_TIMEOUT}s."
        cat /tmp/ollama.log || true
        if [ "${OLLAMA_REQUIRED:-0}" = "1" ]; then
            exit 1
        fi
        return 0
    fi

    # Model files are stored in /root/.ollama by default.  A Railway volume
    # mounted there prevents a pull on every restart; without a volume this is
    # still safe and simply rehydrates the configured model after a redeploy.
    # Pull asynchronously by default so Railway can see a healthy HTTP port
    # while the first model download is in progress.  Set
    # OLLAMA_PULL_BLOCKING=1 when a deployment must wait for the model.
    ensure_model() {
        if [ "${OLLAMA_PULL_MODEL:-1}" != "1" ] || ollama show "$OLLAMA_MODEL" >/dev/null 2>&1; then
            return 0
        fi
        echo "Pulling Ollama model ${OLLAMA_MODEL}"
        if ! ollama pull "$OLLAMA_MODEL"; then
            echo "Warning: unable to pull ${OLLAMA_MODEL}; API will use its grounded fallback."
            return 1
        fi
    }
    if [ "${OLLAMA_PULL_BLOCKING:-0}" = "1" ]; then
        if ! ensure_model && [ "${OLLAMA_REQUIRED:-0}" = "1" ]; then
            exit 1
        fi
    else
        ensure_model >/tmp/ollama-pull.log 2>&1 &
        echo "Ollama model pull started in the background (set OLLAMA_PULL_BLOCKING=1 to wait)."
    fi

    # Load the model before accepting public traffic. Without this small
    # warm-up, the first real RAG request pays the 40-55s model-load penalty
    # and can look like an unavailable backend to the browser.
    if [ "${OLLAMA_WARMUP:-0}" = "1" ]; then
        echo "Warming Ollama model ${OLLAMA_MODEL}"
        if ! curl --fail --silent --show-error --max-time "${OLLAMA_WARMUP_TIMEOUT:-180}" \
            "${OLLAMA_URL%/}/api/generate" \
            -H 'Content-Type: application/json' \
            -d "{\"model\":\"${OLLAMA_MODEL}\",\"prompt\":\"Reply OK\",\"stream\":false,\"keep_alive\":\"10m\",\"options\":{\"num_predict\":1,\"num_ctx\":128}}" \
            >/tmp/ollama-warmup.log 2>&1; then
            cat /tmp/ollama-warmup.log || true
            if [ "${OLLAMA_REQUIRED:-0}" = "1" ]; then
                echo "Error: Ollama warm-up failed."
                exit 1
            fi
        else
            echo "Ollama model warm-up complete"
        fi
    fi
}

if is_local_ollama; then
    start_local_ollama
else
    echo "Using external Ollama endpoint ${OLLAMA_URL}"
fi

# Build/rebuild the local vector index before FastAPI starts.  Ingestion is
# idempotent (upsert), and can be skipped for a pre-populated persistent volume.
if [ "${SKIP_INGEST:-0}" != "1" ] && [ -d /app/data/knowledge ]; then
    echo "Indexing knowledge corpus into ${CHROMA_PERSIST_DIR}"
    if ! python -m scripts.ingest --input /app/data/knowledge --persist-dir "$CHROMA_PERSIST_DIR"; then
        echo "Warning: knowledge ingestion failed; FastAPI will start with an empty index."
        if [ "${INGEST_REQUIRED:-0}" = "1" ]; then
            exit 1
        fi
    fi
fi

exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
