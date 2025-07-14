import { Request, Response } from "express";
import Inventory from "../schemas/Inventory";
import { responseHandler } from "../utils/responseHandler";
import { Types } from "mongoose";
import mongoose from "mongoose";
import Order, { IOrder } from "../schemas/Order";
import OrderItem, { IOrderItem } from "../schemas/OrderItem";
import CartItem from "../schemas/CartItem";
import Cart from "../schemas/Cart";

interface AuthRequest extends Request {
  userId?: string;
}

const createBuyOrder = async (
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

    const { inventoryId, quantity, price, deliveryDate } = req.body;

    if (!inventoryId || !Types.ObjectId.isValid(inventoryId)) {
      return responseHandler(
        res,
        400,
        `Invalid inventoryId: ${inventoryId}`,
        "error"
      );
    }
    if (isNaN(quantity) || quantity <= 0) {
      return responseHandler(
        res,
        400,
        "Quantity must be a positive number",
        "error"
      );
    }
    if (isNaN(price) || price < 0) {
      return responseHandler(res, 400, "Price cannot be negative", "error");
    }
    if (!isValidDate(deliveryDate)) {
      return responseHandler(res, 400, "Invalid delivery date", "error");
    }

    const inventory = await Inventory.findById(inventoryId);
    if (!inventory) {
      return responseHandler(
        res,
        404,
        `Inventory with ID ${inventoryId} not found`,
        "error"
      );
    }

    const cart = await Cart.findOneAndUpdate(
      { userId: req.userId },
      { $setOnInsert: { userId: req.userId } },
      { upsert: true, new: true }
    );

    const cartItem = await CartItem.findOneAndUpdate(
      { cartId: cart._id, inventoryId },
      {
        $setOnInsert: {
          cartId: cart._id,
          inventoryId,
          quantity,
          price,
          deliveryDate,
        },
      },
      { new: true, upsert: true }
    );

    responseHandler(
      res,
      201,
      "Buy order created successfully",
      "success",
      cartItem
    );
  } catch (error: any) {
    console.error("Error creating buy order:", {
      message: error.message,
      stack: error.stack,
      body: req.body,
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

const isValidDate = (date: string): boolean => {
  const parsedDate = new Date(date);
  return parsedDate instanceof Date && !isNaN(parsedDate.getTime());
};

const createBulkBuyOrders = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { orders } = req.body;
    const userId = req.userId;

    if (!userId || !Types.ObjectId.isValid(userId)) {
      return responseHandler(
        res,
        401,
        "Unauthorized: Invalid user ID",
        "error"
      );
    }

    if (!Array.isArray(orders) || orders.length === 0) {
      return responseHandler(
        res,
        400,
        "Orders array is required and cannot be empty",
        "error"
      );
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
        console.log("Order", order);

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
          clientId: new Types.ObjectId(clientId),
        });
        console.log("new order", newOrderItem);
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
          total: savedOrder.total,
        });
      }

      await session.commitTransaction();
      responseHandler(
        res,
        201,
        "Orders created successfully",
        "success",
        createdOrders
      );
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
    responseHandler(
      res,
      500,
      error.message || "Internal server error",
      "error"
    );
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
//     console.log("Fetching orders for userId:", req.userId);

//     const result = await Order.aggregate([
//       {
//         $match: {
//           $or: [
//             { userId: new Types.ObjectId(req.userId) },
//             { clientId: new Types.ObjectId(req.userId) },
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
//           from: "inventory",
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
//           productId: { $ifNull: ["$orderItems.productId", "-"] },
//           productName: { $ifNull: ["$orderItems.productName", "-"] },
//           supplierName: { $ifNull: ["$orderItems.supplierName", "-"] },
//           size: { $ifNull: ["$orderItems.size", "-"] },
//           color: { $ifNull: ["$orderItems.color", "-"] },
//           quantity: { $ifNull: ["$orderItems.quantity", 0] },
//           price: { $ifNull: ["$orderItems.price", 0] },
//           ccy: { $ifNull: ["$orderItems.ccy", "USD"] },
//           deliveryDate: {
//             $ifNull: ["$orderItems.deliveryDate", new Date().toISOString()],
//           },
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
//           hasOrderItems: {
//             $cond: [{ $eq: [{ $type: "$orderItems" }, "object"] }, true, false],
//           },
//           orderItemsDebug: "$orderItems",
//           clientDetailsDebug: "$clientDetails",
//         },
//       },
//     ]);

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
const getAllBuyOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId || !Types.ObjectId.isValid(req.userId)) {
      return responseHandler(res, 401, `Unauthorized: Invalid userId: ${req.userId}`, "error");
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const query = req.query.query as string;
    const status = req.query.status as string;
    const skip = (page - 1) * limit;

    console.log("Fetching orders for userId:", req.userId, "Page:", page, "Limit:", limit, "Query:", query, "Status:", status);

    // Build match stage with search and status filters
    const matchStage: any = {
      $or: [
        { userId: new Types.ObjectId(req.userId) },
        { clientId: new Types.ObjectId(req.userId) },
      ],
    };

    if (status) {
      matchStage.orderStatus = status;
    }

    const pipeline = [
      { $match: matchStage },
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
          from: "inventory",
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
          localField: "clientId",
          foreignField: "_id",
          as: "clientDetails",
        },
      },
      {
        $unwind: { path: "$clientDetails", preserveNullAndEmptyArrays: true },
      },
      // Add search query filter
      ...(query
        ? [
            {
              $match: {
                $or: [
                  { "orderItems.productName": { $regex: query, $options: "i" } },
                  { "orderItems.supplierName": { $regex: query, $options: "i" } },
                ],
              },
            },
          ]
        : []),
      {
        $project: {
          id: "$_id",
          clientId: { $ifNull: ["$clientDetails._id", ""] },
          productId: { $ifNull: ["$orderItems.productId", "-"] },
          productName: { $ifNull: ["$orderItems.productName", "-"] },
          supplierName: { $ifNull: ["$orderItems.supplierName", "-"] },
          size: { $ifNull: ["$orderItems.size", "-"] },
          color: { $ifNull: ["$orderItems.color", "-"] },
          quantity: { $ifNull: ["$orderItems.quantity", 0] },
          price: { $ifNull: ["$orderItems.price", 0] },
          ccy: { $ifNull: ["$orderItems.ccy", "USD"] },
          deliveryDate: {
            $ifNull: ["$orderItems.deliveryDate", new Date().toISOString()],
          },
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
        },
      },
      { $skip: skip },
      { $limit: limit },
    ];

    // Run aggregation to get paginated orders
    const orders = await Order.aggregate(pipeline);

    // Get total count for pagination
    const countPipeline = [
      { $match: matchStage },
      ...(query
        ? [
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
              $match: {
                $or: [
                  { "orderItems.productName": { $regex: query, $options: "i" } },
                  { "orderItems.supplierName": { $regex: query, $options: "i" } },
                ],
              },
            },
          ]
        : []),
      { $count: "total" },
    ];
    const countResult = await Order.aggregate(countPipeline);
    const totalOrders = countResult.length > 0 ? countResult[0].total : 0;

    console.log("Fetched buy orders:", orders.length, "Total orders:", totalOrders);

    responseHandler(res, 200, "Buy orders fetched successfully", "success", {
      buyOrders: orders,
      totalOrders,
      page,
      limit,
    });
  } catch (error: any) {
    console.error("Error fetching buy orders:", {
      message: error.message,
      stack: error.stack,
      userId: req.userId,
    });
    responseHandler(res, 500, error.message || "Failed to fetch buy orders", "error");
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

const updateBuyOrder = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { buyOrderId } = req.params;
    const { quantity, deliveryDate, price, orderStatus } = req.body;

    console.log("UpdateBuyOrder - Input:", {
      buyOrderId,
      userId: req.userId,
      body: req.body,
    });

    // Validate userId
    if (!req.userId || !Types.ObjectId.isValid(req.userId)) {
      return responseHandler(
        res,
        401,
        `Unauthorized: Invalid userId: ${req.userId}`,
        "error"
      );
    }

    // Start a transaction to ensure atomic updates
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Find the buy order
      const buyOrder = await Order.findOne({
        _id: new Types.ObjectId(buyOrderId),
        $or: [
          { userId: new Types.ObjectId(req.userId) },
          { clientId: new Types.ObjectId(req.userId) },
        ],
      }).session(session);

      if (!buyOrder) {
        await session.abortTransaction();
        return responseHandler(
          res,
          404,
          "Buy order not found or not authorized",
          "error"
        );
      }

      // Find the associated order item
      const orderItem = await OrderItem.findOne({
        orderId: new Types.ObjectId(buyOrderId),
      }).session(session);
      if (!orderItem) {
        await session.abortTransaction();
        return responseHandler(
          res,
          404,
          "OrderItem not found for this buy order",
          "error"
        );
      }

      // Prepare update objects
      const orderUpdates: Partial<IOrder> = {};
      const orderItemUpdates: Partial<IOrderItem> = {};

      if (orderStatus !== undefined) {
        orderUpdates.orderStatus = orderStatus;
        orderItemUpdates.orderStatus = orderStatus;
      }
      if (quantity !== undefined) orderItemUpdates.quantity = quantity;
      if (price !== undefined) orderItemUpdates.price = price;
      if (deliveryDate !== undefined)
        orderItemUpdates.deliveryDate = new Date(deliveryDate);

      // Update total in Order if quantity or price changes
      if (quantity !== undefined || price !== undefined) {
        const newQuantity =
          quantity !== undefined ? quantity : orderItem.quantity;
        const newPrice = price !== undefined ? price : orderItem.price;
        orderUpdates.total = newQuantity * newPrice;
      }

      // Update Order
      const updatedOrder = (await Order.findOneAndUpdate(
        { _id: new Types.ObjectId(buyOrderId) },
        { $set: { ...orderUpdates, updatedAt: new Date() } },
        { new: true, session }
      )) as IOrder | null;

      if (!updatedOrder) {
        await session.abortTransaction();
        return responseHandler(res, 500, "Failed to update order", "error");
      }

      // Update OrderItem
      const updatedOrderItem = (await OrderItem.findOneAndUpdate(
        { orderId: new Types.ObjectId(buyOrderId) },
        { $set: { ...orderItemUpdates, updatedAt: new Date() } },
        { new: true, session }
      )) as IOrderItem | null;

      if (!updatedOrderItem) {
        await session.abortTransaction();
        return responseHandler(
          res,
          500,
          "Failed to update order item",
          "error"
        );
      }

      await session.commitTransaction();
      // Construct response
      const responseData = {
        id: updatedOrder._id.toString(),
        orderStatus: updatedOrder.orderStatus,
        quantity: updatedOrderItem.quantity,
        price: updatedOrderItem.price,
        deliveryDate: updatedOrderItem.deliveryDate
          ? new Date(updatedOrderItem.deliveryDate).toISOString()
          : new Date().toISOString(),
        total: updatedOrder.total,
        ccy: updatedOrderItem.ccy,
        productName: updatedOrderItem.productName || "",
        supplierName: updatedOrderItem.supplierName || "",
        size: updatedOrderItem.size || "",
        color: updatedOrderItem.color || "",
        inventoryId: updatedOrderItem.inventoryId?.toString() || "",
        productId: updatedOrderItem.productId?.toString() || "",
        clientId:
          updatedOrderItem.clientId?.toString() ||
          updatedOrder.clientId.toString(),
      };

      return responseHandler(
        res,
        200,
        "Buy order updated successfully",
        "success",
        responseData
      );
    } catch (error: any) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error: any) {
    return responseHandler(
      res,
      500,
      error.message || "Internal server error",
      "error"
    );
  }
};

export default updateBuyOrder;

export {
  createBuyOrder,
  createBulkBuyOrders,
  getAllBuyOrders,
  deleteBuyOrder,
  updateBuyOrder,
};
