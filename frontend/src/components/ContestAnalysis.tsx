"use client";

import { useState, useEffect } from "react";
import { useContest } from "../context/ContestContext";
import { Calendar } from "lucide-react";
import ContestSelector from "./ContestSelector";
import Podium from "./Podium";
import Trends from "./Trends";

export default function ContestAnalysis() {
  const { contests, selectedContest, setSelectedContest, isLoading } = useContest();
  const platforms = Array.from(new Set(contests.map((c) => c.type)));

  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);

  function toTitleCase(str: string): string {
    return str.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  }

  // Set the latest LeetCode contest as default when the component mounts
  useEffect(() => {
    const latestLeetCodeContest = contests
      .filter((contest) => contest.type === "LeetCode")
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

    if (latestLeetCodeContest) {
      setSelectedContest(latestLeetCodeContest);
      setSelectedPlatform(latestLeetCodeContest.type);
    }
  }, [contests, setSelectedContest]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header Section */}
      {selectedContest && (
        <div className="w-full text-center my-8">
          <h1 className="text-4xl font-bold text-black pt-5">
            {toTitleCase(selectedContest.name)}
          </h1>
          <p className="text-gray-600 text-lg mt-2 flex justify-center">
            <Calendar className="w-5 h-5 mr-1 mt-1" />
            {new Date(selectedContest.date).toLocaleDateString("en-US", {
              month: "long",
              day: "2-digit",
              year: "numeric",
            })}{" "}
            • {selectedContest.type}
          </p>
        </div>
      )}

      {/* Contest Carousel */}
      <ContestSelector  />

      {/* Podium & Trends */}
      <Podium selectedContest={selectedContest} />
      <Trends selectedContest={selectedContest} toTitleCase={toTitleCase} />
    </div>
  );
}
