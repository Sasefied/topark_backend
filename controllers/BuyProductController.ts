import { Request, Response } from "express";
import Inventory from "../schemas/Inventory";
import { responseHandler } from "../utils/responseHandler";
import { Types } from "mongoose";
import MyClientModel from "../schemas/MyClient";

const searchBuyProducts = async (req: Request, res: Response) => {
  try {
    const { query = "", page = "1", limit = "10" } = req.query;

    const myClient = await MyClientModel.findOne({ userId: req.userId })
      .select("clientId client")
      .lean();

    console.log("myClient:", myClient);
    if (!myClient || !myClient.clientId || myClient.clientId.length === 0) {
      // No clients associated with this user, return empty results
      return responseHandler(res, 200, "No buy orders found", "success", {
        buyOrders: [],
        totalBuyOrders: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
        pagingCounter: 1,
        hasPrevPage: false,
        hasNextPage: false,
        prevPage: null,
        nextPage: null,
      });
    }

    const allowedClientIds = myClient?.client?.map((client: any) => client.userId);

    console.log("allowedClientIds:", allowedClientIds);
    console.log("userId", req.userId);

    const pipeline = [
      // Initial match: Exclude own userId
      {
        $match: {
          $and: [
            { userId: { $ne: new Types.ObjectId(req.userId) } },
            { clientId: { $in: allowedClientIds } },
          ]
        },
      },
      // Lookup client first to filter by allowed client IDs
      {
        $lookup: {
          from: "clients",
          localField: "clientId",
          foreignField: "userId",
          as: "client",
        },
      },
      {
        $unwind: {
          path: "$client",
          preserveNullAndEmptyArrays: false, // Change to false to exclude items without matching clients
        },
      },
      // Lookup adminProduct
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
      // Apply search query (after lookups to search joined fields)
      {
        $match: {
          $or: [
            { "adminProduct.productName": { $regex: query, $options: "i" } },
            { "adminProduct.productAlias": { $regex: query, $options: "i" } },
            { "adminProduct.productCode": { $regex: query, $options: "i" } },
            { "client.clientName": { $regex: query, $options: "i" } },
          ],
        },
      },
      // Project required fields
      {
        $project: {
          _id: 1,
          adminProductId: 1,
          userId: 1,
          clientId: 1,
          grade: 1,
          pricePerUnit: 1,
          qtyInStock: 1,
          qtyIncoming: 1,
          sourceCountry: 1,
          ccy: 1,
          buyingPrice: 1,
          tradingPrice: 1,
          adminProduct: {
            productName: { $ifNull: ["$adminProduct.productName", "N/A"] },
            productAlias: { $ifNull: ["$adminProduct.productAlias", "N/A"] },
            productCode: { $ifNull: ["$adminProduct.productCode", "N/A"] },
            size: { $ifNull: ["$adminProduct.size", "N/A"] },
            color: { $ifNull: ["$adminProduct.color", "N/A"] },
            variety: {$ifNull: ["$adminProduct.variety", "N/A"]}
          },
          client: {
            _id: 1,
            clientName: { $ifNull: ["$client.clientName", "N/A"] },
            clientId: { $ifNull: ["$client.clientId", "N/A"] },
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
