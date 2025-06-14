import prisma from "../config/db";

interface UpdateResults {
  success: string[];
  failed: string[];
  total: number;
  successCount: number;
  failureCount: number;
  contestError?: string; // Added this property to fix the TypeScript error
}

// Codeforces API Response Types
interface CodeforcesRatingResponse {
  status: string;
  result: {
    contestId: number;
    contestName: string;
    handle: string;
    rank: number;
    ratingUpdateTimeSeconds: number;
    oldRating: number;
    newRating: number;
  }[];
}

interface CodeforcesProblem {
  contestId?: number;
  problemsetName?: string;
  index: string;
  name: string;
  type: string;
  points?: number;
  rating?: number;
  tags: string[];
}

interface CodeforcesSubmission {
  id: number;
  contestId?: number;
  creationTimeSeconds: number;
  relativeTimeSeconds: number;
  problem: CodeforcesProblem;
  author: {
    contestId?: number;
    members: { handle: string }[];
    participantType?: string;
    ghost?: boolean;
    startTimeSeconds?: number;
  };
  programmingLanguage: string;
  verdict: string;
  testset: string;
  passedTestCount: number;
  timeConsumedMillis: number;
  memoryConsumedBytes: number;
}

interface CodeforcesSubmissionResponse {
  status: string;
  result: CodeforcesSubmission[];
}

interface CodeforcesContest {
  id: number;
  name: string;
  phase: string;
  startTimeSeconds: number;
}

export const updateCodeforcesdata = async (
  contestName?: string,
): Promise<UpdateResults> => {
  const students = await prisma.students.findMany();
  const results = {
    success: [] as string[],
    failed: [] as string[],
    total: students.length,
    successCount: 0,
    failureCount: 0,
  } as UpdateResults;

  try {
    // Fetch all contests first to validate the contest name
    if (contestName) {
      const { default: got } = await import("got");
      const contestsResponse = await got(
        "https://codeforces.com/api/contest.list",
      ).json<{
        status: string;
        result: CodeforcesContest[];
      }>();

      if (!contestsResponse.result.length) {
        results.contestError = "No contest data found from Codeforces API";
        return results;
      }

      // Find the specific contest by name
      const targetContest = contestsResponse.result.find(
        (contest) =>
          contest.phase === "FINISHED" &&
          contest.name.toLowerCase() === contestName.toLowerCase(),
      );

      if (!targetContest) {
        results.contestError = `Contest with name "${contestName}" not found or not finished yet`;
        return results;
      }
    }

    // Process each student
    for (const student of students) {
      try {
        await updateStudentCodeforcesData(student, contestName);
        results.success.push(student.codeforces_id);
        console.log(
          `Updated data for ${student.codeforces_id}${contestName ? ` for contest: ${contestName}` : ""}`,
        );
      } catch (error) {
        console.error(
          `Failed to update data for ${student.codeforces_id}${contestName ? ` for contest: ${contestName}` : ""}:`,
          error,
        );
        results.failed.push(student.codeforces_id);
      }
    }
  } catch (error) {
    // This would catch any other errors like API connectivity issues
    results.contestError =
      error instanceof Error
        ? error.message
        : "Unknown error occurred with Codeforces API";
  }

  results.successCount = results.success.length;
  results.failureCount = results.failed.length;

  return results;
};

export const updateSingleStudentCodeforces = async (
  studentId: string,
  contestName?: string,
): Promise<{
  message: string;
  student?: string;
  error?: string;
}> => {
  try {
    const student = await prisma.students.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      throw new Error("Student not found");
    }

    await updateStudentCodeforcesData(student, contestName);

    return {
      message: "Successfully updated Codeforces participation",
      student: student.codeforces_id,
    };
  } catch (error) {
    console.error(`Failed to update data for student ${studentId}:`, error);
    return {
      message: "Error updating Codeforces participation",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

// Helper function to update a single student's Codeforces data
async function updateStudentCodeforcesData(student: any, contestName?: string) {
  const { default: got } = await import("got");

  try {
    // Fetch all contests
    const contestsResponse = await got(
      "https://codeforces.com/api/contest.list",
    ).json<{
      status: string;
      result: CodeforcesContest[];
    }>();

    if (!contestsResponse.result.length) {
      throw new Error("No contest data found");
    }

    // Find the contest by name or use the most recent finished contest
    let targetContest: CodeforcesContest | undefined;

    if (contestName) {
      // Find the specific contest by name
      targetContest = contestsResponse.result.find(
        (contest) =>
          contest.phase === "FINISHED" &&
          contest.name.toLowerCase() === contestName.toLowerCase(),
      );

      if (!targetContest) {
        throw new Error(
          `Contest with name "${contestName}" not found or not finished yet`,
        );
      }
    } else {
      // Find the last ended contest
      const pastContests = contestsResponse.result
        .filter((contest) => contest.phase === "FINISHED")
        .sort((a, b) => b.startTimeSeconds - a.startTimeSeconds);

      if (!pastContests.length) {
        throw new Error("No finished contests found");
      }

      targetContest = pastContests[0];
    }

    // Try to fetch user's contest history - this will fail if username is incorrect
    try {
      const ratingResponse = await got(
        `https://codeforces.com/api/user.rating?handle=${student.codeforces_id}`,
      ).json<CodeforcesRatingResponse>();

      // Check if user participated in the target contest
      const userContest = ratingResponse.result.find(
        (contest) => contest.contestId === targetContest!.id,
      );

      let rank = -1;
      let solvedProblems: string[] = [];

      if (userContest) {
        // Fetch submission history
        const submissionResponse = await got(
          `https://codeforces.com/api/user.status?handle=${student.codeforces_id}&from=1&count=1000`,
        ).json<CodeforcesSubmissionResponse>();

        if (submissionResponse.result.length) {
          const contestSubmissions = submissionResponse.result.filter(
            (sub) => sub.contestId === targetContest!.id,
          );

          // Get unique solved problems
          solvedProblems = contestSubmissions
            .filter((sub) => sub.verdict === "OK")
            .map((sub) => sub.problem.name)
            .filter((value, index, self) => self.indexOf(value) === index);
        }

        rank = userContest.rank;
      } else {
        // User did not participate in the contest
        console.log(
          `${student.codeforces_id} did not attend contest "${targetContest.name}"`,
        );
        rank = -1;
      }

      // Create or update contest record
      const contest_record = await prisma.contest.upsert({
        where: { name: targetContest.name },
        update: {},
        create: {
          name: targetContest.name,
          date: new Date(targetContest.startTimeSeconds * 1000),
          type: "Codeforces",
        },
      });

      // Create or update participation record
      await prisma.codeforcesParticipation.upsert({
        where: {
          studentId_contestId: {
            studentId: student.id,
            contestId: contest_record.id,
          },
        },
        update: {
          rank,
          finishTime: new Date(
            targetContest.startTimeSeconds * 1000,
          ).toISOString(),
          total_qns: solvedProblems.length,
          questions: solvedProblems,
        },
        create: {
          studentId: student.id,
          contestId: contest_record.id,
          contestName: targetContest.name,
          rank,
          finishTime: new Date(
            targetContest.startTimeSeconds * 1000,
          ).toISOString(),
          total_qns: solvedProblems.length,
          questions: solvedProblems,
        },
      });

      // Find latest contest where the user participated
      const latestUserContest = ratingResponse.result.length
        ? ratingResponse.result[ratingResponse.result.length - 1]
        : null;

      // Update student's rating
      if (latestUserContest) {
        await prisma.students.update({
          where: { id: student.id },
          data: { codeforces_rating: BigInt(latestUserContest.newRating) },
        });
      }
    } catch (error) {
      // Either username is incorrect or there was an API issue
      console.log(
        `Invalid username or API error for ${student.codeforces_id}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );

      // Still create participation record with rank -1
      const contest_record = await prisma.contest.upsert({
        where: { name: targetContest.name },
        update: {},
        create: {
          name: targetContest.name,
          date: new Date(targetContest.startTimeSeconds * 1000),
          type: "Codeforces",
        },
      });

      await prisma.codeforcesParticipation.upsert({
        where: {
          studentId_contestId: {
            studentId: student.id,
            contestId: contest_record.id,
          },
        },
        update: {
          rank: -1,
          finishTime: new Date(
            targetContest.startTimeSeconds * 1000,
          ).toISOString(),
          total_qns: 0,
          questions: [],
        },
        create: {
          studentId: student.id,
          contestId: contest_record.id,
          contestName: targetContest.name,
          rank: -1,
          finishTime: new Date(
            targetContest.startTimeSeconds * 1000,
          ).toISOString(),
          total_qns: 0,
          questions: [],
        },
      });
    }
  } catch (error) {
    // This catches errors with the contests API
    console.log(
      `Error fetching contest data: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
    throw error; // Rethrow to be handled by the calling function
  }
}
