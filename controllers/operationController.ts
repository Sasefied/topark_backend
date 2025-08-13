
import asyncHandler from "express-async-handler";
import { NextFunction, Request, Response } from "express";
import SellOrder from "../schemas/SellOrder";
import mongoose from "mongoose";
import { responseHandler } from "../utils/responseHandler";
import SellOrderItem from "../schemas/SellOrderItem";
import { OrderItemStatusEnum, OrderStatusEnum } from "../api/constants";
import { BadRequestError } from "../utils/errors";

/**
 * Get all sell orders
 *
 * @async
 * @param  {Request} req - Express request object
 * @param  {Response} res - Express response object
 * @route   GET /api/operation/sell-orders
 * @access  Private
 * @returns {Promise<void>}
 */
const getAllOperationSellOrder = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { page = 1, limit = 10 } = req.query;

    const orderAggregate = SellOrder.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(req.userId),
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
        },
      },
      {
        $project: {
          _id: 1,
          orderNumber: 1,
          total: 1,
          shipToday: 1,
          status: 1,
          clientName: "$client.clientName",
          createdAt: 1,
        },
      },
      {
        $sort: { createdAt: -1 },
      },
    ]);

    const orders = await SellOrder.aggregatePaginate(orderAggregate, {
      page: Number(page),
      limit: Number(limit),
      customLabels: {
        docs: "orders",
        totalDocs: "totalOrders",
      },
    });

    const ordersArray = Array.isArray(orders.orders)
      ? (orders.orders as Array<{ shipToday: boolean }>)
      : [];

    const shipToday = ordersArray.filter((order) => order.shipToday);
    const shipLater = ordersArray.filter((order) => !order.shipToday);

    responseHandler(res, 200, "Orders fetched successfully", "success", {
      ...orders,
      shipToday,
      shipLater,
    });
  }
);

/**
 * Get all sell order items
 *
 * @async
 * @param  {Request} req - Express request object
 * @param  {Response} res - Express response object
 * @route   GET /api/operation/:orderId/items
 * @access  Private
 * @returns {Promise<void>}
 */
const getAllOperationSellOrderItem = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { orderId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const orderAggregate = SellOrderItem.aggregate([
      {
        $match: {
          orderId: new mongoose.Types.ObjectId(orderId),
        },
      },
      {
        $lookup: {
          from: "inventories",
          localField: "inventoryId",
          foreignField: "_id",
          as: "inventory",
        },
      },
      {
        $unwind: {
          path: "$inventory",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "adminproducts",
          localField: "inventory.adminProductId",
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
      {
        $project: {
          _id: 1,
          orderId: 1,
          quantity: 1,
          status: 1,
          adminProduct: {
            productCode: 1,
            color: 1,
            size: 1,
            variety: 1,
          },
        },
      },
    ]);

    const orders = await SellOrderItem.aggregatePaginate(orderAggregate, {
      page: Number(page),
      limit: Number(limit),
      customLabels: {
        docs: "orders",
        totalDocs: "totalOrders",
      },
    });

    responseHandler(res, 200, "Orders fetched successfully", "success", orders);
  }
);

/**
 * Confirm sell order item
 *
 * @async
 * @param  {Request} req - Express request object
 * @param  {Response} res - Express response object
 * @route   PUT /api/operation/:id/confirm
 * @access  Private
 * @returns {Promise<void>}
 */
const confirmOperationSellOrderItem = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const orderItem = await SellOrderItem.findById(id);
    if (!orderItem) {
      throw new BadRequestError("Order item not found");
    }

    if (orderItem.status === OrderItemStatusEnum.PALLETTE_READY) {
      orderItem.status = OrderItemStatusEnum.ORDER_PRINTED;
    } else {
      orderItem.status = OrderItemStatusEnum.PALLETTE_READY;
    }

    await orderItem.save();

    await responseHandler(
      res,
      200,
      `Order item ${orderItem.status === OrderItemStatusEnum.PALLETTE_READY ? "confirmed" : "unconfirmed"} successfully`,
      "success"
    );
  }
);

/**
 * Mark sell order as shipped
 *
 * @async
 * @param  {Request} req - Express request object
 * @param  {Response} res - Express response object
 * @route   PUT /api/operation/:id/mark-as-shipped
 * @access  Private
 * @returns {Promise<void>}
 */
const markAsShippedOperationSellOrder = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const orderItems = await SellOrderItem.find({ orderId: id });

    if (
      orderItems.some(
        (item) => item.status !== OrderItemStatusEnum.PALLETTE_READY
      )
    ) {
      throw new BadRequestError("Some order items are not confirmed");
    }

    await SellOrder.updateOne(
      { _id: id },
      { $set: { orderStatus: OrderStatusEnum.ORDER_SHIPPED } }
    );

    responseHandler(res, 200, "Order shipped successfully", "success");
  }
);

export {
  getAllOperationSellOrder,
  getAllOperationSellOrderItem,
  confirmOperationSellOrderItem,
  markAsShippedOperationSellOrder,
};