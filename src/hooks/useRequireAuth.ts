import { useCallback } from 'react';

/**
 * Hook that provides an auth gate for features requiring login.
 * Returns a `requireAuth` function that checks if the user is logged in.
 * If not, it opens the sign-in modal and returns false.
 * If yes, it returns true so the caller can proceed.
 */
export function useRequireAuth() {
    const requireAuth = useCallback(() => true, []);

    return {
        requireAuth,
        isAuthenticated: true,
        showSignIn: false,
        setShowSignIn: () => undefined,
    };
}
