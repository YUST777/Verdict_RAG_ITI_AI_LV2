'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { BookOpen, Code, ExternalLink, MessageSquare, Plus, Settings, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

import { useLLM } from '@/lib/useLLM';
import AIPreferencesModal from './AIPreferencesModal';
import ChatMessage from './ChatMessage';
import { Conversation, ConversationContent, ConversationScrollButton } from '@/components/ui/conversation';
import { PromptInputBox } from '@/components/ui/ai-prompt-box';

interface Citation {
    title?: string;
    source?: string;
    chunk?: number | null;
    url?: string;
    description?: string;
    type?: 'web' | 'youtube';
}

interface Message {
    id: string;
    role: 'user' | 'assistant' | 'sources';
    content: string;
    timestamp: Date;
    codeBlock?: {
        code: string;
        language: string;
        lineReference?: string;
    };
    sources?: Citation[];
}

interface ChatTab {
    id: string;
    label: string;
}

interface AIAgentPanelProps {
    // Kept in the public contract because the problem page passes these props.
    onSolveProblem?: () => void;
    isLoading?: boolean;
    selectedCode?: string;
    userCode?: string;
    language?: string;
    problemDescription?: string;
    testCases?: Array<{ input: string; output: string }>;
    onCodeSelected?: (code: string) => void;
    initialQuestion?: string;
    codeforcesRating?: number;
    problemTags?: string[];
    problemDifficulty?: string;
    onSelectionCleared?: () => void;
    selectedLineReference?: string;
    onAiCodeUpdate?: (code: string) => void;
    onSwitchToAiTab?: () => void;
    autoStart?: boolean;
    problemId?: string;
    isActive?: boolean;
    onQuizMe?: () => void;
    quizMode?: boolean;
}

const DEFAULT_TAB: ChatTab = { id: 'default', label: 'Chat 1' };

function storageKey(problemId?: string) {
    return `verdict-rag-chat-${problemId || 'standalone'}`;
}

function parseStoredMessages(value: unknown): Record<string, Message[]> {
    if (!value || typeof value !== 'object') return { default: [] };
    const result: Record<string, Message[]> = {};
    for (const [tabId, messages] of Object.entries(value as Record<string, unknown>)) {
        if (!Array.isArray(messages)) continue;
        result[tabId] = messages
            .filter((message): message is Record<string, unknown> => Boolean(message && typeof message === 'object'))
            .map((message) => ({
                ...(message as unknown as Message),
                role: message.role === 'user' || message.role === 'sources' ? message.role : 'assistant',
                content: typeof message.content === 'string' ? message.content : '',
                timestamp: new Date(typeof message.timestamp === 'string' || typeof message.timestamp === 'number' ? message.timestamp : Date.now()),
            }));
    }
    return Object.keys(result).length ? result : { default: [] };
}

export default function AIAgentPanel({
    selectedCode,
    userCode = '',
    language = 'cpp',
    problemDescription,
    initialQuestion,
    codeforcesRating,
    onSelectionCleared,
    selectedLineReference,
    problemId,
    isActive = false,
}: AIAgentPanelProps) {
    const { settings } = useLLM();
    const isArabic = settings.language === 'ar';
    const [chatTabs, setChatTabs] = useState<ChatTab[]>([DEFAULT_TAB]);
    const [activeChatTab, setActiveChatTab] = useState(DEFAULT_TAB.id);
    const [messagesByTab, setMessagesByTab] = useState<Record<string, Message[]>>({ default: [] });
    const [inputByTab, setInputByTab] = useState<Record<string, string>>({ default: '' });
    const [resourceSources, setResourceSources] = useState<Citation[]>([]);
    const [isHydrated, setIsHydrated] = useState(false);
    const [isResourcesOpen, setIsResourcesOpen] = useState(false);
    const [showPreferencesModal, setShowPreferencesModal] = useState(false);
    const [isLoadingByTab, setIsLoadingByTab] = useState<Record<string, boolean>>({ default: false });
    const [aiStatusByTab, setAiStatusByTab] = useState<Record<string, string>>({ default: '' });
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const abortRef = useRef<AbortController | null>(null);
    const previousQuestionRef = useRef(initialQuestion);

    const messages = messagesByTab[activeChatTab] || [];
    const input = inputByTab[activeChatTab] || '';
    const isLoadingMessage = Boolean(isLoadingByTab[activeChatTab]);
    const aiStatus = aiStatusByTab[activeChatTab] || (isArabic ? 'بجهز أطبخ...' : 'Ready when you are.');

    // Anonymous local persistence keeps the panel useful without account APIs.
    useEffect(() => {
        let cancelled = false;
        try {
            const stored = localStorage.getItem(storageKey(problemId));
            if (stored) {
                const parsed = JSON.parse(stored) as {
                    tabs?: ChatTab[];
                    activeTab?: string;
                    messagesByTab?: Record<string, unknown>;
                    inputByTab?: Record<string, string>;
                    sources?: Citation[];
                };
                if (!cancelled) {
                    const tabs = Array.isArray(parsed.tabs) && parsed.tabs.length ? parsed.tabs : [DEFAULT_TAB];
                    setChatTabs(tabs);
                    setActiveChatTab(parsed.activeTab && tabs.some((tab) => tab.id === parsed.activeTab) ? parsed.activeTab : tabs[0].id);
                    setMessagesByTab(parseStoredMessages(parsed.messagesByTab));
                    if (parsed.inputByTab && typeof parsed.inputByTab === 'object') setInputByTab(parsed.inputByTab);
                    if (Array.isArray(parsed.sources)) setResourceSources(parsed.sources);
                }
            }
        } catch {
            // Corrupt browser state is safe to ignore.
        }
        setIsHydrated(true);
        return () => { cancelled = true; };
    }, [problemId]);

    useEffect(() => {
        if (!isHydrated) return;
        try {
            localStorage.setItem(storageKey(problemId), JSON.stringify({
                tabs: chatTabs,
                activeTab: activeChatTab,
                messagesByTab,
                inputByTab,
                sources: resourceSources,
            }));
        } catch {
            // Storage can be unavailable in private browsing; chat still works in memory.
        }
    }, [activeChatTab, chatTabs, inputByTab, isHydrated, messagesByTab, problemId, resourceSources]);

    useEffect(() => {
        if (initialQuestion && initialQuestion !== previousQuestionRef.current) {
            setInputByTab((previous) => ({ ...previous, [activeChatTab]: initialQuestion }));
            previousQuestionRef.current = initialQuestion;
        }
    }, [activeChatTab, initialQuestion]);

    useEffect(() => {
        if (selectedCode?.trim() && !input.trim() && !initialQuestion) {
            setInputByTab((previous) => ({
                ...previous,
                [activeChatTab]: isArabic ? 'اشرح لي هذا الكود' : 'Explain this code',
            }));
        }
    }, [activeChatTab, initialQuestion, input, isArabic, selectedCode]);

    useEffect(() => {
        if (isActive || messages.length) {
            const timer = window.setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: isActive ? 'auto' : 'smooth' }), 80);
            return () => window.clearTimeout(timer);
        }
    }, [isActive, messages.length]);

    const setInput = useCallback((value: string) => {
        setInputByTab((previous) => ({ ...previous, [activeChatTab]: value }));
    }, [activeChatTab]);

    const appendMessage = useCallback((tabId: string, message: Message) => {
        setMessagesByTab((previous) => ({ ...previous, [tabId]: [...(previous[tabId] || []), message] }));
    }, []);

    const updateMessage = useCallback((tabId: string, id: string, content: string) => {
        setMessagesByTab((previous) => ({
            ...previous,
            [tabId]: (previous[tabId] || []).map((message) => message.id === id ? { ...message, content } : message),
        }));
    }, []);

    const addNewChat = useCallback(() => {
        const newId = `chat-${Date.now()}`;
        setChatTabs((previous) => [...previous, { id: newId, label: `Chat ${previous.length + 1}` }]);
        setActiveChatTab(newId);
        setMessagesByTab((previous) => ({ ...previous, [newId]: [] }));
        setInputByTab((previous) => ({ ...previous, [newId]: '' }));
        setAiStatusByTab((previous) => ({ ...previous, [newId]: '' }));
    }, []);

    const deleteChat = useCallback((tabId: string) => {
        setChatTabs((previous) => {
            if (previous.length <= 1) {
                const fresh = `chat-${Date.now()}`;
                setMessagesByTab((messages) => ({ ...messages, [fresh]: [] }));
                setInputByTab((inputs) => ({ ...inputs, [fresh]: '' }));
                setActiveChatTab(fresh);
                return [{ id: fresh, label: 'Chat 1' }];
            }
            const next = previous.filter((tab) => tab.id !== tabId);
            if (activeChatTab === tabId) setActiveChatTab(next[Math.max(0, previous.findIndex((tab) => tab.id === tabId) - 1)].id);
            return next;
        });
        setMessagesByTab((previous) => {
            const next = { ...previous };
            delete next[tabId];
            return next;
        });
        setInputByTab((previous) => {
            const next = { ...previous };
            delete next[tabId];
            return next;
        });
    }, [activeChatTab]);

    const stopGeneration = useCallback(() => {
        abortRef.current?.abort();
        abortRef.current = null;
        setIsLoadingByTab((previous) => ({ ...previous, [activeChatTab]: false }));
        setAiStatusByTab((previous) => ({ ...previous, [activeChatTab]: '' }));
    }, [activeChatTab]);

    const handleSendMessage = useCallback(async (overridePrompt?: string) => {
        const tabId = activeChatTab;
        const prompt = (overridePrompt ?? inputByTab[tabId] ?? '').trim();
        if (!prompt || isLoadingByTab[tabId]) return;

        const selected = selectedCode?.trim();
        appendMessage(tabId, {
            id: `user-${Date.now()}`,
            role: 'user',
            content: prompt,
            timestamp: new Date(),
            ...(selected ? { codeBlock: { code: selected, language, lineReference: selectedLineReference } } : {}),
        });
        setInputByTab((previous) => ({ ...previous, [tabId]: '' }));
        onSelectionCleared?.();
        setIsLoadingByTab((previous) => ({ ...previous, [tabId]: true }));
        setAiStatusByTab((previous) => ({ ...previous, [tabId]: isArabic ? 'بفتش في المصادر...' : 'Retrieving relevant sources...' }));

        const messageId = `assistant-${Date.now()}`;
        appendMessage(tabId, { id: messageId, role: 'assistant', content: '', timestamp: new Date() });
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        const lowerPrompt = prompt.toLowerCase();
        const mode = lowerPrompt.includes('hint')
            ? 'hint'
            : lowerPrompt.includes('debug') || lowerPrompt.includes('bug') || Boolean(selected)
                ? 'debug'
                : lowerPrompt.includes('full solution') || lowerPrompt.includes('solve it')
                    ? 'full'
                    : 'teach';

        try {
            const response = await fetch('/api/rag/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: prompt,
                    problem_statement: problemDescription || undefined,
                    code: selected || userCode.trim() || undefined,
                    mode,
                    top_k: 5,
                }),
                signal: controller.signal,
            });
            if (!response.ok) {
                const detail = await response.json().catch(() => ({}));
                throw new Error(detail.error || detail.detail || `RAG service error (${response.status})`);
            }

            setAiStatusByTab((previous) => ({ ...previous, [tabId]: isArabic ? 'بكتب إجابة مبنية على المصادر...' : 'Writing a grounded answer...' }));
            const data = await response.json() as { answer?: string; citations?: Citation[] };
            const citations = Array.isArray(data.citations) ? data.citations : [];
            setResourceSources(citations);
            let answer = data.answer || (isArabic ? 'لم يرجع محرك RAG إجابة.' : 'The RAG service returned an empty answer.');
            if (citations.length) {
                answer += `\n\n### Retrieved sources\n${citations.map((citation, index) => {
                    const location = citation.chunk === null || citation.chunk === undefined ? citation.source || '' : `${citation.source || ''}, chunk ${citation.chunk}`;
                    return `${index + 1}. **${citation.title || citation.source || 'Source'}** — ${location}`;
                }).join('\n')}`;
            }

            setIsLoadingByTab((previous) => ({ ...previous, [tabId]: false }));
            const words = answer.split(' ');
            let streamed = '';
            for (let index = 0; index < words.length; index += 1) {
                if (controller.signal.aborted) return;
                streamed += `${index ? ' ' : ''}${words[index]}`;
                updateMessage(tabId, messageId, streamed);
                await new Promise((resolve) => window.setTimeout(resolve, 14));
            }
            updateMessage(tabId, messageId, answer);
        } catch (error: unknown) {
            if (error instanceof DOMException && error.name === 'AbortError') return;
            const message = error instanceof Error ? error.message : 'Unable to reach the RAG service.';
            updateMessage(tabId, messageId, `Sorry, I could not answer that. ${message}`);
        } finally {
            setIsLoadingByTab((previous) => ({ ...previous, [tabId]: false }));
            setAiStatusByTab((previous) => ({ ...previous, [tabId]: '' }));
            if (abortRef.current === controller) abortRef.current = null;
        }
    }, [activeChatTab, appendMessage, inputByTab, isArabic, isLoadingByTab, language, onSelectionCleared, problemDescription, selectedCode, selectedLineReference, updateMessage, userCode]);

    return (
        <div className="flex flex-col h-full bg-[#121212] min-h-0 text-white" data-lenis-prevent>
            <div className="flex items-center gap-0 border-b border-white/[0.06] shrink-0 bg-[#121212] overflow-x-auto">
                {chatTabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveChatTab(tab.id)}
                        className={`group/tab flex items-center gap-1.5 px-3.5 py-2.5 text-[12px] font-medium border-b-2 transition-all shrink-0 ${activeChatTab === tab.id ? 'border-[#2cbb5d] text-white/90 bg-white/[0.03]' : 'border-transparent text-white/35 hover:text-white/60 hover:bg-white/[0.02]'}`}
                    >
                        <MessageSquare size={12} strokeWidth={2} />
                        {tab.label}
                        <span onClick={(event) => { event.stopPropagation(); deleteChat(tab.id); }} className="ml-0.5 p-0.5 rounded opacity-0 group-hover/tab:opacity-100 hover:bg-white/10 text-white/40 hover:text-white/80 transition-all cursor-pointer" title="Delete chat">
                            <X size={10} strokeWidth={2.5} />
                        </span>
                    </button>
                ))}
                <button onClick={addNewChat} className="flex items-center justify-center w-8 h-8 my-0.5 mx-1 rounded-lg text-white/25 hover:text-white/60 hover:bg-white/[0.05] transition-all shrink-0" title="New chat">
                    <Plus size={14} strokeWidth={2} />
                </button>
            </div>

            <Conversation className="relative flex-1 min-h-0 bg-[#121212]">
                <ConversationContent className="px-3 py-4">
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-500">
                            <div className="w-14 h-14 rounded-2xl bg-[#2cbb5d]/10 border border-[#2cbb5d]/20 flex items-center justify-center mb-4">
                                <Image src="/icons/logo.svg" alt="Verdict" width={32} height={32} className="opacity-80" />
                            </div>
                            <h3 className="text-base font-semibold text-white/80 mb-1.5">{isArabic ? 'كيف يمكنني مساعدتك؟' : 'How can I help?'}</h3>
                            <p className="text-xs text-white/35 max-w-[250px] leading-relaxed">{isArabic ? 'اسأل عن الخوارزميات، صحح كودك، أو احصل على تلميحات لحل المسائل.' : 'Ask about algorithms, debug your code, or get problem-solving hints grounded in the Verdict corpus.'}</p>
                            {aiStatus && <p className="text-[10px] text-white/20 mt-3">{aiStatus}</p>}
                        </div>
                    )}
                    <div className="flex flex-col gap-1">
                        {messages.map((message) => (
                            message.content || message.codeBlock ? <ChatMessage key={message.id} message={message} isAuthenticated={false} userEmail="You" /> : null
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                </ConversationContent>
                <ConversationScrollButton />
            </Conversation>

            <div className="bg-[#121212] border-t border-white/[0.06] px-3 pt-2.5 pb-3 shrink-0 relative z-10">
                {selectedCode?.trim() && selectedLineReference && (
                    <div className="flex items-center gap-2 mb-2">
                        <div className="flex-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-blue-500/[0.08] border border-blue-500/20 text-blue-300/80 text-[11px] font-mono overflow-hidden">
                            <Code size={11} className="shrink-0" />
                            <span className="truncate">{selectedLineReference.replace('@ ', '')}</span>
                        </div>
                        <button onClick={() => onSelectionCleared?.()} className="h-7 w-7 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/[0.07] transition-colors text-xs">✕</button>
                    </div>
                )}
                <PromptInputBox
                    value={input}
                    onChange={setInput}
                    isLoading={isLoadingMessage}
                    placeholder={selectedCode && selectedLineReference ? (isArabic ? 'اسأل عن الكود المحدد...' : 'Ask about the selected code...') : (isArabic ? 'اسأل أي شيء...' : 'Ask anything...')}
                    onSend={(message) => handleSendMessage(message)}
                    onStop={stopGeneration}
                    onOpenResources={() => setIsResourcesOpen(true)}
                    onTeachMe={() => handleSendMessage(isArabic ? 'علمني كيف أحل هذه المسألة خطوة بخطوة.' : 'Teach me how to solve this problem step by step. Start with the key observation, algorithm, proof idea, edge cases, and complexity.')}
                    onQuizMe={() => handleSendMessage(isArabic ? 'اختبر فهمي للكود والمسألة بخمسة أسئلة.' : 'Quiz me on this problem and code with five questions.')}
                    isTutorLoading={false}
                    isTutorActive={false}
                    hasUsedTutor={false}
                />
                <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-white/20 truncate max-w-[75%]">{isLoadingMessage ? aiStatus : 'Answers are grounded in the local RAG service.'}</span>
                    <button onClick={() => setShowPreferencesModal(true)} className="p-1.5 rounded-lg hover:bg-white/5 text-white/25 hover:text-white/60 transition-colors" title="AI Settings"><Settings size={13} strokeWidth={2} /></button>
                </div>
            </div>

            <AnimatePresence>
                {isResourcesOpen && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsResourcesOpen(false)} className="absolute inset-0 bg-black/40 z-40" />
                        <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 300 }} className="absolute inset-y-0 right-0 w-full sm:w-[90%] bg-[#1a1a1a] shadow-2xl z-50 flex flex-col border-l border-white/[0.06]">
                            <div className="flex items-center justify-between p-4 border-b border-white/5 bg-[#1a1a1a]"><h3 className="text-sm font-semibold text-white/90">Retrieved resources</h3><button onClick={() => setIsResourcesOpen(false)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white"><X size={16} /></button></div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#121212]">
                                {resourceSources.length === 0 ? <div className="text-center py-10 text-white/40 text-sm">Ask a question to see the sources used by RAG.</div> : resourceSources.map((source, index) => (
                                    <a key={`${source.source || source.title}-${index}`} href={source.url || '#'} target={source.url ? '_blank' : undefined} rel="noreferrer" className="group flex items-center gap-3 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                                        <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0"><BookOpen className="w-4 h-4 text-white/50 group-hover:text-white/80" /></div>
                                        <div className="min-w-0 flex-1"><h4 className="text-sm font-medium text-white/90 truncate">{source.title || source.source || `Source ${index + 1}`}</h4><p className="text-xs text-white/40 mt-0.5 truncate">{source.source || source.description || 'Retrieved corpus chunk'}</p></div>
                                        {source.url && <ExternalLink className="w-4 h-4 text-white/20 group-hover:text-white/50 shrink-0" />}
                                    </a>
                                ))}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <AIPreferencesModal isOpen={showPreferencesModal} onClose={() => setShowPreferencesModal(false)} codeforcesRating={codeforcesRating} onPreferencesSaved={() => undefined} />
        </div>
    );
}
