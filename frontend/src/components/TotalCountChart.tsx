"use client";

import React, { useEffect, useState } from "react";
import "chart.js/auto";
import ChartDataLabels from "chartjs-plugin-datalabels";
import getLeetCodeUserDetails from "../lib/leetcode/index";
import { ThreeDots } from "react-loader-spinner";
import { Doughnut } from "react-chartjs-2";
import "../app/globals.css";
import { ChartArea, ChartDataset, Chart as ChartJS } from "chart.js";

ChartJS.register(ChartDataLabels);

const hoverCenterTextChange = {
  id: "hoverCenterTextChange",
  beforeDraw: (chart: {
    ctx: CanvasRenderingContext2D;
    chartArea: ChartArea;
    config: any;
  }) => {
    const { ctx, chartArea, config } = chart;
    const { centerText } = config.options.plugins;

    if (centerText?.display) {
      const active = (chart as any).getActiveElements();
      const hoveredElement = active.length > 0 ? active[0] : null;

      let text = centerText.text;
      let color = centerText.color;
      if (hoveredElement) {
        const index = hoveredElement.index;
        const dataset = chart.config.data.datasets[0];
        const value = dataset.data[index];
        const difficulty =
          index === 0 ? "Easy" : index === 1 ? "Medium" : "Hard";
        color = index === 0 ? "#229954" : index === 1 ? "#9a7d0a" : "#C70039";
        text = `${difficulty}: ${value}`;
      }

      const centerX = (chartArea.left + chartArea.right) / 2;
      const centerY = (chartArea.top + chartArea.bottom) / 2;
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `${centerText.font.weight} ${centerText.font.size}px ${centerText.font.family}`;
      ctx.fillStyle = color;
      ctx.clearRect(centerX - 50, centerY - 20, 100, 40); // Clear previous text
      ctx.fillText(text, centerX, centerY);
      ctx.restore();
    }
  },
};

ChartJS.register(ChartDataLabels, hoverCenterTextChange);

interface TotalCountChartProps {
  username: string;
}

const TotalCountChart: React.FC<TotalCountChartProps> = ({ username }) => {
  const [chartData, setChartData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const data = await getLeetCodeUserDetails(username);

        if (data && data.problemsSolved.length > 0) {
          const difficulties = ["Easy", "Medium", "Hard"];
          const colors = ["#229954", "#FAC624", "#C70039"];

          const filteredData = difficulties
            .map((difficulty, index) => {
              const problemData = data.problemsSolved.find(
                (item: any) => item.difficulty === difficulty
              );
              return problemData && problemData.count > 0
                ? { count: problemData.count, color: colors[index], difficulty }
                : null;
            })
            .filter((item) => item !== null);

          const counts = filteredData.map((item) => item!.count);
          const filteredColors = filteredData.map((item) => item!.color);
          const filteredLabels = filteredData.map((item) => item!.difficulty);

          const totalCount = counts.reduce((acc, count) => acc + count, 0);

          setChartData({
            labels: filteredLabels,
            datasets: [
              {
                data: counts,
                backgroundColor: filteredColors,
                borderRadius: 8,
                borderWidth: 0,
                weight: 10,
              } as ChartDataset<"doughnut">,
            ],
            totalCount,
          });
        } else {
          setChartData(null);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        setChartData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [username]);

  if (loading) {
    return (
      <div className='flex justify-center items-center'>
        <ThreeDots
          visible={true}
          height='80'
          width='80'
          color='#4fa94d'
          radius='9'
          ariaLabel='three-dots-loading'
        />
      </div>
    );
  }

  if (!chartData) {
    return <p>No data available for {username}</p>;
  }

  return (
    <div className='container flex items-center flex-col justify-center'>
      <p className='font-semibold text-white'>Problem Count</p>
      <div className='w-[350px] relative'>
        <Doughnut
          data={chartData}
          options={{
            plugins: {
              legend: {
                labels: {
                  color: "white", // Set the color for the legend labels
                  font: {
                    weight: "bold",
                    family: "Poppins, sans-serif", // Ensure the correct family is specified
                  },
                },
                display: true,
              },
              tooltip: {
                enabled: false, // Disable tooltips entirely
              },
              datalabels: {
                color: "#000",
                font: {
                  weight: "bold",
                  size: 16,
                  family: "Poppins, sans-serif",
                },
                formatter: (value: number) => value,
              },
              centerText: {
                display: true,
                text: `Total: ${chartData.totalCount}`,
                color: "#fff",
                font: {
                  size: 21,
                  weight: "bold",
                  family: "Poppins, sans-serif", // Ensure the correct family is specified
                },
              },
              hoverCenterTextChange: {
                display: true,
                text: "", // Initial text
                color: "#fff",
                font: {
                  size: 21,
                  weight: "bold",
                  family: "Poppins, sans-serif",
                },
              },
            },
            hover: {
              mode: "index",
              intersect: false,
            },
            elements: {
              arc: {
                hoverBorderWidth: 0,
                hoverBorderColor: "transparent",
                hoverOffset: 0,
              },
            },
          }}
        />
      </div>
    </div>
  );
};

export default TotalCountChart;
