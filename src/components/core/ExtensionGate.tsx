'use client';

import type { ReactNode } from 'react';

interface ExtensionGateProps {
    children: ReactNode;
}

export default function ExtensionGate({ children }: ExtensionGateProps) {
    // The RAG workspace is self-contained. No browser extension or account is
    // required, so this wrapper intentionally stays a transparent boundary.
    return <>{children}</>;
}
