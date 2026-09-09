import { useState, useEffect, useCallback } from 'react';

interface UseCodeforcesHandleReturn {
    handle: string | null;
    loading: boolean;
    error: string | null;
    setHandle: (handle: string) => void;
    refreshHandle: () => Promise<void>;
}

const STORAGE_KEY = 'verdict-cf-handle';

/**
 * Anonymous Codeforces handle storage. The stripped workspace keeps this
 * preference in the browser so submissions and analytics work without an
 * account or extension session.
 */
export function useCodeforcesHandle(): UseCodeforcesHandleReturn {
    const [handle, setHandleState] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const saveToLocalStorage = useCallback((cfHandle: string) => {
        try {
            localStorage.setItem(STORAGE_KEY, cfHandle);
        } catch {}
    }, []);

    const loadFromLocalStorage = useCallback((): string | null => {
        try {
            return localStorage.getItem(STORAGE_KEY);
        } catch {
            return null;
        }
    }, []);

    const refreshHandle = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const cfHandle = loadFromLocalStorage();

            if (cfHandle) {
                setHandleState(cfHandle);
                saveToLocalStorage(cfHandle);
            } else {
                setHandleState(null);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to get handle');
            const localHandle = loadFromLocalStorage();
            if (localHandle) setHandleState(localHandle);
        } finally {
            setLoading(false);
        }
    }, [loadFromLocalStorage, saveToLocalStorage]);

    // Set handle manually (from user input) — saves locally for this browser.
    const setHandle = useCallback((cfHandle: string) => {
        const trimmed = cfHandle.trim();
        if (trimmed) {
            setHandleState(trimmed);
            saveToLocalStorage(trimmed);
        }
    }, [saveToLocalStorage]);

    useEffect(() => {
        refreshHandle();
    }, [refreshHandle]);

    return { handle, loading, error, setHandle, refreshHandle };
}
