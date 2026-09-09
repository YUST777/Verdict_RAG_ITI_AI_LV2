import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/simple-rate-limit';

/**
 * Browser-compatible adapter for the grounded FastAPI service.
 *
 * The original Verdict panel speaks the OpenAI chat-completions shape. Keeping
 * this small adapter means the polished mirror UI can use the new RAG service
 * without exposing model keys in the browser or reintroducing authentication.
 */
const RAG_API_URL = process.env.RAG_API_URL || 'http://localhost:8000';

function extractProblemStatement(messages: Array<{ role?: string; content?: string }>) {
    const system = messages.find((message) => message.role === 'system')?.content || '';
    const match = system.match(/<problem_description>\s*([\s\S]*?)\s*<\/problem_description>/i);
    return (match?.[1] || '').slice(0, 50000) || undefined;
}

function extractCode(content: string) {
    const match = content.match(/```(?:[a-z0-9+#.-]+)?\s*([\s\S]*?)```/i);
    return match?.[1]?.trim().slice(0, 50000) || undefined;
}

export async function POST(request: NextRequest) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anonymous';
    if (!checkRateLimit(`rag-chat:${ip}`, 60, 60)) {
        return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
    }

    try {
        const body = await request.json();
        const messages = Array.isArray(body?.messages) ? body.messages : [];
        const latestUser = [...messages].reverse().find((message) => message?.role === 'user');
        const question = String(latestUser?.content || '').trim();
        if (!question) return NextResponse.json({ error: 'Messages required' }, { status: 400 });
        const isQuizRequest = /generate\s+5\s+quiz\s+questions|quiz\s+me/i.test(question);

        const ragResponse = await fetch(`${RAG_API_URL.replace(/\/$/, '')}/api/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question,
                problem_statement: extractProblemStatement(messages),
                code: extractCode(question),
                mode: body?.mode || (isQuizRequest ? 'quiz' : 'explain'),
                top_k: 5,
            }),
            signal: AbortSignal.timeout(90000),
        });

        const data = await ragResponse.json().catch(() => ({}));
        if (!ragResponse.ok) {
            return NextResponse.json(
                { error: data?.detail || data?.error || 'RAG service error' },
                { status: ragResponse.status >= 500 ? 502 : ragResponse.status },
            );
        }

        const citations = Array.isArray(data.citations) ? data.citations : [];
        const sourceList = citations.length && !isQuizRequest
            ? `\n\n### Retrieved sources\n${citations.map((citation: { title?: string; source?: string }, index: number) =>
                `[${index + 1}] **${citation.title || 'Untitled source'}** — ${citation.source || 'indexed corpus'}`
            ).join('\n')}`
            : '';

        return NextResponse.json({
            choices: [{ index: 0, message: { role: 'assistant', content: `${data.answer || 'No answer returned.'}${sourceList}` }, finish_reason: 'stop' }],
            usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
            rag: {
                grounded: Boolean(data.grounded),
                citations,
                latency_ms: data.latency_ms,
            },
        });
    } catch (error) {
        console.error('[ai/chat] RAG proxy error:', error);
        return NextResponse.json(
            { error: 'RAG service is unavailable. Start the FastAPI backend on port 8000.' },
            { status: 503 },
        );
    }
}
