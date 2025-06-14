"use client";

import { ArrowUpCircle, ArrowDownCircle, MinusCircle, BarChart } from "lucide-react";

interface TrendProps {
  selectedContest: {
    name: string;
    type: string;
    participation?: { newCount: number; previousCount: number; trend: string };
    averageRank?: { newAvg: number; previousAvg: number; trend: string };
  } | null;
  toTitleCase: Function;
}

const Trends = ({ selectedContest, toTitleCase }: TrendProps) => {
  if (!selectedContest) {
    return (
      <div className="text-center p-6 bg-blue-50 rounded-lg shadow-md">
        <p className="text-gray-600">No contest selected.</p>
      </div>
    );
  }

  const { participation, averageRank } = selectedContest;

  if (!participation || !averageRank) {
    return (
      <div className="text-center p-6 bg-blue-50 rounded-lg shadow-md">
        <p className="text-gray-600">Insufficient data for this contest.</p>
      </div>
    );
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "increased":
        return <ArrowUpCircle className="text-green-500 w-5 h-5" />;
      case "decreased":
        return <ArrowDownCircle className="text-red-500 w-5 h-5" />;
      default:
        return <MinusCircle className="text-gray-500 w-5 h-5" />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case "increased":
        return "text-green-600";
      case "decreased":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center mb-6">
        <BarChart className="text-blue-600 w-6 h-6 mr-2" />
        <h2 className="text-2xl font-bold text-gray-800">Contest Trends</h2>
      </div>

      <div className="bg-gray-50 rounded-lg p-4 hover:shadow-md transition-shadow border border-gray-100">
        <h3 className="font-bold text-gray-800 mb-2 truncate">
          {selectedContest.type === "Leetcode" 
            ? toTitleCase(selectedContest.name)
            : selectedContest.name
          } <span className="text-gray-500 text-sm">({selectedContest.type})</span>
        </h3>

        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center">
            <span className="text-gray-600 text-sm mr-1">Avg Rank:</span>
            <span className="font-semibold">{averageRank.newAvg.toFixed(1)}</span>
          </div>
          <div className="flex items-center">
            <span className="text-gray-600 text-sm mr-1">Participants:</span>
            <span className="font-semibold">{participation.newCount}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 mt-4">
          <div className="flex items-center justify-between p-2 bg-white rounded border border-gray-200">
            <span className="text-sm text-gray-600">Participation</span>
            <div className="flex items-center">
              <span className={`text-sm font-medium ${getTrendColor(participation.trend)}`}>
                {participation.trend === "increased" ? "Increasing" : participation.trend === "decreased" ? "Decreasing" : "Stable"}
              </span>
              <span className="ml-1">{getTrendIcon(participation.trend)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-2 bg-white rounded border border-gray-200">
            <span className="text-sm text-gray-600">Rank Trend</span>
            <div className="flex items-center">
              <span className={`text-sm font-medium ${getTrendColor(averageRank.trend)}`}>
                {averageRank.trend === "increased" ? "Improving" : averageRank.trend === "decreased" ? "Declining" : "Stable"}
              </span>
              <span className="ml-1">{getTrendIcon(averageRank.trend)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Trends;

