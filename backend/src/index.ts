import { fetchUpcomingContests } from "./controllers/fetchController";
import schedule from "node-schedule";

async function updateAllPlatforms() {
  console.log("Running !!");
  try {
    // Run daily at midnight IST
    schedule.scheduleJob(
      { rule: "0 0 * * *", tz: "Asia/Kolkata" },
      fetchUpcomingContests,
    );

    // Run initial fetch when the script starts
    fetchUpcomingContests();

    console.log("Scheduled daily contest fetch (IST).");
  } catch (error) {
    console.error("Error:", error);
  }

  console.log("All updates completed !!");
}

updateAllPlatforms().catch((error) => console.error("Fatal Error:", error));
