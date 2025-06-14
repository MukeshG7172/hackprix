"use client";

import React, { useMemo } from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Users, Target, Award, TrendingUp } from "lucide-react";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ChartDataLabels);

interface Participant {
  name: string;
  rank: number;
  dept: string;
  section: string;
  year: string;
  no_of_questions: number;
  finish_time: string;
}

interface Props {
  contest: {
    type: string; // "Leetcode" | "Codechef" | "Codeforces"
    allParticipants: Participant[];
  };
  filters: {
    department?: string;
    section?: string;
    batch?: string;
  };
}

const CountChart: React.FC<Props> = ({ contest, filters }) => {
  const { type, allParticipants } = contest;

  // Apply filters on participants
  const filteredParticipants = useMemo(() => {
    return allParticipants.filter((p) => {
      return (
        (!filters.department || filters.department === "All" || p.dept === filters.department) &&
        (!filters.section || filters.section === "All" || p.section === filters.section) &&
        (!filters.batch || filters.batch === "All" || p.year === filters.batch)
      );
    });
  }, [allParticipants, filters]);

  // Determine maxQuestions based on platform and contest
  const maxQuestions = useMemo(() => {
    if (type === "Leetcode") {
      return 4; // fixed for Leetcode
    } else {
      return allParticipants.length > 0
        ? Math.max(...allParticipants.map((p) => p.no_of_questions))
        : 0;
    }
  }, [type, allParticipants]);

  // Count how many participants solved how many questions
  const questionCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    filteredParticipants.forEach((p) => {
      counts[p.no_of_questions] = (counts[p.no_of_questions] || 0) + 1;
    });

    // Prepare data array from 0 to maxQuestions
    const dataArray: number[] = [];
    for (let i = 0; i <= maxQuestions; i++) {
      dataArray.push(counts[i] || 0);
    }
    return dataArray;
  }, [filteredParticipants, maxQuestions]);

  // Calculate statistics
  const totalParticipants = filteredParticipants.length;
  const avgQuestionsPerParticipant = useMemo(() => {
    if (totalParticipants === 0) return 0;
    const totalQuestions = filteredParticipants.reduce((sum, p) => sum + p.no_of_questions, 0);
    return Math.round((totalQuestions / totalParticipants) * 10) / 10;
  }, [filteredParticipants, totalParticipants]);

  const highestScore = useMemo(() => {
    if (filteredParticipants.length === 0) return 0;
    return Math.max(...filteredParticipants.map(p => p.no_of_questions));
  }, [filteredParticipants]);

  const participantsWithFullScore = useMemo(() => {
    return filteredParticipants.filter(p => p.no_of_questions === maxQuestions).length;
  }, [filteredParticipants, maxQuestions]);

  // Generate gradient colors for bars
  const generateBarColors = (count: number) => {
    const colors = [];
    const backgroundColors = [];
    
    for (let i = 0; i <= maxQuestions; i++) {
      const intensity = Math.min(1, (i / maxQuestions) * 0.8 + 0.2);
      colors.push(`rgba(99, 102, 241, ${intensity})`); // indigo with varying intensity
      backgroundColors.push(`rgba(99, 102, 241, ${intensity * 0.3})`);
    }
    
    return { colors, backgroundColors };
  };

  const { colors, backgroundColors } = generateBarColors(maxQuestions);

  // If no participants after filtering, show message
  if (filteredParticipants.length === 0) {
    return (
      <Card className="w-full border-0 shadow-lg bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50">
        <CardHeader>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Question Distribution
              </CardTitle>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {type} contest performance breakdown
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-[300px] space-y-4">
            <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full">
              <Users className="h-8 w-8 text-gray-400" />
            </div>
            <div className="text-center">
              <p className="text-gray-600 dark:text-gray-400 font-medium">
                No participants match the selected filters
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                Try adjusting your filters to see participant data
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // If all counts are zero (no questions solved), show message
  if (questionCounts.every((count) => count === 0)) {
    return (
      <Card className="w-full border-0 shadow-lg bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50">
        <CardHeader>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Question Distribution
              </CardTitle>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {type} contest performance breakdown
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-[300px] space-y-4">
            <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full">
              <Target className="h-8 w-8 text-gray-400" />
            </div>
            <div className="text-center">
              <p className="text-gray-600 dark:text-gray-400 font-medium">
                No questions were solved
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                Participants data shows zero questions solved
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const data = {
    labels: Array.from({ length: maxQuestions + 1 }, (_, i) => i.toString()),
    datasets: [
      {
        label: "Number of Participants",
        data: questionCounts,
        backgroundColor: backgroundColors,
        borderColor: colors,
        borderWidth: 2,
        borderRadius: 6,
        borderSkipped: false,
        hoverBackgroundColor: colors,
        hoverBorderColor: colors.map(color => color.replace('241', '224')), // lighter on hover
        hoverBorderWidth: 3,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
    scales: {
      x: {
        title: {
          display: true,
          text: "Questions Solved",
          color: '#6b7280',
          font: {
            size: 14,
            weight: '600' as const,
          },
        },
        grid: {
          display: false,
        },
        border: {
          display: false,
        },
        ticks: {
          color: '#6b7280',
          font: {
            size: 12,
            weight: '500' as const,
          },
        },
      },
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: "Number of Participants",
          color: '#6b7280',
          font: {
            size: 14,
            weight: '600' as const,
          },
        },
        grid: {
          color: 'rgba(156, 163, 175, 0.2)',
          drawBorder: false,
        },
        border: {
          display: false,
        },
        ticks: {
          color: '#6b7280',
          font: {
            size: 12,
            weight: '500' as const,
          },
          stepSize: 1,
        },
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        enabled: true,
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        borderColor: '#6366f1',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: false,
        titleFont: {
          size: 14,
          weight: '600' as const,
        },
        bodyFont: {
          size: 13,
          weight: '500' as const,
        },
        padding: 12,
        callbacks: {
          title: (context: any) => `${context[0].label} Questions Solved`,
          label: (context: any) => `${context.parsed.y} participants`,
        },
      },
      datalabels: {
        anchor: 'end' as const,
        align: 'top' as const,
        formatter: (value: number) => value > 0 ? value : '',
        font: {
          weight: '600' as const,
          size: 11,
        },
        color: '#374151',
        // display: (context: any) => context.parsed.y > 0,
      },
    },
  };

  return (
    <Card className="w-full border-0 bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Question Distribution
              </CardTitle>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {type} contest performance breakdown
              </p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="h-[360px] relative">
          <Bar data={data} options={options} />
          <div className="absolute top-0 left-0 w-full h-full pointer-events-none bg-gradient-to-t from-transparent via-transparent to-white/10 dark:to-gray-900/10 rounded-lg"></div>
        </div>
        
      </CardContent>
    </Card>
  );
};

export default CountChart;
