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

/**
 * Fetches all cashiering orders with pagination.
 *
 * @param {Request} req
 * @param {Response} res
 * @route GET /cashiering
 * @access Private
 * @returns {Promise<void>}
 */

const getAllCashieringOrders = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const orderAggregate = Order.aggregate([
      {
        $lookup: {
          from: "clients",
          localField: "clientId",
          foreignField: "_id",
          as: "client",
        },
      },
      {
        $unwind: { path: "$client", preserveNullAndEmptyArrays: true },
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
          client: {
            clientName: "$client.clientName",
          },
        },
      },
    ]);

    const orders = await (Order as any).aggregatePaginate(orderAggregate, {
      page,
      limit,
      customLabels: {
        docs: "orders",
        totalDocs: "totalOrders",
      },
    });

    responseHandler(res, 200, "Orders fetched successfully", "success", orders);
  } catch (error: any) {
    console.error("Error fetching cashiering orders:", error);
    throw new InternalServerError();
  }
};

/**
 * Searches for cashiering orders by invoice number or client name.
 *
 * @param {Request} req
 * @param {Response} res
 * @route GET /cashiering/search/:query
 * @access Private
 * @returns {Promise<void>}
 */

const searchCashieringOrders = async (req: Request, res: Response) => {
  try {
    const { query } = req.params;

    const orderAggregate = Order.aggregate([
      {
        $lookup: {
          from: "clients",
          localField: "clientId",
          foreignField: "_id",
          as: "client",
        },
      },
      {
        $unwind: "$client",
      },
      {
        $match: {
          $or: [
            { invoiceNumber: { $regex: query, $options: "i" } },
            { "client.clientName": { $regex: query, $options: "i" } },
          ],
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
          createdAt: 1,
          client: {
            clientName: "$client.clientName",
          },
        },
      },
    ]);

    const orders = await (Order as any).aggregatePaginate(orderAggregate, {
      page: 1,
      limit: 10,
      customLabels: {
        docs: "orders",
        totalDocs: "totalOrders",
      },
    });

    responseHandler(res, 200, "Orders fetched successfully", "success", orders);
  } catch (error: any) {
    throw new InternalServerError();
  }
};

/**
 * Fetches a specific cashiering order by ID.
 *
 * @param {Request} req
 * @param {Response} res
 * @route GET /cashiering
 * @access Private
 * @returns {Promise<void>}
 */
const getCashieringOrderByIds = async (req: Request, res: Response) => {
  const { orderIds } = req.body;
  const objectIds = orderIds.map((id: string) => new Types.ObjectId(id));
  
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
        }
      },
    ]);
   
    responseHandler(res, 200, "Order fetched successfully", "success", orders);
  } catch (error: any) {
    throw new InternalServerError();
  }
};

/**
 * Process a cashiering order by applying payments to order items.
 *
 * @param {Request} req
 * @param {Response} res
 * @route POST /cashiering/:orderId
 * @access Private
 * @returns {Promise<void>}
 */

// const processCashieringOrder = async (req: Request, res: Response) => {
//   const { orderId } = req.params;
//   const { cash = 0, card = 0, cheque = 0 } = req.body;
//   const session = await Order.startSession();
//   session.startTransaction();

//   try {
//     const paymentMethods = [
//       { method: "cash", amount: cash },
//       { method: "card", amount: card },
//       { method: "cheque", amount: cheque },
//     ].filter((p) => p.amount > 0);

//     if (paymentMethods.length === 0) {
//       throw new BadRequestError("Please select at least one payment method");
//     }

//     const order = await Order.findById(orderId);

//     if (!order) {
//       throw new NotFoundError("Order not found");
//     }

//     const totalPayment = paymentMethods.reduce((sum, p) => sum + p.amount, 0);

//     await OrderPayment.insertMany(
//       paymentMethods.map((p) => ({
//         orderId: order._id,
//         method: p.method,
//         amount: p.amount,
//         createdBy: req.userId,
//       }))
//     );

//     let remaining = totalPayment;
//     const orderItems = await OrderItem.find({
//       orderId,
//       outstandingPrice: { $gt: 0 },
//     }).sort({ deliveryDate: 1, createdAt: 1 });

//     for (const item of orderItems) {
//       if (remaining <= 0) break;

//       const applyAmount = Math.min(item.outstandingPrice, remaining);
//       item.outstandingPrice -= applyAmount;
//       remaining -= applyAmount;

//       await item.save({ session });
//     }

//     const updatedItems = await OrderItem.find({ orderId });
//     order.outstandingTotal = updatedItems.reduce(
//       (sum, item) => sum + item.outstandingPrice,
//       0
//     );

//     await order.save({ session });
//     await session.commitTransaction();
//     responseHandler(res, 200, "Order processed successfully", "success");
//   } catch (error: any) {
//     console.error(error);
//     await session.abortTransaction();
//     throw new InternalServerError();
//   } finally {
//     session.endSession();
//   }
// };

/**
 * Process multiple cashiering orders by applying payments to order items.
 *
 * @param {Request} req
 * @param {Response} res
 * @route POST /cashiering/process-order
 * @access Private
 * @returns {Promise<void>}
 */
const processCashieringOrder = async (req: Request, res: Response) => {
  const {
    orderIds,
    cash = 0,
    card = 0,
    cheque = 0,
    mode = "automatic",
  } = req.body;

  // Validate inputs
  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    throw new BadRequestError("At least one order ID is required");
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
      // Manual mode: Use provided orderIds in the given order
      orders = await Order.find({ _id: { $in: orderIds }, orderStatus: "Pending" }).session(session);
      // Ensure orders are returned in the same order as orderIds
      orders = orderIds
        .map((id) => orders.find((o) => (o as any)._id.equals(id)))
        .filter((o): o is IOrder => !!o);
    } else {
      // Automatic mode: Fetch all pending orders, sorted by createdAt
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

    // Insert payment records for each order
    const paymentRecords = [];
    let remainingPayment = totalPayment;

    for (const order of orders) {
      const orderPayment = paymentMethods.map((p) => ({
        orderId: order._id,
        method: p.method,
        amount: p.amount,
        createdBy: req.userId,
      }));
      paymentRecords.push(...orderPayment);
    }

    await OrderPayment.insertMany(paymentRecords, { session });

    // Process order items
    for (const order of orders) {
      if (remainingPayment <= 0) break;

      const orderItems = await OrderItem.find({
        orderId: order._id,
        outstandingPrice: { $gt: 0 },
      })
        .sort({ deliveryDate: 1, createdAt: 1 })
        .session(session);

      for (const item of orderItems) {
        if (remainingPayment <= 0) break;

        const applyAmount = Math.min(item.outstandingPrice, remainingPayment);
        item.outstandingPrice -= applyAmount;
        remainingPayment -= applyAmount;

        await item.save({ session });
      }

      // Update order's outstanding total
      order.outstandingTotal = orderItems.reduce(
        (sum, item) => sum + item.outstandingPrice,
        0
      );

      // Update order status if fully paid
      if (order.outstandingTotal <= 0) {
        order.orderStatus = "Delivered";
      }

      await order.save({ session });
    }

    // Commit transaction
    await session.commitTransaction();
    responseHandler(res, 200, "Orders processed successfully");
  } catch (error: any) {
    // Abort transaction on error
    if (session?.inTransaction()) {
      await session.abortTransaction();
    }

    throw new InternalServerError("Failed to process orders");
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
};
