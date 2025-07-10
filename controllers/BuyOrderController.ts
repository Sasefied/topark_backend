import { Request, Response } from "express";
import Inventory from "../schemas/Inventory";
import { responseHandler } from "../utils/responseHandler";
import { Types } from "mongoose";
import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";
import Order from "../schemas/Order";
import OrderItem from "../schemas/OrderItem";
import Cart from "../schemas/cart";
import CartItem from "../schemas/CartItem";

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
/**
 * Creates bulk buy orders for the authenticated user.
 *
 * @param {AuthRequest} req - Express request object containing userId and an array of orders in the body.
 * @param {Response} res - Express response object.
 * @returns {Promise<void>} - A promise that resolves when the operation is complete.
 */

// const createBulkBuyOrders = async (
//   req: AuthRequest,
//   res: Response
// ): Promise<void> => {
//   const { orders } = req.body;
//   console.log(req.body);
//   const userId = req.userId;

//   if (!Array.isArray(orders) || orders.length === 0) {
//     return responseHandler(res, 400, "Orders array is required", "error");
//   }

//   // Validate clientId for the first order
//   if (!orders[0].clientId || !mongoose.Types.ObjectId.isValid(orders[0].clientId)) {
//     return responseHandler(res, 400, "Valid clientId is required for the order", "error");
//   }

//   const session = await mongoose.startSession();

//   try {
//     session.startTransaction();

//     const invoiceNumber = uuidv4();

//     const totalAmount = orders.reduce((sum, item) => sum + item.total, 0);

//     const createdOrder = await Order.create(
//       [
//         {
//           userId,
//           clientId: orders[0].clientId,
//           invoiceNumber,
//           total: totalAmount,
//         },
//       ],
//       {
//         session,
//       }
//     );

//     const orderItems = orders.map((item) => ({
//       orderId: createdOrder[0]._id,
//       inventoryId: item.inventoryId,
//       quantity: item.quantity,
//       price: item.price,
//       deliveryDate: item.deliveryDate,
//     }));

//     await OrderItem.insertMany(orderItems, { session });

//     const userCart = await Cart.findOne({ userId }).select("_id");

//     if (userCart) {
//       await CartItem.deleteMany({ cartId: userCart._id });
//     }
//     await Cart.deleteOne({ userId }, { session });

//     await session.commitTransaction();

//     responseHandler(
//       res,
//       201,
//       "Orders created successfully",
//       "success",
//       createdOrder
//     );
//   } catch (error: any) {
//     await session.abortTransaction();
//     console.error("Error creating bulk buy orders:", {
//       message: error.message,
//       stack: error.stack,
//       orders: req.body,
//       userId: req.userId,
//     });
//     responseHandler(
//       res,
//       500,
//       error.message || "Internal server error",
//       "error"
//     );
//   } finally {
//     session.endSession();
//   }
// };





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


/**
 * Retrieves all buy orders visible to the authenticated user or client.
 *
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @returns {Promise<void>}
 */
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
          productName: {
            $ifNull: ["$productName", "$adminProductId.productName", "-"],
          },
          supplierName: {
            $ifNull: ["$supplierName", "$clientId.clientName", "-"],
          },
          size: { $ifNull: ["$size", "$adminProductId.size", "-"] },
          color: { $ifNull: ["$color", "$adminProductId.color", "-"] },
          quantity: { $ifNull: ["$quantity", 0] },
          price: { $ifNull: ["$price", 0] },
          ccy: { $ifNull: ["$ccy", "USD"] },
          deliveryDate: {
            $ifNull: ["$deliveryDate", new Date().toISOString()],
          },
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
            $dateToString: {
              format: "%Y-%m-%d",
              date: { $ifNull: ["$deliveryDate", new Date()] },
            },
          },
        },
      },
    ]);

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
/**
 * Deletes a buy order by its ID.
 *
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @returns {Promise<void>}
 */
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

/**
 * Updates a buy order's status, quantity, and delivery date.
 *
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @returns {Promise<void>}
 */
const updateBuyOrder = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { buyOrderId } = req.params;
    const { orderStatus, quantity, deliveryDate,price} = req.body;

    if (!req.userId || !Types.ObjectId.isValid(req.userId)) {
      return responseHandler(
        res,
        401,
        `Unauthorized: Invalid userId: ${req.userId}`,
        "error"
      );
    }

    if (!Types.ObjectId.isValid(buyOrderId)) {
      return responseHandler(
        res,
        400,
        `Invalid buyOrderId: ${buyOrderId}`,
        "error"
      );
    }

    // Validate input fields
    if (orderStatus && typeof orderStatus !== "string") {
      return responseHandler(
        res,
        400,
        `Invalid orderStatus: ${orderStatus}`,
        "error"
      );
    }
    if (
      quantity !== undefined &&
      (typeof quantity !== "number" || quantity <= 0)
    ) {
      return responseHandler(
        res,
        400,
        `Invalid quantity: ${quantity}`,
        "error"
      );
    }
    if (deliveryDate && isNaN(new Date(deliveryDate).getTime())) {
      return responseHandler(
        res,
        400,
        `Invalid deliveryDate: ${deliveryDate}`,
        "error"
      );
    }

    // Find the buy order and ensure the user is authorized (either userId or clientId matches)
    const buyOrder = await Order.findOne({
      _id: new Types.ObjectId(buyOrderId),
      $or: [
        { userId: new Types.ObjectId(req.userId) },
        { clientId: new Types.ObjectId(req.userId) },
      ],
    });

    if (!buyOrder) {
      return responseHandler(
        res,
        404,
        "Buy order not found or not authorized",
        "error"
      );
    }

    await Order.findOneAndUpdate(
      { _id: new Types.ObjectId(buyOrderId) },
      {
        $set: {
          orderStatus,
        },
      }
    );

    await OrderItem.findOneAndUpdate(
      { orderId: new Types.ObjectId(buyOrderId) },
      {
        $set: {
          quantity,
          deliveryDate,
          price
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
    });
    responseHandler(
      res,
      500,
      error.message || "Internal server error",
      "error"
    );
  }
};



export {
  createBuyOrder,
  createBulkBuyOrders,
  getAllBuyOrders,
  deleteBuyOrder,
  updateBuyOrder,
  
};