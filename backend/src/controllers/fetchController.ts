import schedule from "node-schedule";
import Queue from "bull";
import axios from "axios";
import { updateCodeforcesdata } from "./codeforcesController";
import { updateLeetcodeData } from "./leetcodeController";
import { updateCodechefdata } from "./codechefController";

interface Contest {
  site: "leetcode" | "codechef" | "codeforces";
  title: string;
  startTime: number;
  duration: number;
  endTime: number;
  url: string;
  titleSlug?: string; // Added titleSlug for leetcode contests
}

interface CodechefContest {
  contest_name: string;
  contest_start_date: string;
  contest_duration: number;
  contest_code: string;
}

interface CodeforcesContest {
  name: string;
  id: number;
  phase: string;
  startTimeSeconds: number;
  durationSeconds: number;
}

interface LeetcodeContest {
  title: string;
  startTime: number;
  duration: number;
  titleSlug: string;
  cardImg: string;
}

interface LeetcodeResponse {
  data: {
    topTwoContests: LeetcodeContest[];
  };
}

interface CodeforcesResponse {
  result: CodeforcesContest[];
}

interface CodechefResponse {
  future_contests: CodechefContest[];
}

const redisConfig = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  maxRetriesPerRequest: 3,
  retryStrategy(times: number) {
    const delay = Math.min(times * 50, 2000);
    console.log(`Retrying Redis connection... Attempt ${times}`);
    return delay;
  },
};

const queue = new Queue("ContestQueue", {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: true,
  },
});

async function handleLeetcodeContest(contest: Contest): Promise<void> {
  console.log(`Adding to Queue Leetcode contest: ${contest.title}`);
  // Pass the titleSlug to the job if available
  await queue.add({
    type: "Leetcode",
    contestSlug: contest.titleSlug,
  });
}

async function handleCodechefContest(contest: Contest): Promise<void> {
  console.log(`Adding to Queue Codechef contest: ${contest.title}`);
  await queue.add({ type: "Codechef", contestName: contest.title });
}

async function handleCodeforcesContest(contest: Contest): Promise<void> {
  console.log(`Adding to Queue Codeforces contest: ${contest.title}`);
  await queue.add({ type: "Codeforces", contestName: contest.title });
}

const parseCodechef = (data: CodechefContest[]): Contest[] => {
  return data.map((item) => {
    const startTime = new Date(item.contest_start_date).getTime();
    const duration = item.contest_duration * 60 * 1000;

    return {
      site: "codechef" as const,
      title: item.contest_name,
      startTime,
      duration,
      endTime: startTime + duration,
      url: `https://www.codechef.com/${item.contest_code}`,
    };
  });
};

const parseCodeforces = (data: CodeforcesContest[]): Contest[] => {
  return data
    .filter((item) => item.phase !== "FINISHED")
    .map((item) => {
      const startTime = item.startTimeSeconds * 1000;
      const duration = item.durationSeconds * 1000;

      return {
        site: "codeforces" as const,
        title: item.name,
        startTime,
        duration,
        endTime: startTime + duration,
        url: `https://codeforces.com/contest/${item.id}`,
      };
    });
};

const parseLeetcode = (data: LeetcodeContest[]): Contest[] => {
  return data.map((item) => {
    const startTime = item.startTime * 1000;
    const duration = item.duration * 60 * 1000;

    return {
      site: "leetcode" as const,
      title: item.title,
      startTime,
      duration,
      endTime: startTime + duration,
      url: `https://leetcode.com/contest/${item.titleSlug}`,
      titleSlug: item.titleSlug, // Store the titleSlug for later use
    };
  });
};

export async function fetchUpcomingContests(): Promise<Contest[]> {
  try {
    let contests: Contest[] = [];

    try {
      const codechefResponse = await axios.post<CodechefResponse>(
        "https://www.codechef.com/api/list/contests/all?sort_by=START&sorting_order=asc&offset=0&mode=all",
        {},
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
      contests = contests.concat(
        parseCodechef(codechefResponse.data.future_contests),
      );
    } catch (error) {
      console.error("Error fetching Codechef contests:", error);
    }

    try {
      const leetcodeResponse = await axios.post<LeetcodeResponse>(
        "https://leetcode.com/graphql",
        {
          query: `{
            topTwoContests{
              title
              startTime
              duration
              cardImg
              titleSlug
            }
          }`,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
      contests = contests.concat(
        parseLeetcode(leetcodeResponse.data.data.topTwoContests),
      );
    } catch (error) {
      console.error("Error fetching Leetcode contests:", error);
    }

    try {
      const codeforcesResponse = await axios.get<CodeforcesResponse>(
        "https://codeforces.com/api/contest.list",
      );
      contests = contests.concat(
        parseCodeforces(codeforcesResponse.data.result),
      );
    } catch (error) {
      console.error("Error fetching Codeforces contests:", error);
    }

    contests.sort((a, b) => a.startTime - b.startTime);

    const todayIST = new Date().toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
    });

    const todayContests = contests.filter((contest) => {
      const startDate = new Date(contest.startTime).toLocaleDateString(
        "en-IN",
        { timeZone: "Asia/Kolkata" },
      );
      return startDate === todayIST;
    });

    // Check if there's a LeetCode contest today and process it immediately
    const todayLeetcodeContest = todayContests.find(
      (contest) => contest.site === "leetcode",
    );

    if (todayLeetcodeContest) {
      console.log(
        `Found LeetCode contest today: ${todayLeetcodeContest.title}`,
      );
      // Schedule immediate processing for today's LeetCode contest
      await processContest(todayLeetcodeContest);
    }

    for (const contest of todayContests) {
      scheduleContestFetch(contest);
    }

    console.log(`Scheduled ${todayContests.length} contests for processing.`);
    return contests;
  } catch (error) {
    console.error("Error in fetchUpcomingContests:", error);
    return [];
  }
}

function scheduleContestFetch(contest: Contest): void {
  let offsetHours: number;
  switch (contest.site.toLowerCase()) {
    case "leetcode":
      offsetHours = 3;
      break;
    case "codechef":
    case "codeforces":
      offsetHours = 8;
      break;
    default:
      console.warn(
        `Unknown platform ${contest.site}, using default 8 hour offset`,
      );
      offsetHours = 8;
  }

  const fetchTimeIST = new Date(
    new Date(contest.endTime).getTime() + offsetHours * 60 * 60 * 1000,
  );

  schedule.scheduleJob(fetchTimeIST, async () => {
    console.log(`Processing contest: ${contest.title} at ${fetchTimeIST}`);
    await processContest(contest);
  });

  console.log(
    `Scheduled processing for "${contest.title}" at ${fetchTimeIST} (IST)`,
  );
}

async function processContest(contest: Contest): Promise<void> {
  try {
    switch (contest.site.toLowerCase()) {
      case "leetcode":
        await handleLeetcodeContest(contest);
        break;
      case "codechef":
        await handleCodechefContest(contest);
        break;
      case "codeforces":
        await handleCodeforcesContest(contest);
        break;
      default:
        console.warn(`Unknown platform ${contest.site}, skipping processing`);
    }
  } catch (error) {
    console.error(`Error processing contest ${contest.title}:`, error);
  }
}

queue.process(async (job, done) => {
  try {
    console.log(`Processing job: ${job.data.type}`);

    switch (job.data.type) {
      case "Leetcode":
        await updateLeetcodeData(job.data.contestSlug);
        break;
      case "Codechef":
        await updateCodechefdata(job.data.contestName);
        break;
      case "Codeforces":
        await updateCodeforcesdata(job.data.contestName);
        break;
      default:
        console.warn(`Unknown job: ${job.data.type}`);
    }

    done();
  } catch (error) {
    console.error(`Error processing job: ${job.data.type}\n`, error);
    done(error as Error);
  }
});

process.on("SIGTERM", async () => {
  await queue.close();
  process.exit(0);
});
