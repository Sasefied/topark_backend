import { Request, Response } from "express";
import Inventory from "../schemas/Inventory";
import { responseHandler } from "../utils/responseHandler";
import { Types } from "mongoose";
import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";
import Order from "../schemas/Order";
import OrderItem from "../schemas/OrderItem";
// import Cart from "../schemas/cart";
import CartItem from "../schemas/CartItem";
import Cart from "../schemas/Cart";

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

    const { inventoryId, quantity, price, deliveryDate } = req.body;

    if (!inventoryId || !Types.ObjectId.isValid(inventoryId)) {
      return responseHandler(res, 400, `Invalid inventoryId: ${inventoryId}`, "error");
    }
    if (isNaN(quantity) || quantity <= 0) {
      return responseHandler(res, 400, "Quantity must be a positive number", "error");
    }
    if (isNaN(price) || price < 0) {
      return responseHandler(res, 400, "Price cannot be negative", "error");
    }
    if (!isValidDate(deliveryDate)) {
      return responseHandler(res, 400, "Invalid delivery date", "error");
    }

    const inventory = await Inventory.findById(inventoryId);
    if (!inventory) {
      return responseHandler(res, 404, `Inventory with ID ${inventoryId} not found`, "error");
    }

    const cart = await Cart.findOneAndUpdate(
      { userId: req.userId },
      { $setOnInsert: { userId: req.userId } },
      { upsert: true, new: true }
    );

    const cartItem = await CartItem.findOneAndUpdate(
      { cartId: cart._id, inventoryId },
      { $setOnInsert: { cartId: cart._id, inventoryId, quantity, price, deliveryDate } },
      { new: true, upsert: true }
    );

    responseHandler(res, 201, "Buy order created successfully", "success", cartItem);
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

const isValidDate = (date: string): boolean => {
  const parsedDate = new Date(date);
  return parsedDate instanceof Date && !isNaN(parsedDate.getTime());
};




const createBulkBuyOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { orders } = req.body;
    const userId = req.userId;

    if (!userId || !Types.ObjectId.isValid(userId)) {
      return responseHandler(res, 401, "Unauthorized: Invalid user ID", "error");
    }

    if (!Array.isArray(orders) || orders.length === 0) {
      return responseHandler(res, 400, "Orders array is required and cannot be empty", "error");
    }

    const session = await Order.startSession();
    session.startTransaction();

    try {
      const createdOrders = [];
      for (const order of orders) {
        const {
          productName,
          supplierName,
          size,
          color,
          quantity,
          price,
          ccy,
          deliveryDate,
          inventoryId,
          productId,
          clientId,
          orderStatus,
        } = order;

        // Validate required fields
        if (!productName || !supplierName || !inventoryId || !productId || !quantity || !price) {
          await session.abortTransaction();
          return responseHandler(res, 400, "Missing required order fields", "error");
        }
        if (quantity <= 0) {
          await session.abortTransaction();
          return responseHandler(res, 400, "Quantity must be greater than 0", "error");
        }
        if (price < 0) {
          await session.abortTransaction();
          return responseHandler(res, 400, "Price cannot be negative", "error");
        }
        if (deliveryDate && isNaN(new Date(deliveryDate).getTime())) {
          await session.abortTransaction();
          return responseHandler(res, 400, `Invalid delivery date: ${deliveryDate}`, "error");
        }
        if (!Types.ObjectId.isValid(inventoryId) || !Types.ObjectId.isValid(productId)) {
          await session.abortTransaction();
          return responseHandler(res, 400, "Invalid inventoryId or productId", "error");
        }
        if (clientId && !Types.ObjectId.isValid(clientId)) {
          await session.abortTransaction();
          return responseHandler(res, 400, `Invalid clientId: ${clientId}`, "error");
        }

        const newOrder = new Order({
          userId: new Types.ObjectId(userId),
          clientId: clientId ? new Types.ObjectId(clientId) : null,
          total: quantity * price,
          orderStatus: orderStatus || "Requested",
          invoiceNumber: `INV-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        });

        const savedOrder = await newOrder.save({ session });

        const newOrderItem = new OrderItem({
          orderId: savedOrder._id,
          inventoryId: new Types.ObjectId(inventoryId),
          quantity,
          price,
          deliveryDate: deliveryDate ? new Date(deliveryDate) : new Date(),
          productName,
          supplierName,
          size,
          color,
          ccy: ccy || "USD",
          productId: new Types.ObjectId(productId),
        });

        await newOrderItem.save({ session });

        createdOrders.push({
          _id: savedOrder._id,
          productName,
          supplierName,
          size,
          color,
          quantity,
          price,
          ccy: ccy || "USD",
          deliveryDate: newOrderItem.deliveryDate,
          inventoryId,
          productId,
          clientId: clientId || "",
          orderStatus: savedOrder.orderStatus,
          total: savedOrder.total,
        });
      }

      await session.commitTransaction();
      responseHandler(res, 201, "Orders created successfully", "success", createdOrders);
    } catch (error: any) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error: any) {
    console.error("Error creating bulk buy orders:", {
      message: error.message,
      stack: error.stack,
      body: req.body,
      userId: req.userId,
    });
    responseHandler(res, 500, error.message || "Internal server error", "error");
  }
};


// const getAllBuyOrders = async (
//   req: AuthRequest,
//   res: Response
// ): Promise<void> => {
//   try {
//     if (!req.userId || !Types.ObjectId.isValid(req.userId)) {
//       return responseHandler(
//         res,
//         401,
//         `Unauthorized: Invalid userId: ${req.userId}`,
//         "error"
//       );
//     }

//     const result = await Order.aggregate([
//       {
//         $match: {
//           $or: [
//             { userId: new Types.ObjectId(req.userId) }, // User who placed the order
//             { clientId: new Types.ObjectId(req.userId) }, // Client associated with the order
//           ],
//         },
//       },
//       {
//         $lookup: {
//           from: "orderitems",
//           localField: "_id",
//           foreignField: "orderId",
//           as: "orderItems",
//         },
//       },
//       {
//         $unwind: { path: "$orderItems", preserveNullAndEmptyArrays: true },
//       },
//       {
//         $lookup: {
//           from: "adminproducts",
//           localField: "orderItems.inventoryId",
//           foreignField: "_id",
//           as: "adminProductId",
//         },
//       },
//       {
//         $unwind: { path: "$adminProductId", preserveNullAndEmptyArrays: true },
//       },
//       {
//         $lookup: {
//           from: "clients",
//           localField: "clientId",
//           foreignField: "_id",
//           as: "clientDetails",
//         },
//       },
//       {
//         $unwind: { path: "$clientDetails", preserveNullAndEmptyArrays: true },
//       },
//       {
//         $project: {
//           id: "$_id",
//           clientId: { $ifNull: ["$clientDetails._id", ""] },
//           clientName: { $ifNull: ["$clientDetails.clientName", "-"] },
//           productId: { $ifNull: ["$orderItems.productId", "-"] },
//           productName: { $ifNull: ["$orderItems.productName", "-"] },
//           supplierName: { $ifNull: ["$orderItems.supplierName", "-"] },
//           size: { $ifNull: ["$orderItems.size", "-"] },
//           color: { $ifNull: ["$orderItems.color", "-"] },
//           quantity: { $ifNull: ["$orderItems.quantity", 0] },
//           price: { $ifNull: ["$orderItems.price", 0] },
//           ccy: { $ifNull: ["$orderItems.ccy", "USD"] },
//           deliveryDate: { $ifNull: ["$orderItems.deliveryDate", new Date().toISOString()] },
//           inventoryId: { $ifNull: ["$orderItems.inventoryId", ""] },
//           orderStatus: { $ifNull: ["$orderStatus", "Requested"] },
//           orderValue: {
//             $concat: [
//               {
//                 $toString: {
//                   $multiply: [
//                     { $ifNull: ["$orderItems.quantity", 0] },
//                     { $ifNull: ["$orderItems.price", 0] },
//                   ],
//                 },
//               },
//               " ",
//               { $ifNull: ["$orderItems.ccy", "USD"] },
//             ],
//           },
//           hasOrderItems: { $cond: [{ $eq: [{ $type: "$orderItems" }, "object"] }, true, false] }, // Debug flag
//         },
//       },
//     ]);

//     // Log orders with missing orderItems for debugging
//     const missingOrderItems = result.filter((order) => !order.hasOrderItems);
//     if (missingOrderItems.length > 0) {
//       console.warn("Orders with missing orderItems:", JSON.stringify(missingOrderItems, null, 2));
//     }

//     console.log("Fetched buy orders:", JSON.stringify(result, null, 2));
//     responseHandler(res, 200, "Buy orders fetched successfully", "success", {
//       buyOrders: result,
//     });
//   } catch (error: any) {
//     console.error("Error fetching buy orders:", {
//       message: error.message,
//       stack: error.stack,
//       userId: req.userId,
//     });
//     responseHandler(
//       res,
//       500,
//       error.message || "Failed to fetch buy orders",
//       "error"
//     );
//   }
// };
const getAllBuyOrders = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.userId || !Types.ObjectId.isValid(req.userId)) {
      return responseHandler(
        res,
        401,
        `Unauthorized: Invalid userId: ${req.userId}`,
        "error"
      );
    }

const result = await Order.aggregate([
  {
    $match: {
      $or: [
        { userId: new Types.ObjectId(req.userId) },
        { clientId: new Types.ObjectId(req.userId) },
      ],
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
    $unwind: { path: "$orderItems", preserveNullAndEmptyArrays: true },
  },
  {
    $lookup: {
      from: "Inventory", // Keep for potential future use
      localField: "orderItems.inventoryId",
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
      localField: "orderItems.clientId",
      foreignField: "_id",
      as: "clientDetails",
    },
  },
  {
    $unwind: { path: "$clientDetails", preserveNullAndEmptyArrays: true },
  },
  {
    $project: {
      id: "$_id",
      clientId: { $ifNull: ["$clientId._id", ""] },
      productId: { $ifNull: ["$orderItems.inventoryId", "-"] },
      productName: { $ifNull: ["$orderItems.productName", "-"] }, // Source from orderItems
      supplierName: { $ifNull: ["$orderItems.supplierName", "-"] }, // Source from orderItems
      size: { $ifNull: ["$orderItems.size", "-"] }, // Source from orderItems
      color: { $ifNull: ["$orderItems.color", "-"] }, // Source from orderItems
      quantity: { $ifNull: ["$orderItems.quantity", 0] },
      price: { $ifNull: ["$orderItems.price", 0] },
      ccy: { $ifNull: ["$orderItems.ccy", "USD"] },
      deliveryDate: { $ifNull: ["$orderItems.deliveryDate", new Date().toISOString()] },
      inventoryId: { $ifNull: ["$orderItems.inventoryId", ""] },
      orderStatus: { $ifNull: ["$orderStatus", "Requested"] },
      orderValue: {
        $concat: [
          {
            $toString: {
              $multiply: [
                { $ifNull: ["$orderItems.quantity", 0] },
                { $ifNull: ["$orderItems.price", 0] },
              ],
            },
          },
          " ",
          { $ifNull: ["$orderItems.ccy", "USD"] },
        ],
      },
      hasOrderItems: { $cond: [{ $eq: [{ $type: "$orderItems" }, "object"] }, true, false] },
      orderItemsDebug: "$orderItems",
      adminProductDebug: "$adminProductId",
      clientDetailsDebug: "$clientDetails",
    },
  },
]);

// Log for debugging
console.log("Aggregation result:", JSON.stringify(result, null, 2));
    // Log orders with missing orderItems or fields
    const missingData = result.filter(
      (order) =>
        !order.hasOrderItems ||
        !order.orderItemsDebug?.productName ||
        !order.orderItemsDebug?.supplierName
    );
    if (missingData.length > 0) {
      console.warn("Orders with missing orderItems or fields:", JSON.stringify(missingData, null, 2));
    }

    console.log("Fetched buy orders:", JSON.stringify(result, null, 2));
    responseHandler(res, 200, "Buy orders fetched successfully", "success", {
      buyOrders: result,
    });
  } catch (error: any) {
    console.error("Error fetching buy orders:", {
      message: error.message,
      stack: error.stack,
      userId: req.userId,
    });
    responseHandler(
      res,
      500,
      error.message || "Failed to fetch buy orders",
      "error"
    );
  }
};



const deleteBuyOrder = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const cart = await Cart.findOne({ userId: req.userId });
    if (!cart) {
      return responseHandler(res, 404, "Cart not found", "error");
    }

    await CartItem.deleteOne({ cartId: cart._id, buyOrderId: id });

    responseHandler(res, 200, "Buy order deleted successfully", "success");
  } catch (error: any) {
    console.error("Error deleting buy order:", {
      message: error.message,
      stack: error.stack,
      buyOrderId: req.params.buyOrderId,
      userId: req.userId,
    });
    responseHandler(
      res,
      500,
      error.message || "Internal server error",
      "error"
    );
  }
};



// const updateBuyOrder = async (
//   req: AuthRequest,
//   res: Response
// ): Promise<void> => {
//   try {
//     const { buyOrderId } = req.params;
//     const { orderStatus, quantity, deliveryDate,price} = req.body;
// console.log("req.userId:", req.userId); // Debug log
//     if (!req.userId || !Types.ObjectId.isValid(req.userId)) {
//       return responseHandler(
//         res,
//         401,
//         `Unauthorized: Invalid userId: ${req.userId}`,
//         "error"
//       );
//     }

//     if (!Types.ObjectId.isValid(buyOrderId)) {
//       return responseHandler(
//         res,
//         400,
//         `Invalid buyOrderId: ${buyOrderId}`,
//         "error"
//       );
//     }

//     // Validate input fields
//     if (orderStatus && typeof orderStatus !== "string") {
//       return responseHandler(
//         res,
//         400,
//         `Invalid orderStatus: ${orderStatus}`,
//         "error"
//       );
//     }
//     if (
//       quantity !== undefined &&
//       (typeof quantity !== "number" || quantity <= 0)
//     ) {
//       return responseHandler(
//         res,
//         400,
//         `Invalid quantity: ${quantity}`,
//         "error"
//       );
//     }
//     if (deliveryDate && isNaN(new Date(deliveryDate).getTime())) {
//       return responseHandler(
//         res,
//         400,
//         `Invalid deliveryDate: ${deliveryDate}`,
//         "error"
//       );
//     }

//     // Find the buy order and ensure the user is authorized (either userId or clientId matches)
//     const buyOrder = await Order.findOne({
//       _id: new Types.ObjectId(buyOrderId),
//       $or: [
//         { userId: new Types.ObjectId(req.userId) },
//         { clientId: new Types.ObjectId(req.userId) },
//       ],
//     });

//     if (!buyOrder) {
//       return responseHandler(
//         res,
//         404,
//         "Buy order not found or not authorized",
//         "error"
//       );
//     }

//     await Order.findOneAndUpdate(
//       { _id: new Types.ObjectId(buyOrderId) },
//       {
//         $set: {
//           orderStatus,
//         },
//       }
//     );

//     await OrderItem.findOneAndUpdate(
// { orderId: new Types.ObjectId(buyOrderId) },
//       {
//         $set: {
//           quantity,
//           deliveryDate,
//           price
//         },
//       }
//     );

//     responseHandler(res, 200, "Buy order updated successfully", "success");
//   } catch (error: any) {
//     console.error("Error updating buy order:", {
//       message: error.message,
//       stack: error.stack,
//       buyOrderId: req.params.buyOrderId,
//       userId: req.userId,
//       body: req.body,
//     });
//     responseHandler(
//       res,
//       500,
//       error.message || "Internal server error",
//       "error"
//     );
//   }
// };
const updateBuyOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { buyOrderId } = req.params;
    const { quantity, deliveryDate, price } = req.body;

    console.log("UpdateBuyOrder - Input:", {
      buyOrderId,
      userId: req.userId,
      body: req.body
    });

    if (!req.userId || !Types.ObjectId.isValid(req.userId)) {
      return responseHandler(res, 401, `Unauthorized: Invalid userId: ${req.userId}`, "error");
    }

    if (!Types.ObjectId.isValid(buyOrderId)) {
      return responseHandler(res, 400, `Invalid buyOrderId: ${buyOrderId}`, "error");
    }

    if (quantity !== undefined && (typeof quantity !== "number" || quantity <= 0)) {
      return responseHandler(res, 400, `Invalid quantity: ${quantity}`, "error");
    }
    if (deliveryDate && isNaN(new Date(deliveryDate).getTime())) {
      return responseHandler(res, 400, `Invalid deliveryDate: ${deliveryDate}`, "error");
    }
    if (price !== undefined && (typeof price !== "number" || price < 0)) {
      return responseHandler(res, 400, `Invalid price: ${price}`, "error");
    }

    const buyOrder = await Order.findOne({
      _id: new Types.ObjectId(buyOrderId),
      $or: [
        { userId: new Types.ObjectId(req.userId) },
        { clientId: new Types.ObjectId(req.userId) },
      ],
    });

    console.log("Found buyOrder:", buyOrder);

    if (!buyOrder) {
      return responseHandler(res, 404, "Buy order not found or not authorized", "error");
    }

    const orderItem = await OrderItem.findOne({ orderId: new Types.ObjectId(buyOrderId) });
    console.log("Found orderItem:", orderItem);

    if (!orderItem) {
      return responseHandler(res, 404, "OrderItem not found for this buy order", "error");
    }

    await OrderItem.findOneAndUpdate(
      { orderId: new Types.ObjectId(buyOrderId) },
      {
        $set: {
          quantity: quantity !== undefined ? quantity : orderItem.quantity,
          deliveryDate: deliveryDate !== undefined ? deliveryDate : orderItem.deliveryDate,
          price: price !== undefined ? price : orderItem.price,
        },
      }
    );

    responseHandler(res, 200, "Buy order updated successfully", "success");
  } catch (error: any) {
    console.error("Error updating buy order:", {
      message: error.message,
      stack: error.stack,
      buyOrderId: req.params.buyOrderId,
      userId: req.userId,
      body: req.body,
      route: req.originalUrl,
      method: req.method,
    });
    responseHandler(res, 500, error.message || "Internal server error", "error");
  }
};


export {
  createBuyOrder,
  createBulkBuyOrders,
  getAllBuyOrders,
  deleteBuyOrder,
  updateBuyOrder,
  
};