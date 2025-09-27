import cron from "node-cron";
import Cashiering from "../schemas/Cashiering";

// Helper function to get yesterday's date normalized to start of day
function getYesterday(): Date {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  return yesterday;
}

export const setupCronJobs = () => {
  // Schedule the cron job to run at midnight every day
  cron.schedule("0 0 * * *", async () => {
    try {
      const yesterday = getYesterday();
      const updateResult = await Cashiering.updateMany(
        {
          dayDate: yesterday,
          openingAmount: { $exists: true },
          closingAmount: { $exists: false },
        },
        {
          $set: {
            closingAmount: 0,
            closingDate: new Date(),
          },
        }
      );

      console.log(
        `Auto-closed ${updateResult.modifiedCount} cashiering records for ${yesterday.toDateString()}`
      );
    } catch (error) {
      console.error("Error in auto-closing cashiering records:", error);
    }
  });
};
