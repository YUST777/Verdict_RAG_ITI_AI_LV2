# Local offline Verdict AI

This stack runs the Qwen2.5-Coder 1.5B Q4 model in an Alpine container. The
model and the RAG backend are on an `internal` Docker network, so neither can
make outbound internet requests at runtime. The Cloudflare tunnel is the only
container with an internet-facing network; it forwards HTTPS traffic to the
backend and prints a temporary `trycloudflare.com` URL.

The model weights are downloaded only while building the image. The first build
needs internet and about 2 GB of free disk; after that, runtime is offline.

## Start

```sh
cd local-ai
cp .env.example .env
openssl rand -hex 32 | sed 's/^/RAG_API_KEY=/' > .env
docker compose up -d --build
docker compose logs -f tunnel
```

Copy the `https://...trycloudflare.com` URL from the tunnel logs. Set the Vercel
production variable `RAG_API_URL` to that URL and `RAG_API_KEY` to the same
secret, then redeploy the frontend. The local API is also available at
`http://127.0.0.1:8001` for testing.

The base Alpine profile runs CPU inference. Your Docker installation currently
does not have the NVIDIA container runtime, so it does not use the MX450. The
GPU profile below uses a glibc/CUDA image because CUDA is not compatible with
Alpine's musl base.

## Larger GPU model

The repository also includes `Dockerfile.model-cuda` and
`docker-compose.gpu.yml`. That profile uses Qwen2.5-Coder 3B Q3_K_M (about
1.7 GB) with 16 transformer layers offloaded to the MX450 and the rest on CPU:

```sh
docker compose -f local-ai/docker-compose.gpu.yml up -d --build
```

The GPU profile creates a temporary Cloudflare URL; read it with:

```sh
docker compose -f local-ai/docker-compose.gpu.yml logs -f tunnel
```

It requires the NVIDIA device files shown by `nvidia-smi` and a CUDA runtime
image. If Docker has the NVIDIA Container Toolkit installed, replace the
manual device mounts with `--gpus all` or the equivalent Compose GPU setting.
The 3B model is more capable than the 1.5B model but still requires compiling
and running generated code through Judge0 before treating an answer as
accepted. The GPU profile uses a 512-token response budget to keep this small
model focused; it is still not a guarantee of correctness.

The backend image preloads Chroma's roughly 80 MB ONNX embedding model during
the build. This is required because the backend network is intentionally
offline at runtime; without it, the first RAG query would fail while trying to
download the embedder.

## Benchmark the model

Run the executable benchmark after the model server is reachable. It asks the
same five small problems every time, extracts the C++17 block, compiles it,
and runs edge-case fixtures. A problem receives credit only when every fixture
passes:

```sh
python local-ai/benchmark_model.py \\
  --url http://127.0.0.1:8082 \\
  --model qwen2.5-coder:3b-q3-cuda \\
  --json /tmp/verdict-model-report.json
```

The report includes the raw answer, compiler diagnostics, per-case output, and
latency. Change `--url` to the model service address when running the script
inside the backend container.
