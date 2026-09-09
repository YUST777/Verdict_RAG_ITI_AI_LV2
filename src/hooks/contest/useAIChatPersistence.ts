'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Local persistence for AI chat.
 *
 * Anonymous-first persistence for the stripped mirror. Messages are stored in
 * localStorage; the old cloud endpoints are intentionally not called.
 *
 * The hook keeps the original component contract while storing one debounced
 * JSON snapshot per problem in the browser.
 */
export function useAIChatPersistence(
    problemId: string,
    isAuthenticated: boolean = false,
    initialTabs: any[] = [{ id: 'default', label: 'Chat 1' }],
    onAuthError?: () => void
) {
    const [messagesByTab, setMessagesByTab] = useState<Record<string, any[]>>({ 'default': [] });
    const [conceptsByTab, setConceptsByTab] = useState<Record<string, any[]>>({ 'default': [] });
    const [inputByTab, setInputByTab] = useState<Record<string, string>>({ 'default': '' });
    const [aiCodeByTab, setAiCodeByTab] = useState<Record<string, string>>({ 'default': '' });
    const [chatTabs, setChatTabs] = useState<any[]>(initialTabs);
    const [isLoaded, setIsLoaded] = useState(false);

    const messagesRef = useRef(messagesByTab);
    const conceptsRef = useRef(conceptsByTab);
    const inputRef = useRef(inputByTab);
    const aiCodeRef = useRef(aiCodeByTab);
    const tabsRef = useRef(chatTabs);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isFirstLoad = useRef(true);

    // Sync refs
    useEffect(() => {
        messagesRef.current = messagesByTab;
        conceptsRef.current = conceptsByTab;
        inputRef.current = inputByTab;
        aiCodeRef.current = aiCodeByTab;
        tabsRef.current = chatTabs;
    }, [messagesByTab, conceptsByTab, inputByTab, aiCodeByTab, chatTabs]);

    // ── Load on mount ────────────────────────────────────────────────
    useEffect(() => {
        if (!problemId) return;

        let isMounted = true;

        const loadData = async () => {
            try {
                const stored = window.localStorage.getItem(`verdict-ai-chat-${problemId}`);
                if (stored && isMounted) {
                    const data = JSON.parse(stored);
                    if (data.tabs) setChatTabs(data.tabs);
                    if (data.messagesByTab) {
                        const hydrated: Record<string, any[]> = {};
                        for (const [tabId, messages] of Object.entries(data.messagesByTab)) {
                            hydrated[tabId] = (messages as any[]).map((message) => ({ ...message, timestamp: new Date(message.timestamp) }));
                        }
                        setMessagesByTab(hydrated);
                    }
                    if (data.conceptsByTab) setConceptsByTab(data.conceptsByTab);
                    if (data.inputByTab) setInputByTab(data.inputByTab);
                    if (data.aiCodeByTab) setAiCodeByTab(data.aiCodeByTab);
                }
            } catch {
                // Ignore corrupt local history and start fresh.
            }
            if (isMounted) setIsLoaded(true);
        };

        loadData();

        return () => {
            isMounted = false;
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        };
    }, [problemId, isAuthenticated]);

    // ── Debounced JSONB backup save ──────────────────────────────────
    useEffect(() => {
        if (!isLoaded || !problemId) return;
        if (isFirstLoad.current) {
            isFirstLoad.current = false;
            return;
        }
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

        saveTimeoutRef.current = setTimeout(async () => {
            try {
                const body = {
                    problemId,
                    messagesByTab,
                    tabs: chatTabs,
                    conceptsByTab,
                    inputByTab,
                    aiCodeByTab
                };

                window.localStorage.setItem(`verdict-ai-chat-${problemId}`, JSON.stringify(body));
            } catch (err: any) {
                console.warn('[AIChat] Local save skipped:', err?.message || err);
            }
        }, 2000); // 2s debounce for backup

    }, [messagesByTab, chatTabs, conceptsByTab, inputByTab, aiCodeByTab, problemId, isLoaded, isAuthenticated]);

    // These callbacks preserve the existing panel API. The state snapshot
    // effect above performs persistence.
    const saveMessage = useCallback((
        tabId: string,
        tabLabel: string,
        message: {
            id: string;
            role: string;
            content: string;
            contextType?: string;
            codeBlock?: any;
            sources?: any[];
            videoScript?: any;
        }
    ) => {
        if (!problemId) return;

        // The debounced local snapshot effect persists the whole conversation.
    }, [isAuthenticated, problemId]);

    // ── saveConcepts: persist concepts to conversation metadata ──────
    const saveConcepts = useCallback((tabId: string, concepts: any[]) => {
        if (!problemId || !concepts || concepts.length === 0) return;
    }, [isAuthenticated, problemId]);

    // ── saveAiCode: persist AI generated code for the tab ────────────
    const saveAiCode = useCallback((tabId: string, aiCode: string) => {
        setAiCodeByTab(prev => ({ ...prev, [tabId]: aiCode }));
        if (!problemId) return;
    }, [isAuthenticated, problemId]);

    // ── deleteConversation: remove a tab from normalized tables ──────
    const deleteConversation = useCallback((tabId: string) => {
        if (!problemId) return;
    }, [isAuthenticated, problemId]);

    return {
        messagesByTab,
        setMessagesByTab,
        conceptsByTab,
        setConceptsByTab,
        inputByTab,
        setInputByTab,
        aiCodeByTab,
        setAiCodeByTab,
        chatTabs,
        setChatTabs,
        isLoaded,
        saveMessage,
        saveConcepts,
        saveAiCode,
        deleteConversation
    };
}
