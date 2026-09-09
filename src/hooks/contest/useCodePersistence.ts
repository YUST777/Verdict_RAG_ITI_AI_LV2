import { useEffect, useRef, useState } from 'react';

const DEFAULT_CODE = `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios_base::sync_with_stdio(0); cin.tie(0);
    
    return 0;
}
`;

interface UseCodePersistenceParams {
  contestId: string;
  problemId: string;
}

interface UseCodePersistenceReturn {
  code: string;
  setCode: (code: string) => void;
  language: string;
  setLanguage: (lang: string) => void;
}

/** Persist editor state locally; the stripped app has no account or workspace API. */
export function useCodePersistence({ contestId, problemId }: UseCodePersistenceParams): UseCodePersistenceReturn {
  const safeContestId = Array.isArray(contestId) ? contestId[0] : contestId;
  const safeProblemId = Array.isArray(problemId) ? problemId[0] : problemId;
  // v2 intentionally starts clean after the retired tutor used to persist
  // unverified model output (for example, min-cut code on Watermelon 4A).
  // Keeping the old namespace would reload that stale submission after every
  // deployment, even though the active panel no longer generates editor code.
  const storageKeyCode = `verdict-code-v2-${safeContestId}-${safeProblemId}`;
  const storageKeyLang = `verdict-lang-v2-${safeContestId}-${safeProblemId}`;
  const [code, setCode] = useState(DEFAULT_CODE);
  const [language, setLanguage] = useState('cpp');
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!contestId || !problemId || typeof window === 'undefined') return;
    try {
      const savedCode = window.localStorage.getItem(storageKeyCode);
      const savedLanguage = window.localStorage.getItem(storageKeyLang);
      if (savedCode) setCode(savedCode);
      if (savedLanguage) setLanguage(savedLanguage);
    } catch {
      // Ignore storage restrictions and keep the editor usable.
    }
    loadedRef.current = true;
  }, [contestId, problemId, storageKeyCode, storageKeyLang]);

  useEffect(() => {
    if (!loadedRef.current || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(storageKeyCode, code);
      window.localStorage.setItem(storageKeyLang, language);
    } catch {
      // Ignore quota/private-mode failures; editing still works in memory.
    }
  }, [code, language, storageKeyCode, storageKeyLang]);

  return { code, setCode, language, setLanguage };
}
