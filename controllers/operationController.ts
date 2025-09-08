
import asyncHandler from "express-async-handler";
import { NextFunction, Request, Response } from "express";
import SellOrder from "../schemas/SellOrder";
import mongoose, { Types } from "mongoose";
import { responseHandler } from "../utils/responseHandler";
import SellOrderItem from "../schemas/SellOrderItem";
import { SellOrderItemStatusEnum, OrderStatusEnum } from "../api/constants";
import { BadRequestError } from "../utils/errors";


const getAllOperationSellOrder = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { page = "1", limit = "10", search = "" } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);

    try {
      const query: any = {};
      if (search) {
        query.$or = [
          {
            $expr: {
              $regexMatch: {
                input: { $toString: "$orderNumber" },
                regex: String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), // Escape special characters
                options: "i",
              },
            },
          },
          {
            "client.clientName": {
              $regex: String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
              $options: "i",
            },
          },
        ];
      }

      const orderAggregate = SellOrder.aggregate([
        {
          $match: { userId: new Types.ObjectId(req.userId) },
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
          $unwind: { path: "$client", preserveNullAndEmptyArrays: true },
        },
        { $match: query },
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
        { $sort: { createdAt: -1 } },
      ]);

      const orders = await (SellOrder as any).aggregatePaginate(orderAggregate, {
        page: pageNum,
        limit: limitNum,
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
        shipTodayTotalPages: Math.ceil(shipToday.length / limitNum),
        shipLaterTotalPages: Math.ceil(shipLater.length / limitNum),
      });
    } catch (error) {
      console.error("Error fetching orders:", error);
      throw new Error("Failed to fetch orders");
    }
  }
);




const getAllOperationSellOrderItem = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { orderId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    console.log(`Received orderId: ${orderId}`); // Log for debugging

    if (!orderId) {
      throw new BadRequestError("Order ID is required");
    }

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      throw new BadRequestError("Invalid order ID format");
    }

    // Check if order exists
    const order = await SellOrder.findById(orderId);
    if (!order) {
      throw new BadRequestError("Order not found");
    }

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
          sellPrice: 1,
          status: 1,
          adminProduct: {
            productId: "$adminProduct._id",
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

    if (orders.totalOrders === 0) {
      console.log(`No order items found for orderId: ${orderId}`);
    }

    responseHandler(res, 200, "Order items fetched successfully", "success", orders);
  }
);



const confirmOperationSellOrderItem = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const orderItem = await SellOrderItem.findById(id);
    if (!orderItem) {
      throw new BadRequestError("Order item not found");
    }

    if (orderItem.status === SellOrderItemStatusEnum.PALLETTE_READY) {
      orderItem.status = SellOrderItemStatusEnum.ORDER_PRINTED;
    } else {
      orderItem.status = SellOrderItemStatusEnum.PALLETTE_READY;
    }

    // Update to PALLETTE_READY
    orderItem.status = SellOrderItemStatusEnum.PALLETTE_READY;
    await orderItem.save();

    responseHandler(
      res,
      200,
      `Order item ${orderItem.status === SellOrderItemStatusEnum.PALLETTE_READY ? "confirmed" : "unconfirmed"} successfully`,
      "success"
    );
  }
);

const markAsShippedOperationSellOrder = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestError("Invalid order ID format");
    }

    const order = await SellOrder.findById(id);
    if (!order) {
      throw new BadRequestError("Order not found");
    }

    // Prevent marking as shipped if already ORDER_SHIPPED
    if (order.status === OrderStatusEnum.ORDER_SHIPPED) {
      throw new BadRequestError("Order is already marked as shipped");
    }

    // Check if all order items are PALLETTE_READY
    const orderItems = await SellOrderItem.find({ orderId: id });

    if (
      orderItems.some(
        (item) => item.status !== SellOrderItemStatusEnum.PALLETTE_READY
      )
    ) {
      throw new BadRequestError("Some order items are not confirmed");
    }

    // Update order status to ORDER_SHIPPED
    await SellOrder.updateOne(
      { _id: id },
      { $set: { status: OrderStatusEnum.ORDER_SHIPPED, updatedAt: new Date() } }
    );

    responseHandler(res, 200, "Order marked as shipped successfully", "success");
  }
);

const getAllShippedOrders = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { page = "1", limit = "10", search = "" } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);

    try {
      const query: any = {
        status: OrderStatusEnum.ORDER_SHIPPED,
      };
      if (search) {
        query.$or = [
          {
            $expr: {
              $regexMatch: {
                input: { $toString: "$orderNumber" },
                regex: String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                options: "i",
              },
            },
          },
          {
            "client.clientName": {
              $regex: String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
              $options: "i",
            },
          },
        ];
      }

      const orderAggregate = SellOrder.aggregate([
        {
          $match: {
            userId: new Types.ObjectId(req.userId),
            status: OrderStatusEnum.ORDER_SHIPPED,
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
          $unwind: { path: "$client", preserveNullAndEmptyArrays: true },
        },
        { $match: query },
        {
          $project: {
            _id: 1,
            orderNumber: 1,
            total: 1,
            status: 1,
            clientName: "$client.clientName",
            createdAt: 1,
            shippedAt: "$updatedAt",
          },
        },
        { $sort: { updatedAt: -1 } },
      ]);

      const orders = await (SellOrder as any).aggregatePaginate(orderAggregate, {
        page: pageNum,
        limit: limitNum,
        customLabels: {
          docs: "orders",
          totalDocs: "totalOrders",
        },
      });

      responseHandler(res, 200, "Shipped orders fetched successfully", "success", orders);
    } catch (error) {
      console.error("Error fetching shipped orders:", error);
      throw new Error("Failed to fetch shipped orders");
    }
  }
);








export {
  getAllOperationSellOrder,
  getAllOperationSellOrderItem,
  confirmOperationSellOrderItem,
  markAsShippedOperationSellOrder,
  getAllShippedOrders
};


