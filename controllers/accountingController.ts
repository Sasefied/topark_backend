import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import Order from "../schemas/Order";
import SellOrder from "../schemas/SellOrder";
import { responseHandler } from "../utils/responseHandler";
import mongoose, { Model } from "mongoose";
import { BadRequestError, InternalServerError } from "../utils/errors";
import Client from "../schemas/ClientDetails";
import OrderPayment from "../schemas/OrderPayment";
import OrderItem from "../schemas/OrderItem";
import SellOrderItem from "../schemas/SellOrderItem";
import SellOrderPayment from "../schemas/SellOrderPayment";

const getAllAccountingRecords = asyncHandler(
  async (req: Request, res: Response) => {
    const { startDate, endDate, clientName, prevStartDate, prevEndDate } =
      req.query;

    if (!startDate || !endDate) {
      throw new BadRequestError("startDate and endDate are required");
    }
    const start = new Date(startDate.toString());
    const end = new Date(endDate.toString());
    console.log("Fetching accounting records from", start, "to", end);

    const aggregateDaily = async (Model: Model<any>, isPayment = true) => {
      return await Model.aggregate([
        {
          $match: {
            createdAt: { $gte: start, $lte: end },
            userId: new mongoose.Types.ObjectId(req.userId),
          },
        },
        {
          $lookup: {
            from: "clients",
            localField: "clientId",
            foreignField: "_id",
            as: "client",
          },
        },
        { $unwind: "$client" },

        ...(clientName
          ? [
              {
                $match: {
                  "client.clientName": { $regex: clientName, $options: "i" },
                },
              },
            ]
          : []),

        // Preserve original _id before grouping
        {
          $addFields: {
            originalId: "$_id",
          },
        },

        // Group by client and date
        {
          $group: {
            _id: {
              clientId: "$clientId",
              date: {
                $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
              },
            },
            clientName: { $first: "$client.clientName" },
            total: { $sum: "$total" },
            outstanding: { $sum: "$outstandingTotal" },
            ids: { $push: "$originalId" }, // collect original _ids
          },
        },

        // Group by client to build dailyData array
        {
          $group: {
            _id: "$_id.clientId",
            clientName: { $first: "$clientName" },
            dailyData: {
              $push: {
                ...(isPayment ? { payIds: "$ids" } : { receiveIds: "$ids" }),
                date: "$_id.date",
                total: "$total",
                outstanding: "$outstanding",
              },
            },
          },
        },

        // Final projection
        {
          $project: {
            clientId: "$_id",
            clientName: 1,
            dailyData: 1,
          },
        },
      ]);
    };

    // Usage:
    const payments = await aggregateDaily(Order, true);
    const receivables = await aggregateDaily(SellOrder, false);

    console.log("Payments:", payments);
    console.log("Receivables:", receivables);

    // For MoM: Optionally aggregate totals for previous period if provided
    let prevTotalPay = 0,
      prevTotalReceive = 0;
    if (prevStartDate && prevEndDate) {
      const prevStart = new Date(prevStartDate.toString());
      const prevEnd = new Date(prevEndDate.toString());
      const prevPayments = await Order.aggregate([
        {
          $match: {
            createdAt: { $gte: prevStart, $lte: prevEnd },
            userId: new mongoose.Types.ObjectId(req.userId),
          },
        },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]);
      const prevReceivables = await SellOrder.aggregate([
        {
          $match: {
            createdAt: { $gte: prevStart, $lte: prevEnd },
            userId: new mongoose.Types.ObjectId(req.userId),
          },
        },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]);
      console.log(`Previous Payments:`, prevPayments);
      console.log(`Previous Receivables:`, prevReceivables);
      prevTotalPay = prevPayments[0]?.total || 0;
      prevTotalReceive = prevReceivables[0]?.total || 0;
    }

    // Combine payments and receivables by client
    const clientIds = new Set([
      ...payments.map((p) => p.clientId.toString()),
      ...receivables.map((r) => r.clientId.toString()),
    ]);

    const accountingRecords = Array.from(clientIds).map((clientId) => {
      const payment = payments.find(
        (p) => p.clientId.toString() === clientId
      ) || { dailyData: [], clientName: "" };
      console.log("Matching payment for clientId", clientId, ":", payment);
      const receivable = receivables.find(
        (r) => r.clientId.toString() === clientId
      ) || { dailyData: [], clientName: "" };
      console.log(
        "Matching receivable for clientId",
        clientId,
        ":",
        receivable
      );
      return {
        // payId: payment._id,
        // receiveId: receivable._id,
        clientId,
        clientName: payment.clientName || receivable.clientName,
        dailyPays: payment.dailyData,
        dailyReceives: receivable.dailyData,
      };
    });

    // Calculate overall totals
    const totalPay = payments.reduce(
      (sum, p) =>
        sum + p.dailyData.reduce((dSum: number, d: any) => dSum + d.total, 0),
      0
    );
    const totalReceive = receivables.reduce(
      (sum, r) =>
        sum + r.dailyData.reduce((dSum: number, d: any) => dSum + d.total, 0),
      0
    );
    const totalOutstanding = payments.reduce(
      (sum, p) =>
        sum +
        p.dailyData.reduce((dSum: number, d: any) => dSum + d.outstanding, 0),
      0
    );
    const inflow = totalReceive - totalPay;
    const momChange =
      prevTotalReceive && prevTotalPay
        ? inflow - (prevTotalReceive - prevTotalPay)
        : 0;
    const netChange = inflow; // Or customize, e.g., momChange + inflow

    // Outflow as array [totalPay, totalOutstanding] to match image's two values
    const outflow = [totalPay, totalOutstanding];

    // For P&L graph: Aggregate overall daily totals, with separate profit/loss
    const allDates = [
      ...new Set([
        ...payments.flatMap((p) => p.dailyData.map((d: any) => d.date)),
        ...receivables.flatMap((r) => r.dailyData.map((d: any) => d.date)),
      ]),
    ].sort();
    const dailyPnL = allDates.map((date) => {
      const dayPay = payments.reduce(
        (sum, p) =>
          sum + (p.dailyData.find((d: any) => d.date === date)?.total || 0),
        0
      );
      const dayReceive = receivables.reduce(
        (sum, r) =>
          sum + (r.dailyData.find((d: any) => d.date === date)?.total || 0),
        0
      );
      const pnl = dayReceive - dayPay;
      return { date, pnl, profit: pnl > 0 ? pnl : 0, loss: pnl < 0 ? pnl : 0 };
    });

    // Today metrics (for August 29, 2025)
    const todayStart = new Date(); // Current date: 2025-08-29
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const incomeTodayAgg = await SellOrder.aggregate([
      {
        $match: {
          createdAt: { $gte: todayStart, $lte: todayEnd },
          userId: new mongoose.Types.ObjectId(req.userId),
        },
      },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]);
    const incomeToday = incomeTodayAgg[0]?.total || 0;

    const dueTodayAgg = await Order.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(req.userId) } }, // All outstanding; adjust if dueDate exists
      { $group: { _id: null, total: { $sum: "$outstandingTotal" } } },
    ]);
    const dueToday = dueTodayAgg[0]?.total || 0;

    const paymentDefaultsAgg = await Order.aggregate([
      {
        $match: {
          outstandingTotal: { $gt: 0 },
          userId: new mongoose.Types.ObjectId(req.userId),
        },
      },
      { $count: "count" },
    ]);
    const paymentDefaults = paymentDefaultsAgg[0]?.count || 0;

    const paymentsDueTodayAgg = await SellOrder.aggregate([
      {
        $match: {
          createdAt: { $gte: todayStart, $lte: todayEnd },
          userId: new mongoose.Types.ObjectId(req.userId),
        },
      },
      { $count: "count" },
    ]);
    const paymentsDueToday = paymentsDueTodayAgg[0]?.count || 0;

    const totalDueToday = incomeToday + dueToday; // Example; adjust logic

    responseHandler(
      res,
      200,
      "Accounting records fetched successfully",
      "success",
      {
        records: accountingRecords,
        outflow,
        momChange,
        netChange,
        dailyPnL,
        incomeToday,
        dueToday,
        paymentDefaults,
        paymentsDueToday,
        totalDueToday,
      }
    );
  }
);

const getClientById = asyncHandler(async (req: Request, res: Response) => {
  const { clientId } = req.params;

  const client = await Client.findById(clientId);
  if (!client) {
    throw new BadRequestError("Client not found");
  }

  responseHandler(res, 200, "Client fetched successfully", "success", client);
});

const receivePayment = asyncHandler(async (req: Request, res: Response) => {
  const { sellOrderIds, amount, date } = req.body;

  // Validate inputs
  if (!Array.isArray(sellOrderIds) || sellOrderIds.length === 0) {
    throw new BadRequestError("`sellOrderIds` must be a non-empty array.");
  }

  const paymentAmount = Number(amount);
  if (isNaN(paymentAmount) || paymentAmount <= 0) {
    throw new BadRequestError("`amount` must be a positive number.");
  }

  const session = await mongoose.startSession();

  try {
    await session.startTransaction();
    const orders = await Promise.all(
      sellOrderIds.map((id: string) => SellOrder.findById(id).session(session))
    );

    // Check for missing orders and filter out null values
    const validOrders = orders.filter(
      (order): order is NonNullable<typeof order> => order !== null
    );

    if (validOrders.length !== sellOrderIds.length) {
      throw new BadRequestError("One or more orderIds are invalid.");
    }

    let remaining = paymentAmount;
    const paymentRecords = [];

    for (const order of validOrders) {
      // Avoid processing if no remaining amount
      if (remaining <= 0) break;

      const orderItems = await SellOrderItem.find({
        orderId: order._id,
        outstandingPrice: { $gt: 0 },
      })
        .sort({ createdAt: 1 })
        .session(session);

      for (const item of orderItems) {
        if (remaining <= 0) break;

        const applyAmount = Math.min(item.outstandingPrice, remaining);
        item.outstandingPrice -= applyAmount;
        remaining -= applyAmount;

        await item.save({ session });
      }

      // Update order's outstanding total
      order.outstandingTotal = await SellOrderItem.aggregate([
        { $match: { orderId: order._id } },
        {
          $group: {
            _id: null,
            totalOutstanding: { $sum: "$outstandingPrice" },
          },
        },
      ]).then((res) => res[0]?.totalOutstanding || 0);

      await order.save({ session });

      const appliedAmount = paymentAmount - remaining;
      if (appliedAmount > 0) {
        paymentRecords.push({
          orderId: order._id,
          method: "cash",
          amount: appliedAmount,
          date: date || new Date(),
          createdBy: req.userId,
        });
      }
    }

    if (paymentRecords.length === 0) {
      throw new BadRequestError("No outstanding payments found to apply.");
    }

    await SellOrderPayment.insertMany(paymentRecords, { session });

    await session.commitTransaction();
    responseHandler(res, 200, "Payment applied successfully.", "success");
  } catch (error: any) {
    console.log("Error during transaction:", error);
    await session.abortTransaction();
    throw new InternalServerError(`Transaction failed: ${error?.message}`);
  } finally {
    session.endSession();
  }
});

const sendPayment = asyncHandler(async (req: Request, res: Response) => {
  const { orderIds, amount, date } = req.body;

  // Validate inputs
  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    throw new BadRequestError("`orderIds` must be a non-empty array.");
  }

  const paymentAmount = Number(amount);
  if (isNaN(paymentAmount) || paymentAmount <= 0) {
    throw new BadRequestError("`amount` must be a positive number.");
  }

  const session = await mongoose.startSession();

  try {
    await session.startTransaction();
    const orders = await Promise.all(
      orderIds.map((id: string) => Order.findById(id).session(session))
    );

    // Check for missing orders and filter out null values
    const validOrders = orders.filter(
      (order): order is NonNullable<typeof order> => order !== null
    );

    if (validOrders.length !== orderIds.length) {
      throw new BadRequestError("One or more orderIds are invalid.");
    }

    let remaining = paymentAmount;
    const paymentRecords = [];

    for (const order of validOrders) {
      // Avoid processing if no remaining amount
      if (remaining <= 0) break;

      const orderItems = await OrderItem.find({
        orderId: order._id,
        outstandingPrice: { $gt: 0 },
      })
        .sort({ deliveryDate: 1, createdAt: 1 })
        .session(session);

      for (const item of orderItems) {
        if (remaining <= 0) break;

        const applyAmount = Math.min(item.outstandingPrice, remaining);
        item.outstandingPrice -= applyAmount;
        remaining -= applyAmount;

        await item.save({ session });
      }

      // Update order's outstanding total
      order.outstandingTotal = await OrderItem.aggregate([
        { $match: { orderId: order._id } },
        {
          $group: {
            _id: null,
            totalOutstanding: { $sum: "$outstandingPrice" },
          },
        },
      ]).then((res) => res[0]?.totalOutstanding || 0);

      await order.save({ session });

      const appliedAmount = paymentAmount - remaining;
      if (appliedAmount > 0) {
        paymentRecords.push({
          orderId: order._id,
          method: "cash",
          amount: appliedAmount,
          date: date || new Date(),
          createdBy: req.userId,
        });
      }
    }

    if (paymentRecords.length === 0) {
      throw new BadRequestError("No outstanding payments found to apply.");
    }

    await OrderPayment.insertMany(paymentRecords, { session });

    await session.commitTransaction();
    responseHandler(res, 200, "Payment applied successfully.", "success");
  } catch (error: any) {
    await session.abortTransaction();
    throw new InternalServerError(`Transaction failed: ${error?.message}`);
  } finally {
    session.endSession();
  }
});

const getPaymentHistory = asyncHandler(async (req: Request, res: Response) => {
  const { clientId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(clientId)) {
    throw new BadRequestError("Invalid clientId");
  }

  const payments = await OrderPayment.aggregate([
    // Step 1: Join with Order
    {
      $lookup: {
        from: "orders",
        localField: "orderId",
        foreignField: "_id",
        as: "order",
      },
    },
    { $unwind: "$order" },

    // Step 2: Match only orders with the given clientId
    {
      $match: {
        "order.clientId": new mongoose.Types.ObjectId(clientId),
      },
    },

    // Step 3: Join with Client collection
    {
      $lookup: {
        from: "clients",
        localField: "order.clientId",
        foreignField: "_id",
        as: "client",
      },
    },
    { $unwind: "$client" },

    // Step 4: Join with User (createdBy)
    {
      $lookup: {
        from: "users",
        localField: "createdBy",
        foreignField: "_id",
        as: "createdBy",
      },
    },
    { $unwind: { path: "$createdBy", preserveNullAndEmptyArrays: true } },

    // Step 5: Project final output
    {
      $project: {
        _id: 1,
        amount: 1,
        method: 1,
        createdAt: 1,
        invoiceNumber: "$order.invoiceNumber",
        orderId: "$order._id",
        createdBy: {
          name: {
            $concat: ["$createdBy.firstName", " ", "$createdBy.lastName"],
          },
          _id: "$createdBy._id",
        },
        client: {
          _id: "$client._id",
          clientName: "$client.clientName",
          clientEmail: "$client.clientEmail",
          registeredName: "$client.registeredName",
          registeredAddress: "$client.registeredAddress",
          deliveryAddress: "$client.deliveryAddress",
          companyReferenceNumber: "$client.companyReferenceNumber",
        },
      },
    },

    // Step 6: Sort by latest
    { $sort: { createdAt: -1 } },
  ]);

  responseHandler(
    res,
    200,
    "Payment history fetched successfully",
    "success",
    payments
  );
});

export {
  getAllAccountingRecords,
  getClientById,
  receivePayment,
  sendPayment,
  getPaymentHistory,
};
