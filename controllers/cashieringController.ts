import { Request, Response } from "express";
import { responseHandler } from "../utils/responseHandler";
import Order, { IOrder } from "../schemas/Order";
import OrderItem from "../schemas/OrderItem";
import {
  BadRequestError,
  InternalServerError,
  NotFoundError,
} from "../utils/errors";
import OrderPayment from "../schemas/OrderPayment";
import { Types } from "mongoose";
import SellOrder, { ISellOrder } from "../schemas/SellOrder";
import SellOrderItem from "../schemas/SellOrderItem";
import SellOrderPayment from "../schemas/SellOrderPayment";

const getAllCashieringOrders = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    if (!req.userId || !Types.ObjectId.isValid(req.userId)) {
      return responseHandler(res, 401, "Invalid or missing userId", "error");
    }

    const orderAggregate = Order.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(req.userId),
          // orderStatus: "Delivered",
        },
      },
      {
        $lookup: {
          from: "orderitems",
          localField: "_id",
          foreignField: "orderId",
          as: "orderItems",
        },
      },
      {
        $lookup: {
          from: "inventories",
          localField: "orderItems.inventoryId",
          foreignField: "_id",
          as: "inventory",
        },
      },
      {
        $lookup: {
          from: "clients",
          localField: "inventory.clientId",
          foreignField: "userId",
          as: "clientDetails",
        },
      },
      {
        $unwind: { path: "$clientDetails", preserveNullAndEmptyArrays: true },
      },
      {
        $set: {
          clientDetails: {
            $cond: {
              if: { $eq: ["$clientDetails", {}] },
              then: {
                clientName: "Unknown Client",
                clientId: null,
                email: null,
              },
              else: "$clientDetails",
            },
          },
        },
      },
      {
        $lookup: {
          from: "adminproducts",
          localField: "inventory.adminProductId",
          foreignField: "_id",
          as: "adminProducts",
        },
      },
      {
        $group: {
          _id: "$clientDetails.clientId", // Group by clientId
          clientDetails: { $first: "$clientDetails" }, // Keep client details
          orders: {
            $push: {
              _id: "$_id",
              invoiceNumber: "$invoiceNumber",
              total: "$total",
              outstandingTotal: "$outstandingTotal",
              createdAt: "$createdAt",
              numberOfItems: { $size: "$orderItems" },
            },
          },
          totalOrders: { $sum: 1 }, // Count of orders per client
          totalAmount: { $sum: "$total" }, // Sum of total amounts
          totalOutstanding: { $sum: "$outstandingTotal" }, // Sum of outstanding amounts
          totalItems: { $sum: { $size: "$orderItems" } }, // Sum of items across orders
        },
      },
      {
        $sort: {
          "clientDetails.clientName": 1, // Sort by client name for consistency
        },
      },
      {
        $project: {
          _id: 0, // Suppress _id field
          clientId: "$_id", // Rename _id to clientId
          clientDetails: {
            clientName: "$clientDetails.clientName",
            clientId: { $ifNull: ["$clientDetails.clientId", null] },
            email: { $ifNull: ["$clientDetails.email", null] },
          },
          orders: 1,
          totalOrders: 1,
          totalAmount: 1,
          totalOutstanding: 1,
          totalItems: 1,
          orderDate: { $max: "$orders.createdAt" },
        },
      },
    ]);

    const orders = await (Order as any).aggregatePaginate(orderAggregate, {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      customLabels: {
        docs: "clients", // Changed to "clients" to reflect grouped data
        totalDocs: "totalClients",
      },
    });

    console.log("Clients fetched from DB:", JSON.stringify(orders, null, 2));
    responseHandler(
      res,
      200,
      "Clients and their orders fetched successfully",
      "success",
      orders
    );
  } catch (error: any) {
    console.error("Error fetching cashiering orders:", {
      message: error.message,
      stack: error.stack,
      userId: req.userId,
    });
    responseHandler(
      res,
      500,
      error.message || "Failed to fetch orders",
      "error"
    );
  }
};

const getAllCashieringSellOrders = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    if (!req.userId || !Types.ObjectId.isValid(req.userId)) {
      return responseHandler(res, 401, "Invalid or missing userId", "error");
    }

    const sellOrderAggregate = SellOrder.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(req.userId),
          // orderStatus: "Delivered",
        },
      },
      {
        $lookup: {
          from: "sellorderitems",
          localField: "_id",
          foreignField: "orderId",
          as: "orderItems",
        },
      },
      {
        $lookup: {
          from: "inventories",
          localField: "orderItems.inventoryId",
          foreignField: "_id",
          as: "inventory",
        },
      },
      {
        $lookup: {
          from: "clients",
          localField: "inventory.clientId",
          foreignField: "userId",
          as: "clientDetails",
        },
      },
      {
        $unwind: { path: "$clientDetails", preserveNullAndEmptyArrays: true },
      },
      {
        $set: {
          clientDetails: {
            $cond: {
              if: { $eq: ["$clientDetails", {}] },
              then: {
                clientName: "Unknown Client",
                clientId: null,
                email: null,
              },
              else: "$clientDetails",
            },
          },
        },
      },
      {
        $lookup: {
          from: "adminproducts",
          localField: "inventory.adminProductId",
          foreignField: "_id",
          as: "adminProducts",
        },
      },
      {
        $group: {
          _id: "$clientDetails.clientId", // Group by clientId
          clientDetails: { $first: "$clientDetails" }, // Keep client details
          orders: {
            $push: {
              _id: "$_id",
              invoiceNumber: "$invoiceNumber",
              total: "$total",
              outstandingTotal: "$outstandingTotal",
              createdAt: "$createdAt",
              numberOfItems: { $size: "$orderItems" },
            },
          },
          totalOrders: { $sum: 1 }, // Count of orders per client
          totalAmount: { $sum: "$total" }, // Sum of total amounts
          totalOutstanding: { $sum: "$outstandingTotal" }, // Sum of outstanding amounts
          totalItems: { $sum: { $size: "$orderItems" } }, // Sum of items across orders
        },
      },
      {
        $sort: {
          "clientDetails.clientName": 1, // Sort by client name for consistency
        },
      },
      {
        $project: {
          _id: 0, // Suppress _id field
          clientId: "$_id", // Rename _id to clientId
          clientDetails: {
            clientName: "$clientDetails.clientName",
            clientId: { $ifNull: ["$clientDetails.clientId", null] },
            email: { $ifNull: ["$clientDetails.email", null] },
          },
          orders: 1,
          totalOrders: 1,
          totalAmount: 1,
          totalOutstanding: 1,
          totalItems: 1,
          orderDate: { $max: "$orders.createdAt" },
        },
      },
    ]);

    const orders = await (SellOrder as any).aggregatePaginate(sellOrderAggregate, {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      customLabels: {
        docs: "clients", // Changed to "clients" to reflect grouped data
        totalDocs: "totalClients",
      },
    });

    console.log("Clients fetched from DB:", JSON.stringify(orders, null, 2));
    responseHandler(
      res,
      200,
      "Clients and their orders fetched successfully",
      "success",
      orders
    );
  } catch (error: any) {
    console.error("Error fetching cashiering orders:", {
      message: error.message,
      stack: error.stack,
      userId: req.userId,
    });
    responseHandler(
      res,
      500,
      error.message || "Failed to fetch orders",
      "error"
    );
  }
};

const getAllCashieringOrdersCombined = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    if (!req.userId || !Types.ObjectId.isValid(req.userId)) {
      return responseHandler(res, 401, "Invalid or missing userId", "error");
    }

    const userObjectId = new Types.ObjectId(req.userId);

    const combinedAggregate = Order.aggregate([
      // Base: Buy Orders
      {
        $match: {
          userId: userObjectId,
        },
      },
      {
        $lookup: {
          from: "orderitems",
          localField: "_id",
          foreignField: "orderId",
          as: "orderItems",
        },
      },
      {
        $lookup: {
          from: "inventories",
          localField: "orderItems.inventoryId",
          foreignField: "_id",
          as: "inventory",
        },
      },
      {
        $lookup: {
          from: "clients",
          localField: "inventory.clientId",
          foreignField: "userId",
          as: "clientDetails",
        },
      },
      {
        $unwind: { path: "$clientDetails", preserveNullAndEmptyArrays: true },
      },
      {
        $set: {
          clientDetails: {
            $cond: {
              if: { $eq: ["$clientDetails", {}] },
              then: { clientName: "Unknown Client", clientId: null, email: null },
              else: "$clientDetails",
            },
          },
          orderType: "buy",
        },
      },
      { $addFields: { itemsCount: { $size: "$orderItems" } } },
      {
        $project: {
          _id: 1,
          invoiceNumber: "$invoiceNumber",
          total: 1,
          outstandingTotal: 1,
          createdAt: 1,
          itemsCount: 1,
          clientDetails: 1,
          orderType: 1,
        },
      },
      // Union with Sell Orders
      {
        $unionWith: {
          coll: "sellorders",
          pipeline: [
            { $match: { userId: userObjectId } },
            {
              $lookup: {
                from: "sellorderitems",
                localField: "_id",
                foreignField: "orderId",
                as: "orderItems",
              },
            },
            {
              $lookup: {
                from: "inventories",
                localField: "orderItems.inventoryId",
                foreignField: "_id",
                as: "inventory",
              },
            },
            {
              $lookup: {
                from: "clients",
                localField: "inventory.clientId",
                foreignField: "userId",
                as: "clientDetails",
              },
            },
            {
              $unwind: { path: "$clientDetails", preserveNullAndEmptyArrays: true },
            },
            {
              $set: {
                clientDetails: {
                  $cond: {
                    if: { $eq: ["$clientDetails", {}] },
                    then: { clientName: "Unknown Client", clientId: null, email: null },
                    else: "$clientDetails",
                  },
                },
                orderType: "sell",
              },
            },
            { $addFields: { itemsCount: { $size: "$orderItems" } } },
            {
              $project: {
                _id: 1,
                // Normalize invoice number between two collections
                invoiceNumber: { $ifNull: ["$invoiceNumber", { $toString: "$orderNumber" }] },
                total: 1,
                outstandingTotal: 1,
                createdAt: 1,
                itemsCount: 1,
                clientDetails: 1,
                orderType: 1,
              },
            },
          ],
        },
      },
      // Group combined orders by client
      {
        $group: {
          _id: "$clientDetails.clientId",
          clientDetails: { $first: "$clientDetails" },
          orders: {
            $push: {
              _id: "$_id",
              type: "$orderType",
              invoiceNumber: "$invoiceNumber",
              total: "$total",
              outstandingTotal: "$outstandingTotal",
              createdAt: "$createdAt",
              numberOfItems: "$itemsCount",
            },
          },
          totalOrders: { $sum: 1 },
          totalAmount: { $sum: "$total" },
          totalOutstanding: { $sum: "$outstandingTotal" },
          totalItems: { $sum: "$itemsCount" },
        },
      },
      { $sort: { "clientDetails.clientName": 1 } },
      {
        $project: {
          _id: 0,
          clientId: "$_id",
          clientDetails: {
            clientName: "$clientDetails.clientName",
            clientId: { $ifNull: ["$clientDetails.clientId", null] },
            email: { $ifNull: ["$clientDetails.email", null] },
          },
          orders: 1,
          totalOrders: 1,
          totalAmount: 1,
          totalOutstanding: 1,
          totalItems: 1,
          orderDate: { $max: "$orders.createdAt" },
        },
      },
    ]);

    const result = await (Order as any).aggregatePaginate(combinedAggregate, {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      customLabels: { docs: "clients", totalDocs: "totalClients" },
    });

    return responseHandler(
      res,
      200,
      "Clients and their (buy + sell) orders fetched successfully",
      "success",
      result
    );
  } catch (error: any) {
    console.error("Error fetching combined cashiering orders:", {
      message: error.message,
      stack: error.stack,
      userId: req.userId,
    });
    return responseHandler(
      res,
      500,
      error.message || "Failed to fetch combined orders",
      "error"
    );
  }
};

const searchCashieringOrders = async (req: Request, res: Response) => {
  try {
    const { query } = req.params;
    const { page = 1, limit = 10 } = req.query;

    if (!query || typeof query !== "string") {
      return responseHandler(
        res,
        400,
        "Invalid or missing search query",
        "error"
      );
    }

    const orderAggregate = Order.aggregate([
      {
        $lookup: {
          from: "orderitems",
          localField: "_id",
          foreignField: "orderId",
          as: "orderItems",
        },
      },
      {
        $lookup: {
          from: "inventories",
          localField: "orderItems.inventoryId",
          foreignField: "_id",
          as: "inventory",
        },
      },
      {
        $lookup: {
          from: "clients",
          localField: "inventory.clientId",
          foreignField: "userId",
          as: "clientDetails",
        },
      },
      {
        $unwind: { path: "$clientDetails", preserveNullAndEmptyArrays: true },
      },
      {
        $set: {
          clientDetails: {
            $cond: {
              if: { $eq: ["$clientDetails", {}] },
              then: {
                clientName: "Unknown Client",
                clientId: null,
                email: null,
              },
              else: "$clientDetails",
            },
          },
        },
      },
      {
        $match: {
          $or: [
            { invoiceNumber: { $regex: query, $options: "i" } },
            { "clientDetails.clientName": { $regex: query, $options: "i" } },
          ],
        },
      },
      {
        $group: {
          _id: "$clientDetails.clientId",
          clientDetails: { $first: "$clientDetails" },
        },
      },
      {
        $sort: {
          "clientDetails.clientName": 1,
        },
      },
      {
        $project: {
          _id: 0,
          clientId: "$_id",
          clientDetails: {
            clientName: "$clientDetails.clientName",
            clientId: { $ifNull: ["$clientDetails.clientId", null] },
          },
        },
      },
    ]);

    const clients = await (Order as any).aggregatePaginate(orderAggregate, {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      customLabels: {
        docs: "clients",
        totalDocs: "totalClients",
      },
    });
    responseHandler(
      res,
      200,
      "Clients fetched successfully",
      "success",
      clients
    );
  } catch (error: any) {
    responseHandler(
      res,
      500,
      error.message || "Failed to search orders",
      "error"
    );
  }
};

const searchCashieringSellOrders = async (req: Request, res: Response) => {
  try {
    const { query } = req.params;
    const { page = 1, limit = 10 } = req.query;

    if (!query || typeof query !== "string") {
      return responseHandler(
        res,
        400,
        "Invalid or missing search query",
        "error"
      );
    }

    const sellOrderAggregate = SellOrder.aggregate([
      {
        $lookup: {
          from: "sellorderitems",
          localField: "_id",
          foreignField: "orderId",
          as: "orderItems",
        },
      },
      {
        $lookup: {
          from: "inventories",
          localField: "orderItems.inventoryId",
          foreignField: "_id",
          as: "inventory",
        },
      },
      {
        $lookup: {
          from: "clients",
          localField: "inventory.clientId",
          foreignField: "userId",
          as: "clientDetails",
        },
      },
      {
        $unwind: { path: "$clientDetails", preserveNullAndEmptyArrays: true },
      },
      {
        $set: {
          clientDetails: {
            $cond: {
              if: { $eq: ["$clientDetails", {}] },
              then: {
                clientName: "Unknown Client",
                clientId: null,
                email: null,
              },
              else: "$clientDetails",
            },
          },
        },
      },
      {
        $match: {
          $or: [
            { invoiceNumber: { $regex: query, $options: "i" } },
            { "clientDetails.clientName": { $regex: query, $options: "i" } },
          ],
        },
      },
      {
        $group: {
          _id: "$clientDetails.clientId",
          clientDetails: { $first: "$clientDetails" },
        },
      },
      {
        $sort: {
          "clientDetails.clientName": 1,
        },
      },
      {
        $project: {
          _id: 0,
          clientId: "$_id",
          clientDetails: {
            clientName: "$clientDetails.clientName",
            clientId: { $ifNull: ["$clientDetails.clientId", null] },
          },
        },
      },
    ]);

    const clients = await (SellOrder as any).aggregatePaginate(sellOrderAggregate, {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      customLabels: {
        docs: "clients",
        totalDocs: "totalClients",
      },
    });
    responseHandler(
      res,
      200,
      "Clients fetched successfully",
      "success",
      clients
    );
  } catch (error: any) {
    responseHandler(
      res,
      500,
      error.message || "Failed to search orders",
      "error"
    );
  }
};

const searchCashieringOrdersCombined = async (req: Request, res: Response) => {
  try {
    const { query } = req.params;
    const { page = 1, limit = 10 } = req.query;

    if (!query || typeof query !== "string") {
      return responseHandler(
        res,
        400,
        "Invalid or missing search query",
        "error"
      );
    }

    const combinedAggregate = Order.aggregate([
      // Base: Buy Orders
      {
        $lookup: {
          from: "orderitems",
          localField: "_id",
          foreignField: "orderId",
          as: "orderItems",
        },
      },
      {
        $lookup: {
          from: "inventories",
          localField: "orderItems.inventoryId",
          foreignField: "_id",
          as: "inventory",
        },
      },
      {
        $lookup: {
          from: "clients",
          localField: "inventory.clientId",
          foreignField: "userId",
          as: "clientDetails",
        },
      },
      { $unwind: { path: "$clientDetails", preserveNullAndEmptyArrays: true } },
      {
        $set: {
          clientDetails: {
            $cond: {
              if: { $eq: ["$clientDetails", {}] },
              then: { clientName: "Unknown Client", clientId: null, email: null },
              else: "$clientDetails",
            },
          },
          orderType: "buy",
        },
      },
      { $addFields: { itemsCount: { $size: "$orderItems" } } },
      {
        $project: {
          _id: 1,
          invoiceNumber: "$invoiceNumber",
          total: 1,
          outstandingTotal: 1,
          createdAt: 1,
          itemsCount: 1,
          clientDetails: 1,
          orderType: 1,
        },
      },
      // Union with Sell Orders
      {
        $unionWith: {
          coll: "sellorders",
          pipeline: [
            {
              $lookup: {
                from: "sellorderitems",
                localField: "_id",
                foreignField: "orderId",
                as: "orderItems",
              },
            },
            {
              $lookup: {
                from: "inventories",
                localField: "orderItems.inventoryId",
                foreignField: "_id",
                as: "inventory",
              },
            },
            {
              $lookup: {
                from: "clients",
                localField: "inventory.clientId",
                foreignField: "userId",
                as: "clientDetails",
              },
            },
            { $unwind: { path: "$clientDetails", preserveNullAndEmptyArrays: true } },
            {
              $set: {
                clientDetails: {
                  $cond: {
                    if: { $eq: ["$clientDetails", {}] },
                    then: { clientName: "Unknown Client", clientId: null, email: null },
                    else: "$clientDetails",
                  },
                },
                orderType: "sell",
              },
            },
            { $addFields: { itemsCount: { $size: "$orderItems" } } },
            {
              $project: {
                _id: 1,
                // Normalize invoice number between two collections
                invoiceNumber: { $ifNull: ["$invoiceNumber", { $toString: "$orderNumber" }] },
                total: 1,
                outstandingTotal: 1,
                createdAt: 1,
                itemsCount: 1,
                clientDetails: 1,
                orderType: 1,
              },
            },
          ],
        },
      },
      // Apply search to combined stream
      {
        $match: {
          $or: [
            { invoiceNumber: { $regex: query, $options: "i" } },
            { "clientDetails.clientName": { $regex: query, $options: "i" } },
          ],
        },
      },
      // Group combined orders by client and compute aggregates
      {
        $group: {
          _id: "$clientDetails.clientId",
          clientDetails: { $first: "$clientDetails" },
          orders: {
            $push: {
              _id: "$_id",
              type: "$orderType",
              invoiceNumber: "$invoiceNumber",
              total: "$total",
              outstandingTotal: "$outstandingTotal",
              createdAt: "$createdAt",
              numberOfItems: "$itemsCount",
            },
          },
          totalOrders: { $sum: 1 },
          totalAmount: { $sum: "$total" },
          totalOutstanding: { $sum: "$outstandingTotal" },
          totalItems: { $sum: "$itemsCount" },
        },
      },
      { $sort: { "clientDetails.clientName": 1 } },
      {
        $project: {
          _id: 0,
          clientId: "$_id",
          clientDetails: {
            clientName: "$clientDetails.clientName",
            clientId: { $ifNull: ["$clientDetails.clientId", null] },
            email: { $ifNull: ["$clientDetails.email", null] },
          },
          orders: 1,
          totalOrders: 1,
          totalAmount: 1,
          totalOutstanding: 1,
          totalItems: 1,
          orderDate: { $max: "$orders.createdAt" },
        },
      },
    ]);

    const clients = await (Order as any).aggregatePaginate(combinedAggregate, {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      customLabels: {
        docs: "clients",
        totalDocs: "totalClients",
      },
    });

    responseHandler(
      res,
      200,
      "Clients fetched successfully",
      "success",
      clients
    );
  } catch (error: any) {
    responseHandler(
      res,
      500,
      error.message || "Failed to search orders",
      "error"
    );
  }
};

const getCashieringOrderByIds = async (req: Request, res: Response) => {
  const { orderIds } = req.body;

  if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
    return responseHandler(res, 400, "Invalid or missing orderIds", "error");
  }

  const objectIds = orderIds
    .filter((id: string) => Types.ObjectId.isValid(id))
    .map((id: string) => new Types.ObjectId(id));

  if (objectIds.length === 0) {
    return responseHandler(res, 400, "No valid orderIds provided", "error");
  }

  try {
    const orders = await Order.aggregate([
      {
        $match: { _id: { $in: objectIds } },
      },
      {
        $lookup: {
          from: "orderitems",
          localField: "_id",
          foreignField: "orderId",
          as: "orderItems",
        },
      },
      {
        $lookup: {
          from: "inventories",
          localField: "orderItems.inventoryId",
          foreignField: "_id",
          as: "inventory",
        },
      },
      {
        $unwind: { path: "$inventory", preserveNullAndEmptyArrays: true },
      },
      {
        $lookup: {
          from: "clients",
          localField: "inventory.clientId",
          foreignField: "userId",
          as: "clientDetails",
        },
      },
      {
        $unwind: { path: "$clientDetails", preserveNullAndEmptyArrays: true },
      },
      {
        $set: {
          clientDetails: {
            $cond: {
              if: { $eq: ["$clientDetails", {}] },
              then: {
                clientName: "Unknown Client",
                clientId: null,
                email: null,
              },
              else: {
                clientName: "$clientDetails.clientName",
                clientId: { $ifNull: ["$clientDetails.clientId", null] },
                email: { $ifNull: ["$clientDetails.clientEmail", null] },
                address: { $ifNull: ["$clientDetails.deliveryAddress", null] },
                note: { $ifNull: ["$clientDetails.clientNotes", null] },
                regName: { $ifNull: ["$clientDetails.registeredName", null] },
                regAddress: {
                  $ifNull: ["$clientDetails.registeredAddress", null],
                },
              },
            },
          },
        },
      },
      {
        $lookup: {
          from: "adminproducts",
          localField: "inventory.adminProductId",
          foreignField: "_id",
          as: "adminProducts",
        },
      },
      {
        $sort: {
          createdAt: -1,
        },
      },
      {
        $project: {
          _id: 1,
          invoiceNumber: 1,
          total: 1,
          outstandingTotal: 1,
          createdAt: 1,
          numberOfItems: { $size: "$orderItems" },
          clientDetails: 1,
          orderItems: {
            $map: {
              input: "$orderItems",
              as: "item",
              in: {
                _id: "$$item._id",
                inventoryId: "$$item.inventoryId",
                quantity: "$$item.quantity",
                price: "$$item.price",
              },
            },
          },
          // adminProducts: {
          //   $map: {
          //     input: "$adminProducts",
          //     as: "product",
          //     in: {
          //       _id: "$$product._id",
          //       name: { $ifNull: ["$$product.name", "Unknown Product"] }, // Ensure name is included
          //     },
          //   },
          // },
          adminProducts: {
            $cond: {
              if: { $eq: ["$adminProducts", []] },
              then: [
                { productName: "Unknown Product", size: "N/A", color: "N/A" },
              ],
              else: "$adminProducts",
            },
          },
        },
      },
    ]);

    if (!orders || orders.length === 0) {
      return responseHandler(
        res,
        404,
        "No orders found for the provided IDs",
        "error"
      );
    }

    console.log("Fetched orders:", JSON.stringify(orders, null, 2)); // Debugging

    responseHandler(res, 200, "Orders fetched successfully", "success", orders);
  } catch (error: any) {
    console.error("Error fetching orders by IDs:", {
      message: error.message,
      stack: error.stack,
      orderIds,
    });
    responseHandler(
      res,
      500,
      error.message || "Failed to fetch orders",
      "error"
    );
  }
};

const getCashieringSellOrderByIds = async (req: Request, res: Response) => {
  const { orderIds } = req.body;

  if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
    return responseHandler(res, 400, "Invalid or missing orderIds", "error");
  }

  const objectIds = orderIds
    .filter((id: string) => Types.ObjectId.isValid(id))
    .map((id: string) => new Types.ObjectId(id));

  if (objectIds.length === 0) {
    return responseHandler(res, 400, "No valid orderIds provided", "error");
  }

  try {
    const orders = await SellOrder.aggregate([
      {
        $match: { _id: { $in: objectIds } },
      },
      {
        $lookup: {
          from: "sellorderitems",
          localField: "_id",
          foreignField: "orderId",
          as: "orderItems",
        },
      },
      {
        $lookup: {
          from: "inventories",
          localField: "orderItems.inventoryId",
          foreignField: "_id",
          as: "inventory",
        },
      },
      {
        $unwind: { path: "$inventory", preserveNullAndEmptyArrays: true },
      },
      {
        $lookup: {
          from: "clients",
          localField: "inventory.clientId",
          foreignField: "userId",
          as: "clientDetails",
        },
      },
      {
        $unwind: { path: "$clientDetails", preserveNullAndEmptyArrays: true },
      },
      {
        $set: {
          clientDetails: {
            $cond: {
              if: { $eq: ["$clientDetails", {}] },
              then: {
                clientName: "Unknown Client",
                clientId: null,
                email: null,
              },
              else: {
                clientName: "$clientDetails.clientName",
                clientId: { $ifNull: ["$clientDetails.clientId", null] },
                email: { $ifNull: ["$clientDetails.clientEmail", null] },
                address: { $ifNull: ["$clientDetails.deliveryAddress", null] },
                note: { $ifNull: ["$clientDetails.clientNotes", null] },
                regName: { $ifNull: ["$clientDetails.registeredName", null] },
                regAddress: {
                  $ifNull: ["$clientDetails.registeredAddress", null],
                },
              },
            },
          },
        },
      },
      {
        $lookup: {
          from: "adminproducts",
          localField: "inventory.adminProductId",
          foreignField: "_id",
          as: "adminProducts",
        },
      },
      {
        $sort: {
          createdAt: -1,
        },
      },
      {
        $project: {
          _id: 1,
          invoiceNumber: 1,
          total: 1,
          outstandingTotal: 1,
          createdAt: 1,
          numberOfItems: { $size: "$orderItems" },
          clientDetails: 1,
          orderItems: {
            $map: {
              input: "$orderItems",
              as: "item",
              in: {
                _id: "$$item._id",
                inventoryId: "$$item.inventoryId",
                quantity: "$$item.quantity",
                price: "$$item.price",
              },
            },
          },
          // adminProducts: {
          //   $map: {
          //     input: "$adminProducts",
          //     as: "product",
          //     in: {
          //       _id: "$$product._id",
          //       name: { $ifNull: ["$$product.name", "Unknown Product"] }, // Ensure name is included
          //     },
          //   },
          // },
          adminProducts: {
            $cond: {
              if: { $eq: ["$adminProducts", []] },
              then: [
                { productName: "Unknown Product", size: "N/A", color: "N/A" },
              ],
              else: "$adminProducts",
            },
          },
        },
      },
    ]);

    if (!orders || orders.length === 0) {
      return responseHandler(
        res,
        404,
        "No orders found for the provided IDs",
        "error"
      );
    }

    console.log("Fetched orders:", JSON.stringify(orders, null, 2)); // Debugging

    responseHandler(res, 200, "Orders fetched successfully", "success", orders);
  } catch (error: any) {
    console.error("Error fetching orders by IDs:", {
      message: error.message,
      stack: error.stack,
      orderIds,
    });
    responseHandler(
      res,
      500,
      error.message || "Failed to fetch orders",
      "error"
    );
  }
};

const processCashieringOrder = async (req: Request, res: Response) => {
  console.log(
    "Received payload in processCashieringOrder:",
    JSON.stringify(req.body, null, 2)
  );

  const {
    orderIds,
    payment = { cash: 0, card: 0, cheque: 0 },
    mode = "automatic",
  } = req.body;

  // Destructure payment details
  const { cash = 0, card = 0, cheque = 0 } = payment;

  // Validate inputs
  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    throw new BadRequestError(
      `At least one order ID is required. Received orderIds: ${JSON.stringify(orderIds)}`
    );
  }

  if (!["manual", "automatic"].includes(mode)) {
    throw new BadRequestError("Mode must be 'manual' or 'automatic'");
  }

  const paymentMethods = [
    { method: "cash", amount: cash },
    { method: "card", amount: card },
    { method: "cheque", amount: cheque },
  ].filter((p) => p.amount > 0 && Number.isFinite(p.amount));

  if (paymentMethods.length === 0) {
    throw new BadRequestError("At least one valid payment method is required");
  }

  const totalPayment = paymentMethods.reduce((sum, p) => sum + p.amount, 0);
  if (totalPayment <= 0) {
    throw new BadRequestError("Total payment amount must be positive");
  }

  let session;
  try {
    // Start MongoDB session
    session = await Order.startSession();
    session.startTransaction();

    // Fetch orders
    let orders: IOrder[];
    if (mode === "manual") {
      orders = await Order.find({
        _id: { $in: orderIds },
        orderStatus: "Pending",
      }).session(session);
      orders = orderIds
        .map((id) => orders.find((o) => (o as any)._id.equals(id)))
        .filter((o): o is IOrder => !!o);
    } else {
      orders = await Order.find({
        _id: { $in: orderIds },
        orderStatus: "Pending",
      })
        .sort({ createdAt: 1 })
        .session(session);
    }

    if (orders.length === 0) {
      throw new NotFoundError("No valid orders found");
    }

    console.log("Orders to be processed:", orders);

    // Prepare remaining payments
    let remainingByMethod = { cash, card, cheque };
    let remainingPayment = totalPayment;
    const paymentRecords = [];
    const methodsOrder = ["cash", "card", "cheque"];

    for (const order of orders) {
      if (remainingPayment <= 0) break;

      const orderItems = await OrderItem.find({
        orderId: order._id,
        outstandingPrice: { $gt: 0 },
      })
        .sort({ deliveryDate: 1, createdAt: 1 })
        .session(session);

      if (orderItems.length === 0) {
        if (order.outstandingTotal > 0) {
          throw new BadRequestError(
            `Order ${order._id} has outstanding total ${order.outstandingTotal} but no items with outstanding price`
          );
        }
        continue;
      }

      const itemsOutstanding = orderItems.reduce(
        (sum, item) => sum + item.outstandingPrice,
        0
      );
      if (itemsOutstanding !== order.outstandingTotal) {
        throw new BadRequestError(
          `Inconsistency for order ${order._id}: items outstanding sum ${itemsOutstanding} != order outstanding total ${order.outstandingTotal}`
        );
      }

      // Determine how much to apply to this order
      const applyToOrder = Math.min(remainingPayment, order.outstandingTotal);

      // Distribute applyToOrder across payment methods
      const orderPaymentRecords = [];
      let remainingApply = applyToOrder;

      for (const method of methodsOrder) {
        if (remainingApply <= 0) break;
        const available = remainingByMethod[method as keyof typeof remainingByMethod];
        if (available <= 0) continue;
        const useAmount = Math.min(available, remainingApply);
        orderPaymentRecords.push({
          orderId: order._id,
          method,
          amount: useAmount,
          createdBy: req.userId,
        });
        remainingByMethod[method as keyof typeof remainingByMethod] -= useAmount;
        remainingApply -= useAmount;
        remainingPayment -= useAmount;
      }

      if (remainingApply > 0) {
        throw new InternalServerError("Failed to allocate payment methods");
      }

      // Apply the payment to order items
      let toApply = applyToOrder;
      for (const item of orderItems) {
        console.log("Processing OrderItem", item);
        if (toApply <= 0) break;
        const applyAmount = Math.min(item.outstandingPrice, toApply);
        item.outstandingPrice -= applyAmount;
        toApply -= applyAmount;
        console.log(
          `Applying payment of ${applyAmount} to OrderItem ${item._id}. Remaining to apply to order: ${toApply}`
        );
        await item.save({ session });
      }

      // Update order's outstanding total
      order.outstandingTotal = orderItems.reduce(
        (sum, item) => sum + item.outstandingPrice,
        0
      );
      console.log(
        `Order ${order._id} outstanding total updated to ${order.outstandingTotal}`
      );
      // Update order status if fully paid
      if (order.outstandingTotal <= 0) {
        order.orderStatus = "Delivered";
      }

      await order.save({ session });

      // Add to overall payment records
      paymentRecords.push(...orderPaymentRecords);
    }

    // Insert payment records
    if (paymentRecords.length > 0) {
      await OrderPayment.insertMany(paymentRecords, { session });
    }

    // Optional: Check for overpayment
    // if (remainingPayment > 0) {
    //   throw new BadRequestError(`Overpayment of ${remainingPayment} detected`);
    // }

    // Commit transaction
    await session.commitTransaction();
    responseHandler(res, 200, "Orders processed successfully");
  } catch (error: any) {
    if (session?.inTransaction()) {
      await session.abortTransaction();
    }
    throw new InternalServerError(`Failed to process orders: ${error.message}`);
  } finally {
    if (session) {
      session.endSession();
    }
  }
};

const processCashieringSellOrder = async (req: Request, res: Response) => {
  console.log(
    "Received payload in processCashieringOrder:",
    JSON.stringify(req.body, null, 2)
  );

  const {
    orderIds,
    payment = { cash: 0, card: 0, cheque: 0 },
    mode = "automatic",
  } = req.body;

  // Destructure payment details
  const { cash = 0, card = 0, cheque = 0 } = payment;

  // Validate inputs
  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    throw new BadRequestError(
      `At least one order ID is required. Received orderIds: ${JSON.stringify(orderIds)}`
    );
  }

  if (!["manual", "automatic"].includes(mode)) {
    throw new BadRequestError("Mode must be 'manual' or 'automatic'");
  }

  const paymentMethods = [
    { method: "cash", amount: cash },
    { method: "card", amount: card },
    { method: "cheque", amount: cheque },
  ].filter((p) => p.amount > 0 && Number.isFinite(p.amount));

  if (paymentMethods.length === 0) {
    throw new BadRequestError("At least one valid payment method is required");
  }

  const totalPayment = paymentMethods.reduce((sum, p) => sum + p.amount, 0);
  if (totalPayment <= 0) {
    throw new BadRequestError("Total payment amount must be positive");
  }

  let session;
  try {
    // Start MongoDB session
    session = await SellOrder.startSession();
    session.startTransaction();

    // Fetch orders
    let orders: ISellOrder[];
    if (mode === "manual") {
      orders = await SellOrder.find({
        _id: { $in: orderIds },
        // orderStatus: "Pending",
      }).session(session);
      orders = orderIds
        .map((id) => orders.find((o) => (o as any)._id.equals(id)))
        .filter((o): o is ISellOrder => !!o);
    } else {
      orders = await SellOrder.find({
        _id: { $in: orderIds },
        // orderStatus: "Pending",
      })
        .sort({ createdAt: 1 })
        .session(session);
    }

    if (orders.length === 0) {
      throw new NotFoundError("No valid orders found");
    }

    console.log("Orders to be processed:", orders);

    // Prepare remaining payments
    let remainingByMethod = { cash, card, cheque };
    let remainingPayment = totalPayment;
    const paymentRecords = [];
    const methodsOrder = ["cash", "card", "cheque"];

    for (const order of orders) {
      if (remainingPayment <= 0) break;

      const orderItems = await SellOrderItem.find({
        orderId: order._id,
        outstandingPrice: { $gt: 0 },
      })
        .sort({ deliveryDate: 1, createdAt: 1 })
        .session(session);

      if (orderItems.length === 0) {
        if (order.outstandingTotal > 0) {
          throw new BadRequestError(
            `Order ${order._id} has outstanding total ${order.outstandingTotal} but no items with outstanding price`
          );
        }
        continue;
      }

      const itemsOutstanding = orderItems.reduce(
        (sum, item) => sum + item.outstandingPrice,
        0
      );
      if (itemsOutstanding !== order.outstandingTotal) {
        throw new BadRequestError(
          `Inconsistency for order ${order._id}: items outstanding sum ${itemsOutstanding} != order outstanding total ${order.outstandingTotal}`
        );
      }

      // Determine how much to apply to this order
      const applyToOrder = Math.min(remainingPayment, order.outstandingTotal);

      // Distribute applyToOrder across payment methods
      const orderPaymentRecords = [];
      let remainingApply = applyToOrder;

      for (const method of methodsOrder) {
        if (remainingApply <= 0) break;
        const available = remainingByMethod[method as keyof typeof remainingByMethod];
        if (available <= 0) continue;
        const useAmount = Math.min(available, remainingApply);
        orderPaymentRecords.push({
          orderId: order._id,
          method,
          amount: useAmount,
          createdBy: req.userId,
        });
        remainingByMethod[method as keyof typeof remainingByMethod] -= useAmount;
        remainingApply -= useAmount;
        remainingPayment -= useAmount;
      }

      if (remainingApply > 0) {
        throw new InternalServerError("Failed to allocate payment methods");
      }

      // Apply the payment to order items
      let toApply = applyToOrder;
      for (const item of orderItems) {
        console.log("Processing OrderItem", item);
        if (toApply <= 0) break;
        const applyAmount = Math.min(item.outstandingPrice, toApply);
        item.outstandingPrice -= applyAmount;
        toApply -= applyAmount;
        console.log(
          `Applying payment of ${applyAmount} to OrderItem ${item._id}. Remaining to apply to order: ${toApply}`
        );
        await item.save({ session });
      }

      // Update order's outstanding total
      order.outstandingTotal = orderItems.reduce(
        (sum, item) => sum + item.outstandingPrice,
        0
      );
      console.log(
        `Order ${order._id} outstanding total updated to ${order.outstandingTotal}`
      );
      // Update order status if fully paid
      // if (order.outstandingTotal <= 0) {
      //   order.orderStatus = "Delivered";
      // }

      await order.save({ session });

      // Add to overall payment records
      paymentRecords.push(...orderPaymentRecords);
    }

    // Insert payment records
    if (paymentRecords.length > 0) {
      await SellOrderPayment.insertMany(paymentRecords, { session });
    }

    // Optional: Check for overpayment
    // if (remainingPayment > 0) {
    //   throw new BadRequestError(`Overpayment of ${remainingPayment} detected`);
    // }

    // Commit transaction
    await session.commitTransaction();
    responseHandler(res, 200, "Orders processed successfully");
  } catch (error: any) {
    if (session?.inTransaction()) {
      await session.abortTransaction();
    }
    throw new InternalServerError(`Failed to process orders: ${error.message}`);
  } finally {
    if (session) {
      session.endSession();
    }
  }
};

export {
  getAllCashieringOrders,
  searchCashieringOrders,
  getCashieringOrderByIds,
  processCashieringOrder,
  getAllCashieringSellOrders,
  searchCashieringSellOrders,
  searchCashieringOrdersCombined,
  getCashieringSellOrderByIds,
  processCashieringSellOrder,
  getAllCashieringOrdersCombined
};
