"use client";

import React from "react";
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { Line } from "react-chartjs-2";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContestAnalysisData } from "../context/ContestContext";
import { TrendingUp, Users, Calendar } from "lucide-react";

// Register necessary Chart.js components
ChartJS.register(
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  Filler,
  ChartDataLabels,
);

interface Props {
  contests: ContestAnalysisData[];
}

export default function ContestTrendChart({ contests }: Props) {
  const sortedContests = [...contests].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const lastContests = sortedContests.slice(-5);
  
  const labels = lastContests.map((c) => c.name);
  const attendanceData = lastContests.map((contest) => {
    const total = contest.allParticipants.length;
    const attended = contest.allParticipants.filter((p) => p.rank > 0).length;
    return total ? Math.round((attended / total) * 100) : 0;
  });

  // Calculate trend stats
  const avgAttendance = attendanceData.length > 0 
    ? Math.round(attendanceData.reduce((a, b) => a + b, 0) / attendanceData.length)
    : 0;
  
  const trend = attendanceData.length >= 2
    ? attendanceData[attendanceData.length - 1] - attendanceData[0]
    : 0;

  const chartData = {
    labels,
    datasets: [
      {
        label: "Attendance (%)",
        data: attendanceData,
        borderColor: "#6366f1", // indigo-500
        backgroundColor: "rgba(99, 102, 241, 0.1)", // indigo-500 with low opacity
        fill: true,
        tension: 0.4,
        pointRadius: 6,
        pointHoverRadius: 8,
        pointBackgroundColor: "#6366f1",
        pointBorderColor: "#ffffff",
        pointBorderWidth: 2,
        pointHoverBackgroundColor: "#4f46e5",
        pointHoverBorderColor: "#ffffff",
        pointHoverBorderWidth: 3,
        borderWidth: 3,
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
        grid: {
          display: false,
        },
        border: {
          display: false,
        },
        ticks: {
          color: '#6b7280', // gray-500
          font: {
            size: 12,
            weight: '500' as const,
          },
          maxRotation: 45,
        },
      },
      y: {
        beginAtZero: true,
        max: 100,
        grid: {
          color: 'rgba(156, 163, 175, 0.2)', // gray-400 with opacity
          drawBorder: false,
        },
        border: {
          display: false,
        },
        ticks: {
          color: '#6b7280', // gray-500
          font: {
            size: 12,
            weight: '500' as const,
          },
          callback: (val: any) => `${val}%`,
          stepSize: 20,
        },
      },
    },
    plugins: {
      tooltip: {
        enabled: true,
        backgroundColor: 'rgba(17, 24, 39, 0.95)', // gray-900 with opacity
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
          title: (context: any) => context[0].label,
          label: (context: any) => `Attendance: ${context.parsed.y}%`,
        },
      },
      legend: {
        display: false,
      },
      datalabels: {
        anchor: "end",
        align: "top",
        formatter: (value: number) => `${value}%`,
        font: {
          weight: "bold",
          size: 12,
        },
        color: "#000",
      },
    },
    elements: {
      line: {
        capBezierPoints: false,
      },
    },
  };

  return (
    <Card className="w-full border-0 bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
              <TrendingUp className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Contest Attendance Trend
              </CardTitle>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Performance across last 5 contests
              </p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="relative">
          {attendanceData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[300px] space-y-4">
              <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full">
                <Calendar className="h-8 w-8 text-gray-400" />
              </div>
              <div className="text-center">
                <p className="text-gray-600 dark:text-gray-400 font-medium">
                  No contest data available
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                  Start participating in contests to see your attendance trends
                </p>
              </div>
            </div>
          ) : (
            <div className="h-[320px] relative">
              <Line data={chartData} options={options} />
              <div className="absolute top-0 left-0 w-full h-full pointer-events-none bg-gradient-to-t from-transparent via-transparent to-white/20 dark:to-gray-900/20 rounded-lg"></div>
            </div>
          )}
        </div>
        
      </CardContent>
    </Card>
  );
}
