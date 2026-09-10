import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const RAG_API_URL = process.env.RAG_API_URL || 'http://127.0.0.1:8000';
const RAG_API_KEY = process.env.RAG_API_KEY;

/** Same-origin bridge from the Verdict workspace to the local FastAPI RAG service. */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const response = await fetch(`${RAG_API_URL.replace(/\/$/, '')}/api/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(RAG_API_KEY ? { 'x-rag-api-key': RAG_API_KEY } : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(120_000),
      cache: 'no-store',
    });

    const body = await response.json().catch(() => ({ detail: 'RAG service returned an invalid response.' }));
    return NextResponse.json(body, { status: response.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to reach the RAG service.';
    return NextResponse.json(
      { error: `RAG backend unavailable: ${message}. Start FastAPI on port 8000.` },
      { status: 503 },
    );
  }
}
