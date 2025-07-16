import { Request, Response } from "express";
import Inventory from "../schemas/Inventory";
import { responseHandler } from "../utils/responseHandler";
import { Types } from "mongoose";
import mongoose from "mongoose";
import Order from "../schemas/Order";
import OrderItem from "../schemas/OrderItem";
import CartItem from "../schemas/CartItem";
import Cart from "../schemas/Cart";
import { NotFoundError } from "../utils/errors";

/**
 * Creates a single buy order.
 *
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @returns {Promise<void>}
 */
const createBuyOrder = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { inventoryId, quantity, price, deliveryDate } = req.body;

    const inventory = await Inventory.findById(inventoryId);
    if (!inventory) {
      throw new NotFoundError("Inventory not found");
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

/**
 * Creates multiple buy orders in bulk.
 *
 * @param {Request} req
 * @param {Response} res
 * @returns {Promise<void>}
 */
const createBulkBuyOrders = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { orders } = req.body;
  const userId = req.userId;

  const session = await Order.startSession();
  session.startTransaction();
  try {
    for (const order of orders) {
      const {
        clientId,
        quantity,
        price,
        orderStatus,
        deliveryDate,
        inventoryId,
      } = order;
      console.log("userId", userId)
      const existingOrder = await Order.findOne({
        userId: new Types.ObjectId(userId),
      }).session(session);
      console.log("existingOrder", existingOrder)
      let newOrder = null
      if(existingOrder){
        newOrder = await Order.findOneAndUpdate({
          userId: new Types.ObjectId(userId),
        }, {
          $set: {
            clientId,
            total: (quantity * price) + existingOrder.total,
            outstandingTotal: (quantity * price) + existingOrder.outstandingTotal,
            orderStatus: orderStatus || "Pending",
          }  
        },
        {new: true}
        )
      }else {
        newOrder = await Order.create({
          userId: new Types.ObjectId(userId),
          clientId,
          total: quantity * price,
          outstandingTotal: quantity * price,
          orderStatus: orderStatus || "Pending",
          invoiceNumber: `INV-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        })
      }

      const newOrderItem = new OrderItem({
        orderId: newOrder?._id,
        inventoryId: new Types.ObjectId(inventoryId),
        quantity,
        price,
        outstandingPrice: quantity * price,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : new Date(),
      });

      await newOrderItem.save({ session });
    }

    await session.commitTransaction();
    responseHandler(
      res,
      201,
      "Orders created successfully",
      "success"
    );
  } catch (error: any) {
    await session.abortTransaction();
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
  } finally {
    session.endSession();
  }
};

/**
 * Retrieves all buy orders
 * @param {AuthRequest} req
 * @param {Response} res
 * @returns {Promise<void>}
 */
const getAllBuyOrders = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { page = 1, limit = 10, status } = req.query;
  try {
    const orderAggregate = Order.aggregate([
      {
        $match: {
          ...(status && {
            orderStatus: status,
          }),
          $or: [
            { userId: new Types.ObjectId(req.userId) },
            { clientId: new Types.ObjectId(req.userId) },
          ],
        },
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
          from: "adminproducts",
          localField: "inventory.adminProductId",
          foreignField: "_id",
          as: "adminProducts",
        },
      },
      {
        $unwind: { path: "$adminProducts", preserveNullAndEmptyArrays: true },
      },
    ]);

    const buyOrders = await (Order as any).aggregatePaginate(orderAggregate, {
      page,
      limit,
      customLabels: {
        docs: "orders",
        totalDocs: "totalOrders",
      },
    });

    responseHandler(
      res,
      200,
      "Buy orders fetched successfully",
      "success",
      buyOrders
    );
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
  req: Request,
  res: Response
): Promise<void> => {
  const { id } = req.params;
  try {
    const cart = await Cart.findOne({ userId: req.userId });
    if (!cart) {
      throw new NotFoundError("Cart not found");
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
  req: Request,
  res: Response
): Promise<void> => {
  const { buyOrderId } = req.params;
  const { quantity, deliveryDate, price, orderStatus } = req.body;
  console.log("Updating buy order:", buyOrderId, req.body);
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const order = await Order.findOne({
      _id: new Types.ObjectId(buyOrderId),
      $or: [
        { userId: new Types.ObjectId(req.userId) },
        { clientId: new Types.ObjectId(req.userId) },
      ],
    }).session(session);
    if (!order) {
      throw new NotFoundError("Order not found");
    }

    order.orderStatus = orderStatus;
    await order.save({ session });

    const orderItem = await OrderItem.findOne({
      orderId: new Types.ObjectId(buyOrderId),
    });
    if (!orderItem) {
      throw new NotFoundError("Order item not found");
    }

    orderItem.quantity = quantity;
    orderItem.deliveryDate = deliveryDate;
    orderItem.price = price;
    await orderItem.save({ session });

    await session.commitTransaction();
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
    responseHandler(
      res,
      500,
      error.message || "Internal server error",
      "error"
    );
  } finally {
    session.endSession();
  }
};

export {
  createBuyOrder,
  createBulkBuyOrders,
  getAllBuyOrders,
  deleteBuyOrder,
  updateBuyOrder,
};
