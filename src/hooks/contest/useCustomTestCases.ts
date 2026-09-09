import { useState, useEffect, useCallback } from 'react';
import { Example } from '@/components/mirror/shared/types';

interface UseCustomTestCasesParams {
  contestId: string;
  problemId: string;
  sampleTestCasesCount: number;
}

interface UseCustomTestCasesReturn {
  customTestCases: Example[];
  handleAdd: (testCase: Example) => void;
  handleDelete: (index: number) => void;
  handleUpdate: (index: number, testCase: Example) => void;
}

/** Custom examples are kept in localStorage so mirror mode works without an account. */
export function useCustomTestCases({ contestId, problemId, sampleTestCasesCount }: UseCustomTestCasesParams): UseCustomTestCasesReturn {
  const safeContestId = Array.isArray(contestId) ? contestId[0] : contestId;
  const safeProblemId = Array.isArray(problemId) ? problemId[0] : problemId;
  const storageKey = `verdict-custom-tests-${safeContestId}-${safeProblemId}`;
  const [customTestCases, setCustomTestCases] = useState<Example[]>([]);

  useEffect(() => {
    if (!contestId || !problemId || typeof window === 'undefined') return;
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setCustomTestCases(parsed.map((testCase) => ({ ...testCase, isCustom: true })));
      }
    } catch {
      // Keep an empty list if storage is unavailable or corrupt.
    }
  }, [contestId, problemId, storageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(customTestCases));
    } catch {
      // Ignore quota/private-mode failures; test editing still works in memory.
    }
  }, [storageKey, customTestCases]);

  const handleAdd = useCallback((testCase: Example) => {
    setCustomTestCases((previous) => [...previous, { ...testCase, isCustom: true }]);
  }, []);

  const handleDelete = useCallback((index: number) => {
    const customIndex = index - sampleTestCasesCount;
    if (customIndex >= 0) setCustomTestCases((previous) => previous.filter((_, itemIndex) => itemIndex !== customIndex));
  }, [sampleTestCasesCount]);

  const handleUpdate = useCallback((index: number, testCase: Example) => {
    const customIndex = index - sampleTestCasesCount;
    if (customIndex >= 0) {
      setCustomTestCases((previous) => previous.map((item, itemIndex) => itemIndex === customIndex ? { ...testCase, isCustom: true } : item));
    }
  }, [sampleTestCasesCount]);

  return { customTestCases, handleAdd, handleDelete, handleUpdate };
}
