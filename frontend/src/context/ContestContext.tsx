"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface Participant {
  name: string;
  rank: number;
  dept: string;
  section: string;
  year: string;
  no_of_questions: number;
  finish_time: string;
}

interface ContestAnalysisData {
  name: string;
  date: string;
  type: string;
  topPerformers: Participant[];
  allParticipants: Participant[]; // ✅ Added all participants
  participation: { newCount: number; previousCount: number; trend: string };
  averageRank: { newAvg: number; previousAvg: number; trend: string };
}

interface ContestAnalysisResponse {
  contests: {
    Leetcode: ContestAnalysisData[];
    Codechef: ContestAnalysisData[];
    Codeforces: ContestAnalysisData[];
  };
}

interface ContestContextType {
  contests: ContestAnalysisData[];
  selectedContest: ContestAnalysisData | null;
  setSelectedContest: (contest: ContestAnalysisData | null) => void;
  isLoading: boolean;
}

const ContestContext = createContext<ContestContextType | undefined>(undefined);

export function ContestProvider({ children }: { children: ReactNode }) {
  const [contests, setContests] = useState<ContestAnalysisData[]>([]);
  const [selectedContest, setSelectedContest] = useState<ContestAnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchContests = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/contest-analysis");
        const data: ContestAnalysisResponse = await res.json();
        console.log(data);

        const allContests: ContestAnalysisData[] = [
          ...data.contests.Leetcode,
          ...data.contests.Codechef,
          ...data.contests.Codeforces,
        ];

        setContests(allContests);

        // Set default contest to Leetcode, otherwise pick the first available contest
        const leetcodeContest = allContests.find((c) => c.type === "Leetcode");
        setSelectedContest(leetcodeContest || allContests[0] || null);
      } catch (error) {
        console.error("Error fetching contest analysis:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchContests();
  }, []);

  return (
    <ContestContext.Provider value={{ contests, selectedContest, setSelectedContest, isLoading }}>
      {children}
    </ContestContext.Provider>
  );
}

export function useContest() {
  const context = useContext(ContestContext);
  if (!context) {
    throw new Error("useContest must be used within a ContestProvider");
  }
  return context;
}
