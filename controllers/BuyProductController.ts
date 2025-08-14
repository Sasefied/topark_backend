import { Request, Response } from "express";
import Inventory from "../schemas/Inventory";
import { responseHandler } from "../utils/responseHandler";
import { Types } from "mongoose";

const searchBuyProducts = async (req: Request, res: Response) => {
  try {
    const { query = "", page = "1", limit = "10" } = req.query;
    const pipeline = [
      {
        $match: {
          userId: { $ne: new Types.ObjectId(req.userId) },
        },
      },
      {
        $lookup: {
          from: "adminproducts",
          localField: "adminProductId",
          foreignField: "_id",
          as: "adminProduct",
        },
      },
      {
        $unwind: {
          path: "$adminProduct",
          preserveNullAndEmptyArrays: true,
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
      {
        $unwind: {
          path: "$client",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $match: {
          $or: [
            {
              "adminProduct.productName": { $regex: query, $options: "i" },
            },
            {
              "adminProduct.productAlias": {
                $regex: query,
                $options: "i",
              },
            },
            {
              "adminProduct.productCode": { $regex: query, $options: "i" },
            },
            { "client.clientName": { $regex: query, $options: "i" } },
          ],
        },
      },
      {
        $project: {
          _id: 1,
          adminProductId: 1,
          userId: 1,
          clientId: 1,
          adminProduct: {
            productName: 1,
            size: 1,
            color: 1,
          },
          client: {
            clientName: 1,
          },
        },
      },
    ];

    const result = await (Inventory as any).aggregatePaginate(
      Inventory.aggregate(pipeline),
      {
        page,
        limit,
        customLabels: {
          docs: "buyOrders",
          totalDocs: "totalBuyOrders",
        },
      }
    );

    console.log("Search Result:", JSON.stringify(result, null, 2));
    responseHandler(res, 200, "Buy orders found", "success", result);
  } catch (error) {
    console.error("Error searching buy orders:", error);
    responseHandler(res, 500, "Internal server error");
  }
};

export { searchBuyProducts };
