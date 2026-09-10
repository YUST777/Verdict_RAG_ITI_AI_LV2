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

The MX450 currently cannot be passed to Docker because the NVIDIA container
runtime is not installed. This image therefore runs CPU inference and stays
within the laptop's 16 GB RAM. Once `nvidia-container-toolkit` is installed,
the model command can use GPU offload; Alpine/CUDA is intentionally not mixed
into this image because CUDA's glibc runtime is not compatible with Alpine's
musl base.

