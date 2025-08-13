import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import CreditNote from "../schemas/CreditNote";
import { responseHandler } from "../utils/responseHandler";
import mongoose from "mongoose";
import SellOrder from "../schemas/SellOrder";


const createCreditNote = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { orderId, clientId, startDate, endDate, total } = req.body;

    // Validate orderId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      throw new Error("Invalid order ID");
    }

    // Check if the order exists
    const orderExists = await SellOrder.findById(orderId);
    if (!orderExists) {
      throw new Error("Order not found");
    }

    // Validate clientId if necessary
    if (!mongoose.Types.ObjectId.isValid(clientId)) {
      throw new Error("Invalid client ID");
    }

    await CreditNote.create({
      userId: req.userId,
      orderId,
      clientId,
      startDate,
      endDate,
      total,
    });

    responseHandler(res, 200, "Credit note created successfully", "success");
  }
);


const getSellOrderForDropdown = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    // Assume id can be orderNumber (numeric string) or ObjectId
    const matchStage = isNaN(Number(id))
      ? { _id: new mongoose.Types.ObjectId(id) }
      : { orderNumber: Number(id) };

    const order = await SellOrder.aggregate([
      { $match: matchStage },
      {
        $lookup: {
          from: "clients",
          localField: "clientId",
          foreignField: "_id",
          as: "client",
        },
      },
      { $unwind: { path: "$client", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          orderNumber: 1,
          clientName: "$client.clientName",
          orderId: "$_id", // Return the _id as orderId
        },
      },
    ]);

    if (!order || order.length === 0) {
      throw new Error("Order not found");
    }

    responseHandler(
      res,
      200,
      "Order details for dropdown fetched successfully",
      "success",
      order[0]
    );
  }
);


export { createCreditNote, getSellOrderForDropdown };