import React from 'react';
import { CFProblemData } from '../shared/types';
import { CFProblemDescription } from './CFProblemDescription';
import ProblemTabs from './ProblemTabs';
import AIAgentPanel from '../ai/AIAgentPanel';
import ProblemNotes from './ProblemNotes';


interface ProblemLeftPanelProps {
    activeTab: 'description' | 'solution';
    setActiveTab: (tab: 'description' | 'solution') => void;
    cfData: CFProblemData | null;
    cfStats: { rating?: number; solvedCount: number; tags?: string[] } | null;
    contestId: string;
    problemId: string;
    leftPanelRef: React.RefObject<HTMLDivElement>;
    lastWidth: React.MutableRefObject<number>;
    mobileView: 'problem' | 'code';
    userCode: string;
    language: string;
    onSolveProblem?: () => void;
    isGeneratingSolution?: boolean;
    selectedCode?: string;
    aiInitialQuestion?: string;
    onClearSelection?: () => void;
    selectedLineReference?: string;
    onAiCodeUpdate?: (code: string) => void;
    onSwitchToAiTab?: () => void;
    autoStart?: boolean;
    showNotes?: boolean;
    setShowNotes?: (show: boolean) => void;
    onQuizMe?: () => void;
    quizMode?: boolean;
}

export default React.memo(function ProblemLeftPanel({
    activeTab,
    setActiveTab,
    cfData,
    cfStats,
    contestId,
    problemId,
    leftPanelRef,
    lastWidth,
    mobileView,
    userCode,
    language,
    onSolveProblem,
    isGeneratingSolution,
    selectedCode,
    aiInitialQuestion,
    onClearSelection,
    selectedLineReference,
    ...otherProps
}: ProblemLeftPanelProps) {
    const safeContestId = Array.isArray(contestId) ? contestId[0] : contestId;
    const safeProblemId = Array.isArray(problemId) ? problemId[0] : problemId;

    return (
        <div
            ref={leftPanelRef}
            id="onboarding-left-panel"
            className={`problem-panel flex flex-col bg-[#121212] ${mobileView === 'code' ? 'hidden md:flex md:w-0 md:flex-none' : 'flex w-full md:w-[var(--panel-width)] md:flex-none'} min-w-0 h-full overflow-hidden`}
            data-lenis-prevent="true"
            style={{
                '--panel-width': `${lastWidth.current}%`,
                willChange: 'width, flex-basis',
                WebkitOverflowScrolling: 'touch'
            } as React.CSSProperties}
        >
            <ProblemTabs
                activeTab={activeTab}
                setActiveTab={(tab) => {
                    setActiveTab(tab);
                    // UX: Automatically switch the editor to AI mode when opening the AI Tutor tab
                    if (tab === 'solution' && (otherProps as any).onSwitchToAiTab) {
                        (otherProps as any).onSwitchToAiTab();
                    }
                }}
            />

            <div className="flex-1 min-h-0 flex flex-col relative">
                {activeTab === 'description' && (
                    <div
                        className="absolute inset-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-4 sm:space-y-6 custom-scrollbar"
                        data-lenis-prevent="true"
                    >
                        {cfData && <CFProblemDescription data={cfData} />}
                    </div>
                )}
                {/* Keep AIAgentPanel mounted but hidden when inactive to allow auto-start and ghost typing */}
                <div
                    className={`absolute inset-0 ${activeTab === 'solution' ? 'flex flex-col' : 'hidden'}`}
                    data-lenis-prevent="true"
                >
                    <AIAgentPanel
                        isActive={activeTab === 'solution'}
                        onSolveProblem={onSolveProblem}
                        onAiCodeUpdate={otherProps.onAiCodeUpdate}
                        onSwitchToAiTab={otherProps.onSwitchToAiTab}
                        isLoading={isGeneratingSolution}
                        selectedCode={selectedCode}
                        userCode={userCode}
                        language={language}
                        problemDescription={cfData ? (() => {
                            let desc = `**Problem: ${cfData.meta.title}**\n\n`;
                            desc += `${cfData.story}\n\n`;
                            if (cfData.inputSpec) {
                                desc += `**Input Format:**\n${cfData.inputSpec}\n\n`;
                            }
                            if (cfData.outputSpec) {
                                desc += `**Output Format:**\n${cfData.outputSpec}\n\n`;
                            }
                            if (cfData.testCases && cfData.testCases.length > 0) {
                                desc += `**Examples:**\n\n`;
                                cfData.testCases.slice(0, 3).forEach((tc, idx) => {
                                    desc += `Example ${idx + 1}:\n`;
                                    desc += `Input:\n${tc.input}\n`;
                                    desc += `Output:\n${tc.output}\n\n`;
                                });
                            }
                            if (cfData.note) {
                                desc += `**Note:**\n${cfData.note}\n\n`;
                            }
                            return desc;
                        })() : undefined}
                        testCases={cfData?.testCases?.map(tc => ({ input: tc.input, output: tc.output })) || []}
                        initialQuestion={aiInitialQuestion}
                        codeforcesRating={cfStats?.rating}
                        problemTags={cfData?.tags || []}
                        problemDifficulty={cfData?.meta?.difficulty?.toString()}
                        onSelectionCleared={onClearSelection}
                        selectedLineReference={selectedLineReference}
                        autoStart={otherProps.autoStart}
                        problemId={`${safeContestId}-${safeProblemId}`}
                        onQuizMe={otherProps.onQuizMe}
                        quizMode={otherProps.quizMode}
                    />
                </div>

                {/* Notes Overlay */}
                {otherProps.showNotes && (
                    <div
                        className="absolute inset-0 z-50 overflow-hidden flex flex-col bg-[#121212]"
                        data-lenis-prevent="true"
                    >
                        <ProblemNotes
                            contestId={safeContestId}
                            problemIndex={safeProblemId}
                        />
                    </div>
                )}
            </div>
        </div>
    );
});
