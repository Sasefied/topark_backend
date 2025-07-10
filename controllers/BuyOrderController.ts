import { Request, Response } from "express";
import BuyOrder from "../schemas/BuyOrder";
import Inventory from "../schemas/Inventory";
import { responseHandler } from "../utils/responseHandler";
import { Types } from "mongoose";
import mongoose from "mongoose";

interface AuthRequest extends Request {
  userId?: string;
}

/**
 * Creates a single buy order.
 *
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @returns {Promise<void>}
 */
const createBuyOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId || !Types.ObjectId.isValid(req.userId)) {
      return responseHandler(res, 401, `Unauthorized: Invalid userId: ${req.userId}`, "error");
    }

    const { inventoryId, quantity, price, deliveryDate, orderStatus, productName, supplierName, size, color, ccy } = req.body;

    // Validate inventoryId exists
    const inventory = await Inventory.findById(inventoryId);
    if (!inventory) {
      throw new Error(`Inventory with ID ${inventoryId} not found`);
    }

    const buyOrder = await BuyOrder.create({
      userId: new Types.ObjectId(req.userId),
      inventoryId: new Types.ObjectId(inventoryId),
      quantity,
      price,
      deliveryDate: new Date(deliveryDate),
      orderStatus: orderStatus || "Requested",
      productName,
      supplierName,
      size,
      color,
      ccy,
    });

    console.log("Created buy order:", JSON.stringify(buyOrder, null, 2));
    responseHandler(res, 201, "Buy order created successfully", "success", buyOrder);
  } catch (error: any) {
    console.error("Error creating buy order:", {
      message: error.message,
      stack: error.stack,
      body: req.body,
      userId: req.userId,
    });
    responseHandler(res, 500, error.message || "Internal server error", "error");
  }
};

/**
 * Creates multiple buy orders in bulk.
 *
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @returns {Promise<void>}
 */
const createBulkBuyOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (mongoose.connection.readyState !== 1) {
      throw new Error("MongoDB connection not established");
    }

    const orders = req.body;
    if (!Array.isArray(orders) || orders.length === 0) {
      return responseHandler(res, 400, "Orders array is empty or invalid", "error");
    }

    if (!req.userId || !Types.ObjectId.isValid(req.userId)) {
      return responseHandler(res, 401, `Unauthorized: Invalid userId: ${req.userId}`, "error");
    }

    console.log("Received orders:", JSON.stringify(orders, null, 2));

    // Validate each order
    const buyOrders = await Promise.all(
      orders.map(async (order: any, index: number) => {
        // Validate required fields
        if (!order.inventoryId || !Types.ObjectId.isValid(order.inventoryId)) {
          throw new Error(`Invalid or missing inventoryId at index ${index}: ${order.inventoryId}`);
        }
        if (!order.quantity || typeof order.quantity !== "number" || order.quantity <= 0) {
          throw new Error(`Invalid or missing quantity at index ${index}: ${order.quantity}`);
        }
        if (!order.price || typeof order.price !== "number" || order.price < 0) {
          throw new Error(`Invalid or missing price at index ${index}: ${order.price}`);
        }
        if (!order.deliveryDate || isNaN(new Date(order.deliveryDate).getTime())) {
          throw new Error(`Invalid or missing deliveryDate at index ${index}: ${order.deliveryDate}`);
        }
        if (!order.productName || typeof order.productName !== "string" || order.productName.trim() === "") {
          throw new Error(`Invalid or missing productName at index ${index}: ${order.productName}`);
        }
        if (!order.supplierName || typeof order.supplierName !== "string" || order.supplierName.trim() === "") {
          throw new Error(`Invalid or missing supplierName at index ${index}: ${order.supplierName}`);
        }
        if (!order.size || typeof order.size !== "string" || order.size.trim() === "") {
          throw new Error(`Invalid or missing size at index ${index}: ${order.size}`);
        }
        if (!order.color || typeof order.color !== "string" || order.color.trim() === "") {
          throw new Error(`Invalid or missing color at index ${index}: ${order.color}`);
        }
        if (!order.ccy || typeof order.ccy !== "string" || order.ccy.trim() === "") {
          throw new Error(`Invalid or missing ccy at index ${index}: ${order.ccy}`);
        }

        // Validate inventoryId exists
        const inventory = await Inventory.findById(order.inventoryId);
        if (!inventory) {
          throw new Error(`Inventory with ID ${order.inventoryId} not found at index ${index}`);
        }

        return {
          userId: new Types.ObjectId(req.userId),
          inventoryId: new Types.ObjectId(order.inventoryId),
          quantity: order.quantity,
          price: order.price,
          deliveryDate: new Date(order.deliveryDate),
          orderStatus: "Requested",
          productName: order.productName,
          supplierName: order.supplierName,
          size: order.size,
          color: order.color,
          ccy: order.ccy,
        };
      })
    );

    console.log("Validated buy orders:", JSON.stringify(buyOrders, null, 2));

    // Insert validated orders
    const createdOrders = await BuyOrder.insertMany(buyOrders, { ordered: false });
    console.log("Created orders:", JSON.stringify(createdOrders, null, 2));
    responseHandler(res, 201, "Buy orders created successfully", "success", createdOrders);
  } catch (error: any) {
    console.error("Error creating bulk buy orders:", {
      message: error.message,
      stack: error.stack,
      orders: req.body,
      userId: req.userId,
    });
    responseHandler(res, 500, error.message || "Internal server error", "error");
  }
};

/**
 * Retrieves all buy orders visible to the authenticated user or client.
 *
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @returns {Promise<void>}
 */
const getAllBuyOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId || !Types.ObjectId.isValid(req.userId)) {
      return responseHandler(res, 401, `Unauthorized: Invalid userId: ${req.userId}`, "error");
    }

    const result = await BuyOrder.aggregate([
      {
        $match: {
          $or: [
            { userId: new Types.ObjectId(req.userId) }, // User who placed the order
            { clientId: new Types.ObjectId(req.userId) }, // Client associated with the order
          ],
        },
      },
      {
        $lookup: {
          from: "adminproducts",
          localField: "inventoryId",
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
          id: "$_id",
          productName: { $ifNull: ["$productName", "$adminProductId.productName", "-"] },
          supplierName: { $ifNull: ["$supplierName", "$clientId.clientName", "-"] },
          size: { $ifNull: ["$size", "$adminProductId.size", "-"] },
          color: { $ifNull: ["$color", "$adminProductId.color", "-"] },
          quantity: { $ifNull: ["$quantity", 0] },
          price: { $ifNull: ["$price", 0] },
          ccy: { $ifNull: ["$ccy", "USD"] },
          deliveryDate: { $ifNull: ["$deliveryDate", new Date().toISOString()] },
          inventoryId: { $ifNull: ["$inventoryId", ""] },
          orderStatus: { $ifNull: ["$orderStatus", "Requested"] },
          orderValue: {
            $concat: [
              { $toString: { $ifNull: ["$price", 0] } },
              " ",
              { $ifNull: ["$ccy", "USD"] },
            ],
          },
          totalItems: { $ifNull: ["$quantity", 0] },
          expectedDate: {
            $dateToString: { format: "%Y-%m-%d", date: { $ifNull: ["$deliveryDate", new Date()] } },
          },
        },
      },
    ]);

    console.log("Fetched buy orders:", JSON.stringify(result, null, 2));
    responseHandler(res, 200, "Buy orders fetched successfully", "success", { buyOrders: result });
  } catch (error: any) {
    console.error("Error fetching buy orders:", {
      message: error.message,
      stack: error.stack,
      userId: req.userId,
    });
    responseHandler(res, 500, error.message || "Failed to fetch buy orders", "error");
  }
};
/**
 * Deletes a buy order by its ID.
 *
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @returns {Promise<void>}
 */
const deleteBuyOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { buyOrderId } = req.params;
    if (!Types.ObjectId.isValid(buyOrderId)) {
      return responseHandler(res, 400, `Invalid buyOrderId: ${buyOrderId}`, "error");
    }
    const buyOrder = await BuyOrder.findOneAndDelete({
      _id: new Types.ObjectId(buyOrderId),
      userId: new Types.ObjectId(req.userId),
    });
    if (!buyOrder) {
      return responseHandler(res, 404, "Buy order not found or not authorized", "error");
    }
    responseHandler(res, 200, "Buy order deleted successfully", "success");
  } catch (error: any) {
    console.error("Error deleting buy order:", {
      message: error.message,
      stack: error.stack,
      buyOrderId: req.params.buyOrderId,
      userId: req.userId,
    });
    responseHandler(res, 500, error.message || "Internal server error", "error");
  }
};


/**
 * Updates a buy order's status, quantity, and delivery date.
 *
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @returns {Promise<void>}
 */
const updateBuyOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { buyOrderId } = req.params;
    const { orderStatus, quantity, deliveryDate } = req.body;

    if (!req.userId || !Types.ObjectId.isValid(req.userId)) {
      return responseHandler(res, 401, `Unauthorized: Invalid userId: ${req.userId}`, "error");
    }

    if (!Types.ObjectId.isValid(buyOrderId)) {
      return responseHandler(res, 400, `Invalid buyOrderId: ${buyOrderId}`, "error");
    }

    // Validate input fields
    if (orderStatus && typeof orderStatus !== "string") {
      return responseHandler(res, 400, `Invalid orderStatus: ${orderStatus}`, "error");
    }
    if (quantity !== undefined && (typeof quantity !== "number" || quantity <= 0)) {
      return responseHandler(res, 400, `Invalid quantity: ${quantity}`, "error");
    }
    if (deliveryDate && isNaN(new Date(deliveryDate).getTime())) {
      return responseHandler(res, 400, `Invalid deliveryDate: ${deliveryDate}`, "error");
    }

    // Find the buy order and ensure the user is authorized (either userId or clientId matches)
    const buyOrder = await BuyOrder.findOne({
      _id: new Types.ObjectId(buyOrderId),
      $or: [
        { userId: new Types.ObjectId(req.userId) },
        { clientId: new Types.ObjectId(req.userId) },
      ],
    });

    if (!buyOrder) {
      return responseHandler(res, 404, "Buy order not found or not authorized", "error");
    }

    // Update fields if provided
    if (orderStatus) buyOrder.orderStatus = orderStatus;
    if (quantity !== undefined) buyOrder.quantity = quantity;
    if (deliveryDate) buyOrder.deliveryDate = new Date(deliveryDate);

    // Save the updated buy order
    const updatedBuyOrder = await buyOrder.save();

    console.log("Updated buy order:", JSON.stringify(updatedBuyOrder, null, 2));
    responseHandler(res, 200, "Buy order updated successfully", "success", updatedBuyOrder);
  } catch (error: any) {
    console.error("Error updating buy order:", {
      message: error.message,
      stack: error.stack,
      buyOrderId: req.params.buyOrderId,
      userId: req.userId,
      body: req.body,
    });
    responseHandler(res, 500, error.message || "Internal server error", "error");
  }
};

export { createBuyOrder, createBulkBuyOrders, getAllBuyOrders, deleteBuyOrder, updateBuyOrder };