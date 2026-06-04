import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ChatMessage, AnalysisResult, AppMode } from "./appStore";

export interface HistorySession {
  id: string;
  title: string;
  timestamp: number;
  mode: AppMode;
  messages: ChatMessage[];
  // File data
  filePath?: string;
  fileAnalysis?: AnalysisResult | null;
}

interface HistoryStore {
  sessions: HistorySession[];
  saveSession: (session: Omit<HistorySession, "id" | "timestamp">) => void;
  deleteSession: (id: string) => void;
  clearHistory: () => void;
}

export const useHistoryStore = create<HistoryStore>()(
  persist(
    (set) => ({
      sessions: [],
      
      saveSession: (sessionData) => set((state) => {
        // Avoid saving empty sessions
        if (sessionData.messages.length === 0) return state;

        const newSession: HistorySession = {
          ...sessionData,
          id: `session-${Date.now()}`,
          timestamp: Date.now(),
        };
        
        return {
          sessions: [newSession, ...state.sessions].slice(0, 50) // Keep last 50
        };
      }),

      deleteSession: (id) => set((state) => ({
        sessions: state.sessions.filter(s => s.id !== id)
      })),

      clearHistory: () => set({ sessions: [] })
    }),
    {
      name: "mixmind-history",
    }
  )
);
