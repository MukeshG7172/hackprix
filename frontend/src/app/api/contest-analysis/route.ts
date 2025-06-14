import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    // Fetch all contests and categorize them by type
    const contests = await prisma.contest.findMany({
      orderBy: { date: "desc" },
    });

    if (contests.length === 0) {
      return NextResponse.json({ message: "No contests found" }, { status: 404 });
    }

    const categorizedContests = contests.reduce((acc, contest) => {
      if (!acc[contest.type]) {
        acc[contest.type] = [];
      }
      acc[contest.type].push(contest);
      return acc;
    }, {} as Record<string, any[]>);

    // Function to fetch participants based on contest type
    const fetchParticipants = async (contest: any) => {
      let model;
      if (contest.type === "Leetcode") {
        model = prisma.contestParticipation;
      } else if (contest.type === "Codechef") {
        model = prisma.codechefParticipation;
      } else if (contest.type === "Codeforces") {
        model = prisma.codeforcesParticipation;
      }

      if (!model) return { current: [], previous: [] };

      // Fetch current contest participants
      let currentParticipants = await model.findMany({
        where: { contestId: contest.id },
        include: { Students: true },
        orderBy: { rank: "asc" }, // Fetch sorted data
      });

      // **Sorting to move -1 ranked participants to the end**
      currentParticipants = currentParticipants.sort((a, b) => {
        if (a.rank === -1) return 1; // Push -1 ranks to the end
        if (b.rank === -1) return -1;
        return a.rank - b.rank; // Otherwise, sort normally
      });

      // Fetch previous contest of the same type
      const previousContest = await prisma.contest.findFirst({
        where: { type: contest.type, date: { lt: contest.date } },
        orderBy: { date: "desc" },
      });

      let previousParticipants: typeof currentParticipants = [];

      if (previousContest) {
        previousParticipants = await model.findMany({
          where: { contestId: previousContest.id },
          include: { Students: true },
          orderBy: { rank: "asc" },
        });

        // Apply same sorting for previous participants
        previousParticipants = previousParticipants.sort((a, b) => {
          if (a.rank === -1) return 1;
          if (b.rank === -1) return -1;
          return a.rank - b.rank;
        });
      }

      return { current: currentParticipants, previous: previousParticipants };
    };

    // Process all contests and merge data into categorizedContests
    for (const contestType in categorizedContests) {
      categorizedContests[contestType] = await Promise.all(
        categorizedContests[contestType].map(async (contest) => {
          const { current, previous } = await fetchParticipants(contest);

          const calculateAverageRank = (participants: typeof current) =>
            participants.length > 0
              ? Math.round(participants.reduce((sum, p) => sum + p.rank, 0) / participants.length)
              : 0;

          return {
            ...contest,
            topPerformers: current.slice(0, 3).map((p) => ({
              name: p.Students.name,
              rank: p.rank,
              dept: p.Students.dept,
              section: p.Students.section,
              year: p.Students.batch,
              no_of_questions: p.total_qns,
              finish_time: p.finishTime || null,
            })),
            allParticipants: current.map((p) => ({
              name: p.Students.name,
              rank: p.rank,
              dept: p.Students.dept,
              section: p.Students.section,
              year: p.Students.batch,
              no_of_questions: p.total_qns,
              finish_time: p.finishTime || null,
            })), // Include all participants
            participation: {
              newCount: current.length,
              previousCount: previous.length,
              trend:
                current.length > previous.length
                  ? "increased"
                  : current.length < previous.length
                    ? "decreased"
                    : "same",
            },
            averageRank: {
              newAvg: calculateAverageRank(current),
              previousAvg: calculateAverageRank(previous),
              trend:
                calculateAverageRank(current) < calculateAverageRank(previous)
                  ? "improved"
                  : calculateAverageRank(current) > calculateAverageRank(previous)
                    ? "decreased"
                    : "same",
            },
          };
        })
      );
    }

    return NextResponse.json({ contests: categorizedContests });
  } catch (error) {
    console.error("Error fetching contests:", error);
    return NextResponse.json(
      { error: "An internal server error occurred" },
      { status: 500 }
    );
  }
}

