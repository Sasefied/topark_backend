import cron from "node-cron";
import Cashiering from "../schemas/Cashiering";
import OrderPayment from "../schemas/OrderPayment";
import SellOrderPayment from "../schemas/SellOrderPayment";
import PDFDocument from "pdfkit";
import fs from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";

// Helper function to get yesterday's date normalized to start of day
function getYesterday(): Date {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  return yesterday;
}

// Helper function to generate PDF buffer for a cashiering record
async function generatePDFBuffer(
  cashiering: any,
  paidTransactions: any[],
  receivedTransactions: any[]
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    let buffers: Buffer[] = [];

    doc.on("data", (chunk) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    // Header
    doc
      .fontSize(18)
      .text(
        `Daily Transaction History for ${cashiering.dayDate.toDateString()}`,
        { align: "center" }
      );
    doc.fontSize(12).text(`Cashier ID: ${cashiering.userId.toString()}`);
    doc.moveDown();

    // Opening
    doc.text(
      `Opening Amount: $${cashiering.openingAmount.toFixed(2)} at ${cashiering.openingDate?.toLocaleString() || "N/A"}`
    );
    doc.moveDown();

    // Received Transactions (Sales)
    doc.fontSize(14).text("Sales (Received):");
    let totalReceived = 0;
    receivedTransactions.forEach((tx) => {
      const amount = tx.amount || 0;
      totalReceived += amount;
      doc
        .fontSize(12)
        .text(`- ${tx.createdAt.toLocaleString()}: $${amount.toFixed(2)}`);
    });
    doc.text(`Total Received: $${totalReceived.toFixed(2)}`);
    doc.moveDown();

    // Paid Transactions (Payments/Expenses)
    doc.fontSize(14).text("Payments (Paid):");
    let totalPaid = 0;
    paidTransactions.forEach((tx) => {
      const amount = tx.amount || 0;
      totalPaid += amount;
      doc
        .fontSize(12)
        .text(`- ${tx.createdAt.toLocaleString()}: $${amount.toFixed(2)}`);
    });
    doc.text(`Total Paid: $${totalPaid.toFixed(2)}`);
    doc.moveDown();

    // Closing
    const net = totalReceived - totalPaid;
    const closingAmount = cashiering.openingAmount + net;
    doc.text(`Net Change: $${net.toFixed(2)}`);
    doc.text(
      `Closing Amount: $${closingAmount.toFixed(2)} at ${new Date().toLocaleString()}`
    );

    doc.end();
  });
}

// ✅ Utility: Get start and end of yesterday
const getYesterdayRange = () => {
  const now = new Date();
  const startOfYesterday = new Date(now);
  startOfYesterday.setDate(now.getDate() - 1);
  startOfYesterday.setHours(0, 0, 0, 0);

  const endOfYesterday = new Date(startOfYesterday);
  endOfYesterday.setHours(23, 59, 59, 999);

  return { startOfYesterday, endOfYesterday };
};

export const setupCronJobs = () => {
  console.log("Setting up cashiering cron jobs...");

  // Schedule the cron job to run at midnight every day
  cron.schedule("0 0 * * *", async () => {
    try {
      // Get yesterday's date at midnight (ensure consistent timezone)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      // Define end of yesterday (midnight of today)
      const endOfYesterday = new Date();
      endOfYesterday.setHours(0, 0, 0, 0);

      console.log(
        `Checking for open cashierings on ${yesterday.toISOString()}`
      );

      // Find all open cashiering records for yesterday
      const openCashierings = await Cashiering.find({
        dayDate: {
          $gte: yesterday,
          $lt: endOfYesterday,
        },
      });

      console.log(`Found ${openCashierings.length} open cashiering records`);

      if (openCashierings.length === 0) {
        console.log("No open cashiering records found. Query details:", {
          dayDate: yesterday.toISOString(),
          endOfYesterday: endOfYesterday.toISOString(),
        });
      }

      const invoicesDir = path.resolve(process.cwd(), "invoices");
      await fs.mkdir(invoicesDir, { recursive: true });

      // Aggregate paid amounts
      const paidAggregate = await OrderPayment.aggregate([
        {
          $match: {},
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$amount" },
          },
        },
      ]);

      // Aggregate received amounts
      const receivedAggregate = await SellOrderPayment.aggregate([
        {
          $match: {},
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$amount" },
          },
        },
      ]);

      for (const cashiering of openCashierings) {
        const userId = cashiering.userId;

        const totalPaid = paidAggregate[0]?.totalAmount || 0;
        const totalReceived = receivedAggregate[0]?.totalAmount || 0;
        const net = totalReceived - totalPaid;
        const closingAmount = (cashiering.openingAmount || 0) + net;

        // // Fetch detailed transactions for PDF
        const paidTransactions = await OrderPayment.find({}).sort({
          createdAt: 1,
        });

        const receivedTransactions = await SellOrderPayment.find({}).sort({
          createdAt: 1,
        });

        // ✅ Generate PDF buffer
        const pdfBuffer = await generatePDFBuffer(
          cashiering,
          paidTransactions,
          receivedTransactions
        );

        // ✅ Save to local server
        const key = `cashiering_${cashiering._id}.pdf`;
        const filePath = path.join(invoicesDir, key);
        await fs.writeFile(filePath, pdfBuffer);

        const invoiceUrl =
          process.env.NODE_ENV === "production"
            ? `https://topark-backend.onrender.com/${key}`
            : `http://localhost:${process.env.PORT || 3000}/${key}`;

        // ✅ Update the cashiering record
        cashiering.closingAmount = closingAmount;
        cashiering.closingDate = new Date();
        cashiering.invoiceUrl = invoiceUrl;
        await cashiering.save();

        console.log(
          `✅ Closed and generated invoice for cashiering record ${cashiering._id} for ${startOfYesterday.toDateString()}`
        );
      }

      console.log(
        `✅ Auto-closed ${openCashierings.length} cashiering records for ${startOfYesterday.toDateString()}`
      );
    } catch (error) {
      console.error("❌ Error in auto-closing cashiering records:", error);
    }
  });
};