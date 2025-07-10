import { Request, Response } from "express";
import { AdminProduct } from "../schemas/AdminProduct";
import Client from "../schemas/ClientDetails";
import Inventory from "../schemas/Inventory";
import { responseHandler } from "../utils/responseHandler";
import { Types } from "mongoose";
import { PipelineStage } from "mongoose";

/**
 * Search buy products by product name, product alias, or client name.
 * 
 * @param {string} query - Search query string
 * @param {number} page - Page number for pagination
 * @param {number} limit - Number of items per page
 * @returns {Promise<void>}
 */
const searchBuyProducts = async (req: Request, res: Response) => {
  try {
    const { query = "", page = 1, limit = 10 } = req.params;

    // Build aggregation pipeline
    const pipeline = [
      // Match inventory items that do NOT belong to the authenticated user
      {
        $match: {
          userId: { $ne: new Types.ObjectId(req.userId) },
          adminProductId: { $exists: true, $ne: null }, // Ensure valid adminProductId
          clientId: { $exists: true, $ne: null }, // Ensure valid clientId
        },
      },
      // Lookup AdminProduct to get product details
      {
        $lookup: {
          from: "adminproducts",
          localField: "adminProductId",
          foreignField: "_id",
          as: "product",
        },
      },
      // Unwind the product array
      {
        $unwind: {
          path: "$product",
          preserveNullAndEmptyArrays: false, // Only include valid AdminProduct matches
        },
      },
    ];

    const result = await (Inventory as any).aggregatePaginate(
      Inventory.aggregate(pipeline as PipelineStage[]),
      {
        page,
        limit,
        customLabels: {
          docs: "buyOrders",
          totalDocs: "totalBuyOrders",
        },
      }
    );

    responseHandler(res, 200, "Buy orders found", "success", result);
  } catch (error) {
    console.error("Error searching buy orders:", error);
    responseHandler(res, 500, "Internal server error");
  }
};

export { searchBuyProducts };
