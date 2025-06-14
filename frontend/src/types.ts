export interface ContestAnalysisData {
  name: string;
  type: "Leetcode" | "Codechef" | "Codeforces";
  date: string;
  leaderboard: LeaderboardEntry[];
}

export interface LeaderboardEntry {
  name: string;
  rank: number;
  score: number;
}
