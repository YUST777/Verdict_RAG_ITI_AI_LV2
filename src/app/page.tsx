"use client";

import { FormEvent, ReactNode, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BrainCircuit,
  Check,
  Clipboard,
  Code2,
  ExternalLink,
  Github,
  Lightbulb,
  Sparkles,
  Terminal,
} from "lucide-react";
import Image from "next/image";
import { getInternalRoute, parseCodeforcesUrl } from "@/lib/parseCodeforcesUrl";

const examples = [
  { label: "Contest 4A", url: "https://codeforces.com/contest/4/problem/A" },
  { label: "Problemset 71A", url: "https://codeforces.com/problemset/problem/71/A" },
  { label: "Gym problem", url: "https://codeforces.com/gym/102644/problem/A" },
];

/** Verdict's launcher: open a Codeforces mirror, then ask the grounded tutor from that workspace. */
export default function Home() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPasting, setIsPasting] = useState(false);
  const parsed = useMemo(() => parseCodeforcesUrl(url.trim()), [url]);

  const openMirror = (event?: FormEvent) => {
    event?.preventDefault();
    const result = parseCodeforcesUrl(url.trim());
    if (!result) {
      setError("Paste a Codeforces contest, gym, group, or problemset URL.");
      return;
    }
    setError(null);
    router.push(getInternalRoute(result));
  };

  const pasteFromClipboard = async () => {
    setIsPasting(true);
    try {
      setUrl(await navigator.clipboard.readText());
      setError(null);
    } catch {
      setError("Clipboard access is unavailable. Paste the link into the field.");
    } finally {
      setIsPasting(false);
    }
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#0b0b0c] text-white">
      <div className="pointer-events-none fixed inset-0 -z-0 opacity-50 [background-image:radial-gradient(circle_at_50%_-15%,rgba(16,185,129,0.2),transparent_48%),linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] [background-size:auto,48px_48px,48px_48px]" />

      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <a href="/" className="flex items-center gap-2.5" aria-label="Verdict home">
          <Image src="/icons/logo.svg" alt="" width={30} height={30} className="h-7 w-7" priority />
          <span className="text-lg font-semibold tracking-tight">verdict.run</span>
          <span className="hidden rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300 sm:inline-flex">AI lab</span>
        </a>
        <div className="flex items-center gap-2 sm:gap-3">
          <a href="https://github.com/YUST777/Verdict_RAG_ITI_AI_LV2" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-white/60 transition hover:border-white/20 hover:bg-white/5 hover:text-white">
            <Github size={15} /><span className="hidden sm:inline">Source</span>
          </a>
          <a href="https://codeforces.com" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-white/[0.07] px-3 py-2 text-xs font-medium text-white/70 transition hover:bg-white/10 hover:text-white">
            Codeforces <ExternalLink size={13} />
          </a>
        </div>
      </header>

      <section className="relative z-10 mx-auto max-w-5xl px-5 pb-16 pt-14 text-center sm:px-8 sm:pt-24">
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[0.08] px-3 py-1.5 text-xs font-medium text-emerald-300"><Sparkles size={14} />Grounded help for the problem in front of you</div>
        <h1 className="mx-auto max-w-4xl text-5xl font-semibold leading-[1.02] tracking-[-0.045em] sm:text-7xl">Solve with a <span className="text-emerald-400">second pair of eyes.</span></h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-white/55 sm:text-lg">Mirror any Codeforces problem into Verdict. Read the statement, run your code, and ask an AI tutor that cites the algorithms and editorials it used.</p>

        <form onSubmit={openMirror} className="mx-auto mt-10 max-w-3xl text-left">
          <label htmlFor="codeforces-url" className="mb-2 block px-1 text-xs font-medium uppercase tracking-[0.18em] text-white/40">Open a problem mirror</label>
          <div className={`flex flex-col gap-2 rounded-2xl border bg-black/30 p-2 shadow-2xl shadow-black/30 backdrop-blur-xl sm:flex-row ${error ? "border-red-400/50" : "border-white/10 focus-within:border-emerald-400/50"}`}>
            <div className="flex min-w-0 flex-1 items-center gap-3 px-3">
              <Code2 size={19} className="shrink-0 text-emerald-400" />
              <input id="codeforces-url" value={url} onChange={(event) => { setUrl(event.target.value); if (error) setError(null); }} placeholder="https://codeforces.com/contest/4/problem/A" className="min-w-0 flex-1 bg-transparent py-3 text-sm text-white outline-none placeholder:text-white/25 sm:text-base" autoComplete="url" spellCheck={false} />
              <button type="button" onClick={pasteFromClipboard} disabled={isPasting} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium text-white/45 transition hover:bg-white/10 hover:text-white disabled:opacity-50" title="Paste from clipboard"><Clipboard size={14} /><span className="hidden sm:inline">Paste</span></button>
            </div>
            <button type="submit" disabled={!parsed} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-6 py-3 text-sm font-semibold text-[#06120e] transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/25">Open mirror <ArrowRight size={16} /></button>
          </div>
          <div className="mt-2 flex min-h-5 items-center justify-between gap-4 px-1 text-xs">
            {error ? <p className="text-red-300">{error}</p> : <p className="text-white/30">Works with contest, problemset, gym, group, and ACM SGURU links.</p>}
            {parsed && !error && <p className="hidden text-emerald-300/70 sm:block">Ready: {parsed.type} / {parsed.contestId} / {parsed.problemId}</p>}
          </div>
        </form>

        <div className="mx-auto mt-5 flex max-w-3xl flex-wrap justify-center gap-2">{examples.map((example) => <button key={example.url} type="button" onClick={() => setUrl(example.url)} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/45 transition hover:border-emerald-400/30 hover:bg-emerald-400/[0.06] hover:text-emerald-200">{example.label}</button>)}</div>
      </section>

      <section className="relative z-10 mx-auto grid max-w-6xl gap-4 px-5 pb-24 sm:px-8 md:grid-cols-3">
        <FeatureCard icon={<Terminal size={18} />} title="Mirror instantly" text="The original statement, examples, limits, and navigation stay together with your editor." />
        <FeatureCard icon={<BrainCircuit size={18} />} title="Ask with context" text="Verdict sends the current problem and code to the grounded tutor, so answers stay specific." />
        <FeatureCard icon={<Lightbulb size={18} />} title="Learn the pattern" text="Start with a hint, inspect cited sources, then move from idea to implementation at your pace." />
      </section>

      <section className="relative z-10 mx-auto max-w-5xl border-t border-white/[0.07] px-5 py-8 text-center sm:px-8"><p className="inline-flex items-center gap-2 text-xs text-white/35"><Check size={14} className="text-emerald-400" />Local first. Your code stays in this browser until you submit it.</p></section>
    </main>
  );
}

function FeatureCard({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return <article className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5 text-left transition hover:-translate-y-0.5 hover:border-emerald-400/25 hover:bg-white/[0.05]"><div className="mb-4 inline-flex rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-2 text-emerald-300">{icon}</div><h2 className="text-sm font-semibold text-white">{title}</h2><p className="mt-2 text-sm leading-6 text-white/45">{text}</p></article>;
}
