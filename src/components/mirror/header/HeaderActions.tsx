"use client";

import { useEffect, useState } from "react";
import { Settings, Flame } from "lucide-react";
import { TimerDropdown } from "./TimerDropdown";
import { SettingsModal } from "./SettingsModal";
import { Tooltip } from "@/components/ui/Tooltip";

export function HeaderActions() {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [streak, setStreak] = useState<number | null>(null);

    useEffect(() => {
        // Streaks were part of the removed account service. Keep a local value
        // so the header remains stable while the workspace is anonymous.
        setStreak(Number(window.localStorage.getItem("verdict-streak") || 0));

        const handleToggle = () => setIsSettingsOpen(prev => !prev);
        window.addEventListener('verdict:toggle-settings', handleToggle);
        return () => window.removeEventListener('verdict:toggle-settings', handleToggle);
    }, []);

    return (
        <div className="hidden md:flex items-center gap-1 shrink-0 text-white/60" id="onboarding-header-actions">
            <Tooltip content="Settings" shortcut={["Alt", "S"]} position="bottom">
                <button
                    onClick={() => setIsSettingsOpen(true)}
                    className="w-12 h-8 flex items-center justify-center hover:bg-[#282828] rounded-md transition-colors"
                >
                    <Settings size={18} />
                </button>
            </Tooltip>
            <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
            <Tooltip content={streak !== null ? `${streak} day streak` : "Streak"} position="bottom">
                <div
                    onClick={() => undefined}
                    className={`flex items-center gap-2 px-3.5 h-8 hover:bg-[#282828] rounded-md transition-colors cursor-pointer ${streak && streak > 0 ? "text-[#10B981]" : "text-white/60"}`}
                >
                    <Flame size={18} fill={streak && streak > 0 ? "currentColor" : "none"} />
                    <span className="text-[13px] font-bold">{streak !== null ? streak : "0"}</span>
                </div>
            </Tooltip>
            <div className="flex items-center rounded-md h-8 overflow-hidden ml-1 bg-[#282828]">
                <Tooltip content="Session Timer" position="bottom"><TimerDropdown /></Tooltip>
            </div>
        </div>
    );
}
