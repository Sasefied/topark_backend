import { Request, Response } from "express";
import { responseHandler } from "../utils/responseHandler";
import Order from "../schemas/Order";
import OrderItem from "../schemas/OrderItem";
import {
  BadRequestError,
  InternalServerError,
  NotFoundError,
} from "../utils/errors";
import OrderPayment from "../schemas/OrderPayment";

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
        $unwind: "$client",
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
      page,
      limit,
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
 * @route GET /cashiering/:orderId
 * @access Private
 * @returns {Promise<void>}
 */
const getCashieringOrderById = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const order = await Order.aggregate([
      {
        $match: { _id: orderId },
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
        $unwind: "$client",
      },
    ]);

    const orderItems = await OrderItem.find({ orderId: orderId });
    if (!order) {
      throw new NotFoundError("Order not found");
    }
    responseHandler(res, 200, "Order fetched successfully", "success", {
      order,
      orderItems,
    });
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

const processCashieringOrder = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { cash = 0, card = 0, cheque = 0 } = req.body;
    const createdBy = req.user?._id;

    const paymentMethods = [
      { method: "cash", amount: cash },
      { method: "card", amount: card },
      { method: "cheque", amount: cheque },
    ].filter((p) => p.amount > 0);

    if (paymentMethods.length === 0) {
      throw new BadRequestError("Please select at least one payment method");
    }

    const order = await Order.findById(orderId);

    if (!order) {
      throw new NotFoundError("Order not found");
    }

    const totalPayment = paymentMethods.reduce((sum, p) => sum + p.amount, 0);

    await OrderPayment.insertMany(
      paymentMethods.map((p) => ({
        orderId: order._id,
        method: p.method,
        amount: p.amount,
        createdBy,
      }))
    );

    let remaining = totalPayment;
    const orderItems = await OrderItem.find({
      orderId,
      outstandingPrice: { $gt: 0 },
    }).sort({ deliveryDate: 1, createdAt: 1 });

    for (const item of orderItems) {
      if (remaining <= 0) break;

      const applyAmount = Math.min(item.outstandingPrice, remaining);
      item.outstandingPrice -= applyAmount;
      remaining -= applyAmount;

      await item.save();
    }

    const updatedItems = await OrderItem.find({ orderId });
    order.outstandingTotal = updatedItems.reduce(
      (sum, item) => sum + item.outstandingPrice,
      0
    );

    await order.save();

    responseHandler(res, 200, "Order processed successfully", "success");
  } catch (error: any) {
    throw new InternalServerError();
  }
};

export {
  getAllCashieringOrders,
  searchCashieringOrders,
  getCashieringOrderById,
  processCashieringOrder,
};
