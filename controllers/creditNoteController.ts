


import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import CreditNote, { ICreditNote } from "../schemas/CreditNote";
import SellOrder from "../schemas/SellOrder";
import { responseHandler } from "../utils/responseHandler";
import mongoose from "mongoose";
import { BadRequestError } from "../utils/errors";

// Define interface for populated client
interface PopulatedClient {
  _id: string;
  clientName: string;
}

// Define interface for populated order
interface PopulatedOrder {
  _id: string;
  orderNumber: number;
  status: string;
}

// Define interface for the lean credit note with populated fields
interface LeanCreditNote extends Omit<ICreditNote, "clientId" | "orderId"> {
  _id: mongoose.Types.ObjectId;
  clientId?: PopulatedClient;
  orderId?: PopulatedOrder;
  total: number;
  createdAt?: Date;
}

const createCreditNote = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { orderId, clientId, startDate, endDate, total } = req.body;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      throw new Error("Invalid order ID");
    }

    const orderExists = await SellOrder.findById(orderId);
    if (!orderExists) {
      throw new Error("Order not found");
    }

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

    try {
      const order = await SellOrder.findById(id)
        .populate<{ clientId: PopulatedClient }>("clientId", "clientName")
        .lean();

      if (!order) {
        throw new BadRequestError("Order not found");
      }

      const dropdownOrder = {
        orderId: order._id.toString(),
        clientId: order.clientId?._id?.toString() || "",
        clientName: order.clientId?.clientName || "Unknown Client",
        orderNumber: order.orderNumber || "N/A",
        total: order.total || 0,
      };

      responseHandler(
        res,
        200,
        "Dropdown order fetched successfully",
        "success",
        dropdownOrder
      );
    } catch (error) {
      throw new BadRequestError("Order not found");
    }
  }
);

const getActiveCreditNotes = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || "";

    try {
      const pipeline: any[] = [
        {
          $match: {
            userId: new mongoose.Types.ObjectId(req.userId),
            endDate: { $gte: new Date() },
          },
        },
        {
          $lookup: {
            from: "clients",
            localField: "clientId",
            foreignField: "_id",
            as: "clientId",
          },
        },
        {
          $unwind: {
            path: "$clientId",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "sellorders",
            localField: "orderId",
            foreignField: "_id",
            as: "orderId",
          },
        },
        {
          $unwind: {
            path: "$orderId",
            preserveNullAndEmptyArrays: true,
          },
        },
      ];

      if (search) {
        pipeline.push({
          $match: {
            $or: [
              { "clientId.clientName": { $regex: search, $options: "i" } },
              { "orderId.orderNumber": { $regex: search, $options: "i" } },
            ],
          },
        });
      }

      pipeline.push({
        $sort: { createdAt: -1 },
      });

      const aggregate = CreditNote.aggregate(pipeline);
      const options = { page, limit };
      const result = await (CreditNote as any).aggregatePaginate(aggregate, options);

      console.log("Aggregation result.docs:", JSON.stringify(result.docs, null, 2));

      const creditNotes = result.docs.map((note: LeanCreditNote) => ({
        _id: note._id.toString(),
        orderId: note.orderId?._id?.toString() || "",
        clientId: note.clientId?._id?.toString() || "",
        clientName: note.clientId?.clientName || "Unknown Client",
        orderNumber: note.orderId?.orderNumber || "N/A",
        total: note.total || 0,
        status: note.orderId?.status || "ORDER_PRINTED",
        startDate: note.startDate,
        endDate: note.endDate,
        createdAt: note.createdAt,
      }));

      const responseData = {
        creditNotes,
        totalPages: result.totalPages,
        totalDocs: result.totalDocs,
        page: result.page,
        limit: result.limit,
      };

      responseHandler(
        res,
        200,
        "Active credit notes fetched successfully",
        "success",
        responseData
      );
    } catch (error: any) {
      console.error("Error fetching active credit notes:", error);
      throw new BadRequestError("Failed to fetch active credit notes");
    }
  }
);

const getAllCreditNotes = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || "";

    try {
      const pipeline: any[] = [
         {
          $match: {
            userId: new mongoose.Types.ObjectId(req.userId)
          },
        },
        {
          $lookup: {
            from: "clients",
            localField: "clientId",
            foreignField: "_id",
            as: "clientId",
          },
        },
        {
          $unwind: {
            path: "$clientId",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "sellorders",
            localField: "orderId",
            foreignField: "_id",
            as: "orderId",
          },
        },
        {
          $unwind: {
            path: "$orderId",
            preserveNullAndEmptyArrays: true,
          },
        },
      ];

      if (search) {
        pipeline.push({
          $match: {
            $or: [
              { "clientId.clientName": { $regex: search, $options: "i" } },
              { "orderId.orderNumber": { $regex: search, $options: "i" } },
            ],
          },
        });
      }

      pipeline.push({
        $sort: { createdAt: -1 },
      });

      const aggregate = CreditNote.aggregate(pipeline);
      const options = { page, limit };
      const result = await (CreditNote as any).aggregatePaginate(aggregate, options);

      console.log("Aggregation result.docs (all):", JSON.stringify(result.docs, null, 2));

      const creditNotes = result.docs.map((note: LeanCreditNote) => ({
        _id: note._id.toString(),
        orderId: note.orderId?._id?.toString() || "",
        clientId: note.clientId?._id?.toString() || "",
        clientName: note.clientId?.clientName || "Unknown Client",
        orderNumber: note.orderId?.orderNumber || "N/A",
        total: note.total || 0,
        status: note.orderId?.status || "ORDER_PRINTED",
        startDate: note.startDate,
        endDate: note.endDate,
        createdAt: note.createdAt,
      }));

      const responseData = {
        creditNotes,
        totalPages: result.totalPages,
        totalDocs: result.totalDocs,
        page: result.page,
        limit: result.limit,
      };

      responseHandler(
        res,
        200,
        "Credit notes fetched successfully",
        "success",
        responseData
      );
    } catch (error: any) {
      console.error("Error fetching credit notes:", error);
      throw new BadRequestError("Failed to fetch credit notes");
    }
  }
);

export { createCreditNote, getSellOrderForDropdown, getActiveCreditNotes, getAllCreditNotes };