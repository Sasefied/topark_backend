// import { Request, Response } from "express";
// import { AdminProduct } from "../schemas/AdminProduct";
// import Client from "../schemas/ClientDetails";
// import Inventory from "../schemas/Inventory";
// import { responseHandler } from "../utils/responseHandler";
// import { Types } from "mongoose";

// /**
//  * Search buy products by product name, product alias, or client name.
//  * 
//  * @param {string} query - Search query string
//  * @param {number} page - Page number for pagination
//  * @param {number} limit - Number of items per page
//  * @returns {Promise<void>}
//  */
// const searchBuyProducts = async (req: Request, res: Response) => {
//   try {
//     const { query = "", page = 1, limit = 10 } = req.params;

//     // Find matching products and clients
//     const products = await AdminProduct.find({
//       $or: [
//         { productName: { $regex: query, $options: "i" } },
//         { productAlias: { $regex: query, $options: "i" } },
//       ],
//     }).select("_id productName productAlias");

//     console.log("Products found:", products);

//     const clients = await Client.find({
//       clientName: { $regex: query, $options: "i" },
//     }).select("_id clientName");

//     console.log("Clients found:", clients);

//     // Extract IDs
//     const productIds = products.map((product) => product._id);
//     const clientIds = clients.map((client) => client._id);

//     // If no products or clients found, return empty result
//     if (productIds.length === 0 && clientIds.length === 0) {
//       responseHandler(
//         res,
//         200,
//         "No matching products or clients found",
//         "success",
//         []
//       );
//       return;
//     }

//     console.log("userId", req.userId);

//     const pipeline = [
//       {
//         $match: {
//           $and: [
//             {
//               $or: [
//                 ...(productIds.length > 0
//                   ? [{ adminProductId: { $in: productIds } }]
//                   : []),
//                 ...(clientIds.length > 0
//                   ? [{ clientId: { $in: clientIds } }]
//                   : []),
//               ],
//             },
//             { userId: { $ne: new Types.ObjectId(req.userId) } }, // Exclude inventory where userId matches logged-in user
//           ],
//         },
//       },
//       {
//         $lookup: {
//           from: "adminproducts",
//           localField: "adminProductId",
//           foreignField: "_id",
//           as: "adminProductId",
//         },
//       },
//       {
//         $unwind: "$adminProductId",
//       },
//       {
//         $lookup: {
//           from: "clients",
//           localField: "clientId",
//           foreignField: "_id",
//           as: "clientId",
//         },
//       },
//       {
//         $unwind: "$clientId",
//       },
//       {
//         $project: {
//           "adminProductId.productName": 1,
//           "adminProductId.productAlias": 1,
//           "adminProductId.productCode": 1,
//           "adminProductId.size": 1,
//           "adminProductId.color": 1,
//           "clientId.clientName": 1,
//           "clientId.clientEmail": 1,
//           "clientId.registeredName": 1,
//           userId: 1,
//           grade: 1,
//           pricePerUnit: 1,
//           qtyInStock: 1,
//           qtyIncoming: 1,
//           sourceCountry: 1,
//           ccy: 1,
//           buyingPrice: 1,
//           tradingPrice: 1,
//           createdAt: 1,
//           updatedAt: 1,
//         },
//       },
//     ];

//     // If no conditions in $or, return empty result
//     if (pipeline[0].$match?.$and?.[0]?.$or?.length === 0) {
//       responseHandler(
//         res,
//         200,
//         "No matching products or clients found",
//         "success",
//         []
//       );
//       return;
//     }

//     const result = await (Inventory as any).aggregatePaginate(
//       Inventory.aggregate(pipeline),
//       {
//         page,
//         limit,
//         customLabels: {
//           docs: "buyOrders",
//           totalDocs: "totalBuyOrders",
//         },
//       }
//     );

//     responseHandler(res, 200, "Buy orders found", "success", result);
//   } catch (error) {
//     console.error("Error searching buy orders:", error);
//     responseHandler(res, 500, "Internal server error");
//   }
// };

// export { searchBuyProducts };




import { Request, Response } from "express";
import { AdminProduct } from "../schemas/AdminProduct";
import Client from "../schemas/ClientDetails";
import Inventory from "../schemas/Inventory";
import { responseHandler } from "../utils/responseHandler";
import { Types } from "mongoose";

/**
 * Search buy products by product name, product alias, product code, client name, or source country.
 *
 * @param {string} query - Search query string
 * @param {number} page - Page number for pagination
 * @param {number} limit - Number of items per page
 * @returns {Promise<void>}
 */
const searchBuyProducts = async (req: Request, res: Response) => {
  try {
    const { query = "", page = "1", limit = "10" } = req.query; // Use req.query
    const searchRegex = new RegExp(query as string, "i"); // Case-insensitive regex
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 10;

    console.log("Search Query:", query, "Page:", pageNum, "Limit:", limitNum);

    // Find matching products and clients
    const products = await AdminProduct.find({
      $or: [
        { productName: searchRegex },
        { productAlias: searchRegex },
        { productCode: searchRegex },
      ],
    }).select("_id");

    console.log("Products found:", JSON.stringify(products, null, 2));

    const clients = await Client.find({
      clientName: searchRegex,
    }).select("_id");

    console.log("Clients found:", JSON.stringify(clients, null, 2));

    const inventories = await Inventory.find({
      sourceCountry: searchRegex,
    }).select("_id");

    console.log("Inventories found by sourceCountry:", JSON.stringify(inventories, null, 2));

    // Extract IDs
    const productIds = products.map((product) => product._id);
    const clientIds = clients.map((client) => client._id);
    const inventoryIds = inventories.map((inv) => inv._id);

    // Build match conditions
    const matchConditions: any[] = [];
    if (productIds.length > 0) {
      matchConditions.push({ adminProductId: { $in: productIds } });
    }
    if (clientIds.length > 0) {
      matchConditions.push({ clientId: { $in: clientIds } });
    }
    if (inventoryIds.length > 0) {
      matchConditions.push({ _id: { $in: inventoryIds } });
    }

    // If no matches, return empty result with consistent structure
    if (matchConditions.length === 0) {
      const emptyResult = {
        buyOrders: [],
        totalBuyOrders: 0,
        page: pageNum,
        limit: limitNum,
        totalPages: 0,
        pagingCounter: 1,
        hasPrevPage: false,
        hasNextPage: false,
        prevPage: null,
        nextPage: null,
      };
      console.log("No matches found, returning:", JSON.stringify(emptyResult, null, 2));
      responseHandler(res, 200, "No matching products or clients found", "success", emptyResult);
      return;
    }

    console.log("User ID:", req.userId);

    const pipeline = [
      {
        $match: {
          $and: [
            { $or: matchConditions },
            req.userId ? { userId: { $ne: new Types.ObjectId(req.userId) } } : {},
          ],
        },
      },
      {
        $lookup: {
          from: "adminproducts",
          localField: "adminProductId",
          foreignField: "_id",
          as: "adminProductId",
        },
      },
      {
        $unwind: { path: "$adminProductId", preserveNullAndEmptyArrays: true },
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
        $unwind: { path: "$clientId", preserveNullAndEmptyArrays: true },
      },
      {
        $project: {
          _id: 1,
          "adminProductId.productName": 1,
          "adminProductId.productAlias": 1,
          "adminProductId.productCode": 1,
          "adminProductId.size": 1,
          "adminProductId.color": 1,
          "clientId._id": 1,
          "clientId.clientName": 1,
          "clientId.clientEmail": 1,
          "clientId.registeredName": 1,
          userId: 1,
          grade: 1,
          pricePerUnit: 1,
          qtyInStock: 1,
          qtyIncoming: 1,
          sourceCountry: 1,
          ccy: 1,
          buyingPrice: 1,
          tradingPrice: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    ];

    const result = await (Inventory as any).aggregatePaginate(Inventory.aggregate(pipeline), {
      page: pageNum,
      limit: limitNum,
      customLabels: {
        docs: "buyOrders",
        totalDocs: "totalBuyOrders",
      },
    });

    console.log("Search Result:", JSON.stringify(result, null, 2));
    responseHandler(res, 200, "Buy orders found", "success", result);
  } catch (error) {
    console.error("Error searching buy orders:", error);
    responseHandler(res, 500, "Internal server error");
  }
};

export { searchBuyProducts };