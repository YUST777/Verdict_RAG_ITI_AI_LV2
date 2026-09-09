FROM python:3.11-slim

# Railway runs this service as one container.  Ollama is kept in the same
# container as FastAPI so the required local model does not need a public
# endpoint or an API key.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    OLLAMA_HOST=127.0.0.1:11434

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl zstd \
    && rm -rf /var/lib/apt/lists/* \
    && curl -fsSL https://ollama.com/install.sh | sh

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app ./app
COPY scripts ./scripts
# Ingestion runs when the container starts.  Keep the source corpus in the
# image so a fresh Railway deploy can rebuild its Chroma index automatically.
COPY data ./data
COPY railway-entrypoint.sh ./railway-entrypoint.sh
RUN chmod +x ./railway-entrypoint.sh \
    && mkdir -p /app/data/chroma
# Warm the local embedding model and build an initial index at image-build
# time.  This keeps first boot from downloading the 80 MB embedding model while
# still allowing the entrypoint to upsert fresh documents on every deploy.
RUN python -m scripts.ingest --input /app/data/knowledge --persist-dir /app/data/chroma

EXPOSE 8000
ENTRYPOINT ["/app/railway-entrypoint.sh"]
