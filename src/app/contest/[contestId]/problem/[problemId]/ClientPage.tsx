"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { OnMount } from "@monaco-editor/react";
import { AlertCircle } from "lucide-react";
import { ProblemHeader } from "@/components/mirror/problem";
import { CodeWorkspace } from "@/components/mirror/editor";
import { ProblemLeftPanel } from "@/components/mirror/problem";
import ProblemDrawer, { ActiveSheet } from "@/components/mirror/problem/ProblemDrawer";
import ExtensionGate from "@/components/core/ExtensionGate";
import Link from "next/link";
import OnboardingTour from "@/components/mirror/OnboardingTour";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { TestCasesLoader } from "@/components/ui/TestCasesLoader";

// Custom Hooks
import { useProblemData } from "@/hooks/contest/useProblemData";
import { useCodePersistence } from "@/hooks/contest/useCodePersistence";
import { useCustomTestCases } from "@/hooks/contest/useCustomTestCases";
import { useResizableLayout } from "@/hooks/contest/useResizableLayout";
import { useCodeforcesSubmission } from "@/hooks/contest/useCodeforcesSubmission";
import { useLocalTestRunner } from "@/hooks/contest/useLocalTestRunner";

// Utils
import { getNavigationBaseUrl } from "@/lib/codeforcesUtils";

interface CodeforcesMirrorPageProps {
    forcedType?: string;
}

export default function CodeforcesMirrorPage({ forcedType }: CodeforcesMirrorPageProps = {}) {
    const params = useParams();
    const searchParams = useSearchParams();

    // Extract standard params
    const contestId = params.contestId as string;
    const problemId = params.problemId as string;
    const groupId = params.groupId as string;
    // Determine URL type with smart fallback
    let urlType = forcedType || searchParams.get("type") || "contest";
    const numericContestId = parseInt(contestId);
    if (urlType === "contest" && !isNaN(numericContestId) && numericContestId >= 100000) {
        urlType = "gym";
    }

    // Problem Data Hook
    const { problem, cfData, loading, error, cfStats, sampleTestCases } = useProblemData({
        contestId,
        problemId,
        urlType,
        groupId,
    });

    // Code Persistence Hook
    const { code, setCode, language, setLanguage } = useCodePersistence({ contestId, problemId });

    // Custom Test Cases Hook
    const sampleTestCasesCount = sampleTestCases.length;
    const { customTestCases, handleAdd: handleAddTestCase, handleDelete: handleDeleteTestCase, handleUpdate: handleUpdateTestCase } = useCustomTestCases({
        contestId,
        problemId,
        sampleTestCasesCount,
    });

    // Combined test cases
    const testCases = [...sampleTestCases, ...customTestCases];

    // Layout Hooks
    const { containerRef, leftPanelRef, handleMouseDown, lastWidth } = useResizableLayout();

    const [isTestPanelVisible, setIsTestPanelVisible] = useState(false);
    const [testPanelActiveTab, setTestPanelActiveTab] = useState<"testcase" | "result" | "codeforces">("testcase");
    const { requireAuth } = useRequireAuth();

    // Tab State
    const [activeTab, setActiveTab] = useState<"description" | "solution">("description");

    // All workspace features are available in local guest mode.
    const gatedSetActiveTab = useCallback((tab: "description" | "solution") => {
        if (tab === "solution" && !requireAuth()) return;
        setActiveTab(tab);
    }, [requireAuth]);

    // The launcher can deep-link directly into the grounded tutor tab.
    useEffect(() => {
        if (searchParams.get("focus") === "ai") {
            setActiveTab("solution");
            setCodeTab("ai");
        }
    }, [searchParams]);
    const [mobileView, setMobileView] = useState<"problem" | "code">("problem");

    // Notes state
    const [showNotes, setShowNotes] = useState(false);

    // ─── Problem Drawer state (replaces SidebarTabs) ───
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [activeSheet, setActiveSheet] = useState<ActiveSheet | null>(null);

    // AI Code State
    const [aiCode, setAiCode] = useState<string>("");
    const [codeTab, setCodeTab] = useState<"human" | "ai">("human");
    const [isGeneratingSolution, setIsGeneratingSolution] = useState(false);
    const [selectedCode, setSelectedCode] = useState<string>("");
    const [aiInitialQuestion, setAiInitialQuestion] = useState<string>("");
    const [selectedLineReference, setSelectedLineReference] = useState<string>("");

    // Reset UI State on Navigation (Prevent Ghost State)
    useEffect(() => {
        setActiveTab("description");
        setIsTestPanelVisible(false);
        setTestPanelActiveTab("testcase");
        // Reset AI state
        setAiCode("");
        setCodeTab("human");
        setIsGeneratingSolution(false);
        setSelectedCode("");
        setAiInitialQuestion("");
        setSelectedLineReference("");
        setShowNotes(false);
    }, [contestId, problemId]);

    // Switch back to human editor when leaving AI tutor tab
    useEffect(() => {
        if (activeTab !== "solution" && codeTab === "ai") {
            setCodeTab("human");
        }
    }, [activeTab, codeTab]);

    // Editor Ref
    const editorRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any

    const handleEditorDidMount: OnMount = (editor) => {
        editorRef.current = editor;
    };

    // Determine which code to execute (User vs AI)
    const codeToExecute = codeTab === "ai" ? aiCode : code;

    // Submission Hooks
    const { cfStatus, handleSubmit, submitting: cfSubmitting } = useCodeforcesSubmission({
        code: codeToExecute,
        language,
        contestId,
        problemId,
        urlType,
        groupId,
        setIsTestPanelVisible,
        setTestPanelActiveTab,
        problemRating: cfStats?.rating,
        problemTags: cfData?.tags,
        problemName: cfData?.meta?.title,
    });

    const { result, runTests, submitting: testSubmitting } = useLocalTestRunner({
        code: codeToExecute,
        language,
        testCases,
        timeLimit: cfData?.meta.timeLimitMs || 2000,
        memoryLimit: cfData?.meta.memoryLimitMB || 256,
        setIsTestPanelVisible,
        contestId,
        problemId,
    });

    const submitting = cfSubmitting || testSubmitting;

    // Action wrappers keep the original component contracts while local mode is anonymous.
    const gatedSubmit = useCallback(async () => {
        if (!requireAuth()) return;
        return handleSubmit();
    }, [requireAuth, handleSubmit]);

    const gatedRunTests = useCallback(() => {
        if (!requireAuth()) return;
        return runTests();
    }, [requireAuth, runTests]);

    const gatedSetShowNotes = useCallback((val: boolean | ((prev: boolean) => boolean)) => {
        if (typeof val === 'function' ? true : val) {
            if (!requireAuth()) return;
        }
        setShowNotes(val);
    }, [requireAuth]);

    // AI action handlers
    const handleAskAboutCode = (code: string, lineReference?: string) => {
        if (!requireAuth()) return;
        setSelectedCode(code);
        setSelectedLineReference(lineReference || "");
        setAiInitialQuestion("");
        setActiveTab("solution");
    };

    const handleExplainLine = (lineNumber: number, lineCode: string) => {
        if (!requireAuth()) return;
        setSelectedCode(lineCode);
        setAiInitialQuestion(`Explain line ${lineNumber}:\n\`\`\`${language}\n${lineCode}\n\`\`\``);
        setActiveTab("solution");
    };

    const handleExplainFunction = (functionCode: string) => {
        if (!requireAuth()) return;
        setSelectedCode(functionCode);
        setAiInitialQuestion(`Explain this function:\n\`\`\`${language}\n${functionCode}\n\`\`\``);
        setActiveTab("solution");
    };

    const handleOptimizeCode = (codeToOptimize: string) => {
        if (!requireAuth()) return;
        setSelectedCode(codeToOptimize);
        setAiInitialQuestion(`How can I optimize this code? Also analyze its time and space complexity:\n\`\`\`${language}\n${codeToOptimize}\n\`\`\``);
        setActiveTab("solution");
    };

    const handleFindBugs = (codeToAnalyze: string) => {
        if (!requireAuth()) return;
        setSelectedCode(codeToAnalyze);
        setAiInitialQuestion(`Find potential bugs or issues in this code:\n\`\`\`${language}\n${codeToAnalyze}\n\`\`\``);
        setActiveTab("solution");
    };

    const handleClearSelection = () => {
        setSelectedCode("");
        setAiInitialQuestion("");
        setSelectedLineReference("");
    };

    // Navigation Base URL
    const navigationBaseUrl = getNavigationBaseUrl(contestId, urlType, groupId);

    // ─── Global Keyboard Shortcuts ───
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            // Run Tests: Ctrl + '
            if (e.ctrlKey && e.key === "'") {
                e.preventDefault();
                if (!submitting) gatedRunTests();
            }
            // Submit: Ctrl + Enter
            else if (e.ctrlKey && e.key === "Enter") {
                e.preventDefault();
                if (!submitting && code.trim()) gatedSubmit();
            }
            // Notes: Alt + N
            else if (e.altKey && e.key.toLowerCase() === "n") {
                e.preventDefault();
                gatedSetShowNotes((prev: boolean) => !prev);
            }
            // Problem List: Alt + P
            else if (e.altKey && e.key.toLowerCase() === "p") {
                e.preventDefault();
                setIsDrawerOpen(prev => !prev);
            }
            // Full Screen: Alt + F
            else if (e.altKey && e.key.toLowerCase() === "f") {
                e.preventDefault();
                if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen().catch(() => {});
                } else {
                    document.exitFullscreen();
                }
            }
            // Settings: Alt + S
            else if (e.altKey && e.key.toLowerCase() === "s") {
                e.preventDefault();
                window.dispatchEvent(new Event('verdict:toggle-settings'));
            }
        };
        window.addEventListener("keydown", handleGlobalKeyDown);
        return () => window.removeEventListener("keydown", handleGlobalKeyDown);
    }, [submitting, code, gatedRunTests, gatedSubmit, gatedSetShowNotes]);

    // Loading State
    if (loading) {
        return (
            <div className="fixed inset-0 bg-[#0B0B0C] flex flex-col items-center justify-center z-50 gap-4">
                <TestCasesLoader customText="Mirroring from Codeforces..." />
            </div>
        );
    }

    // Error State
    if (error || !problem || !cfData) {
        return (
            <div className="min-h-screen bg-[#0B0B0C] flex items-center justify-center p-4">
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-8 text-center max-w-md">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-red-400 mb-2">Mirror Failed</h2>
                    <p className="text-white/60 mb-6">{error || "Problem not found"}</p>
                    <Link href="/" className="text-[#10B981] hover:underline">Return to Homepage</Link>
                </div>
            </div>
        );
    }

    return (
        <ExtensionGate>
            <OnboardingTour />
            <div className="fixed inset-0 bg-[#0B0B0C] text-[#DCDCDC] z-50 flex flex-row" style={{ zoom: 0.85 }}>
                {/* Problem Drawer (replaces SidebarTabs) */}
                <ProblemDrawer
                    isOpen={isDrawerOpen}
                    onClose={() => setIsDrawerOpen(false)}
                    currentContestId={contestId}
                    currentProblemId={problemId}
                    urlType={urlType}
                    groupId={groupId}
                    onSheetLoaded={(sheet) => setActiveSheet(sheet)}
                    sheet={activeSheet}
                />

                <div className="flex-1 flex flex-col min-w-0">
                    <ProblemHeader
                        sheetId={contestId as string}
                        problem={cfData}
                        mobileView={mobileView}
                        setMobileView={setMobileView}
                        navigationBaseUrl={navigationBaseUrl}
                        problemId={problemId}
                        onToggleSidebar={() => setIsDrawerOpen(!isDrawerOpen)}
                        onOpenDrawer={() => setIsDrawerOpen(true)}
                        sheetProblems={activeSheet?.problems}
                        onSubmit={gatedSubmit}
                        onRunTests={gatedRunTests}
                        submitting={submitting}
                        showNotes={showNotes}
                        setShowNotes={gatedSetShowNotes}
                    />

                    <div ref={containerRef} className="flex-1 flex overflow-hidden">
                        {/* Left Panel */}
                        <ProblemLeftPanel
                            activeTab={activeTab}
                            setActiveTab={gatedSetActiveTab}
                            cfData={cfData}
                            cfStats={cfStats}
                            contestId={contestId}
                            problemId={problemId}
                            leftPanelRef={leftPanelRef as any}
                            lastWidth={lastWidth}
                            mobileView={mobileView}
                            userCode={code}
                            language={language}
                            onAiCodeUpdate={(newCode) => {
                                setAiCode(newCode);
                            }}
                            onSwitchToAiTab={() => {
                                setCodeTab("ai");
                                if (window.innerWidth < 768) {
                                    setMobileView("code");
                                }
                            }}
                            isGeneratingSolution={isGeneratingSolution}
                            selectedCode={selectedCode}
                            aiInitialQuestion={aiInitialQuestion}
                            onClearSelection={handleClearSelection}
                            selectedLineReference={selectedLineReference}
                            showNotes={showNotes}
                            setShowNotes={gatedSetShowNotes}
                        />

                        {/* Resizer */}
                        <div
                            className="hidden md:block w-1 bg-white/5 hover:bg-[#10B981]/50 cursor-col-resize transition-colors relative group shrink-0"
                            onMouseDown={handleMouseDown}
                        >
                            <div className="absolute inset-y-0 -left-1 -right-1" />
                        </div>

                        {/* Right Panel (Workspace) */}
                        <CodeWorkspace
                            code={code}
                            setCode={setCode}
                            submitting={submitting}
                            onSubmit={gatedSubmit}
                            onRunTests={gatedRunTests}
                            handleEditorDidMount={handleEditorDidMount}
                            isTestPanelVisible={isTestPanelVisible}
                            setIsTestPanelVisible={setIsTestPanelVisible}
                            testCases={testCases}
                            result={result}
                            cfStatus={cfStatus}
                            mobileView={mobileView}
                            language={language}
                            setLanguage={setLanguage}
                            contestId={contestId}
                            problemId={problemId}
                            testPanelActiveTab={testPanelActiveTab}
                            setTestPanelActiveTab={setTestPanelActiveTab}
                            onAddTestCase={handleAddTestCase}
                            onDeleteTestCase={handleDeleteTestCase}
                            onUpdateTestCase={handleUpdateTestCase}
                            sampleTestCasesCount={sampleTestCasesCount}
                            aiCode={aiCode}
                            activeTab={codeTab}
                            setActiveTab={setCodeTab}
                            onAskAboutCode={handleAskAboutCode}
                            onExplainLine={handleExplainLine}
                            onExplainFunction={handleExplainFunction}
                            onOptimizeCode={handleOptimizeCode}
                            onFindBugs={handleFindBugs}
                            activeLeftPanelTab={activeTab}
                        />
                    </div>

                </div>
            </div>
        </ExtensionGate>
    );
}
