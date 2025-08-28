import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import Order from "../schemas/Order";
import SellOrder from "../schemas/SellOrder";
import { responseHandler } from "../utils/responseHandler";
import mongoose from "mongoose";
import { BadRequestError } from "../utils/errors";

const getAllAccountingRecords = asyncHandler(
  async (req: Request, res: Response) => {
    const { startDate, endDate, clientName } = req.query;

    if (!startDate || !endDate) {
      throw new BadRequestError("startDate and endDate are required");
    }
    const start = new Date(startDate.toString());
    const end = new Date(endDate.toString());

    const payments = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          //   orderStatus: { $in: ["Confirmed", "Delivered"] },
          userId: new mongoose.Types.ObjectId(req.userId),
        },
      },
     {
        $lookup: {
          from: 'clients',
          localField: 'clientId',
          foreignField: '_id',
          as: 'client'
        }
      },
      { $unwind: '$client' },
      ...(clientName ? [{
        $match: {
          'client.clientName': { $regex: clientName, $options: 'i' }
        }
      }] : []),
      {
        $group: {
          _id: '$clientId',
          totalPaid: { $sum: '$total' },
          outstandingTotal: { $sum: '$outstandingTotal' }
        }
      },
      {
        $lookup: {
          from: 'clients',
          localField: '_id',
          foreignField: '_id',
          as: 'client'
        }
      },
      { $unwind: '$client' },
      {
        $project: {
          clientId: '$_id',
          clientName: '$client.clientName',
          totalPaid: 1,
          outstandingTotal: 1
        }
      }
    ]);

    console.log("Payments:", payments.length);

    // Aggregate receivables (SellOrders)
    const receivables = await SellOrder.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          //   status: { $in: ["ORDER_CONFIRMED", "ORDER_DELIVERED"] },
          userId: new mongoose.Types.ObjectId(req.userId),
        },
      },
      {
        $lookup: {
          from: 'clients',
          localField: 'clientId',
          foreignField: '_id',
          as: 'client'
        }
      },
      { $unwind: '$client' },
      ...(clientName ? [{
        $match: {
          'client.clientName': { $regex: clientName, $options: 'i' }
        }
      }] : []),
      {
        $group: {
          _id: '$clientId',
          totalReceived: { $sum: '$total' }
        }
      },
      {
        $lookup: {
          from: 'clients',
          localField: '_id',
          foreignField: '_id',
          as: 'client'
        }
      },
      { $unwind: '$client' },
      {
        $project: {
          clientId: '$_id',
          clientName: '$client.clientName',
          totalReceived: 1
        }
      }
    ]);

    console.log("Receivables:", receivables.length);

     // Combine all unique clients from both payments and receivables
    const clientIds = new Set([...payments.map(p => p.clientId.toString()), ...receivables.map(r => r.clientId.toString())]);
    console.log("Unique Client IDs:", clientIds);
    const accountingRecords = Array.from(clientIds).map(clientId => {
      const payment = payments.find(p => p.clientId.toString() === clientId) || { totalPaid: 0, totalOutstanding: 0, dates: [], clientName: '' };
      const receivable = receivables.find(r => r.clientId.toString() === clientId) || { totalReceived: 0, dates: [], clientName: '' };
      return {
        clientId,
        clientName: payment.clientName || receivable.clientName,
        pay: payment.totalPaid,
        receive: receivable.totalReceived,
        outstanding: payment.totalOutstanding,
      };
    });

    responseHandler(
      res,
      200,
      "Accounting records fetched successfully",
      "success",
      accountingRecords
    );
  }
);

export { getAllAccountingRecords };
