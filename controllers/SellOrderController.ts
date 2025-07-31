import asyncHandler from "express-async-handler";
import { NextFunction, Request, Response } from "express";
import Client from "../schemas/ClientDetails";
import { responseHandler } from "../utils/responseHandler";
import { AdminProduct } from "../schemas/AdminProduct";
import { BadRequestError } from "../utils/errors";
import SellOrder, { ISellOrder } from "../schemas/SellOrder";
import SellOrderItem from "../schemas/SellOrderItem";
import mongoose from "mongoose";
import Inventory from "../schemas/Inventory";

/**
 * Search all clients
 *
 * @async
 * @param  {Request} req - Express request object
 * @param  {Response} res - Express response object
 * @route   GET /api/v1/sell-orders/search
 * @access  Private
 * @returns {Promise<void>}
 */
const searchAllClients = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { page = 1, limit = 10, query } = req.query;

    const clientAggregate = Client.aggregate([
      { $match: { clientName: { $regex: query, $options: "i" } } },
      {
        $project: {
          _id: 1,
          clientName: 1,
        },
      },
    ]);

    const clients = await (Client as any).aggregatePaginate(clientAggregate, {
      page,
      limit,
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
  }
);

/**
 * Search product code
 *
 * @async
 * @param  {Request} req - Express request object
 * @param  {Response} res - Express response object
 * @route   GET /api/v1/sell-orders/search
 * @access  Private
 * @returns {Promise<void>}
 */
const searchProductCode = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { query } = req.query;

    const products = await Inventory.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(req.userId),
        },
      },
      {
        $lookup: {
          from: "adminproducts",
          localField: "adminProductId",
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
        $match: {
          "adminProduct.productCode": {
            $regex: query,
            $options: "i",
          },
        },
      },
      {
        $group: {
          _id: "$adminProduct.productCode",
          productName: { $first: "$adminProduct.productName" },
          qtyInStock: { $first: "$qtyInStock" },
          qtyIncoming: { $first: "$qtyIncoming" },
          pricePerUnit: { $first: "$pricePerUnit" },
        },
      },
      {
        $project: {
          qtyInStock: 1,
          qtyIncoming: 1,
          pricePerUnit: 1,
          productName: 1,
          productCode: 1,
        },
      },
    ]);

    responseHandler(
      res,
      200,
      "Products fetched successfully",
      "success",
      products
    );
  }
);

/**
 * Create sell order
 *
 * @async
 * @param  {Request} req - Express request object
 * @param  {Response} res - Express response object
 * @param  {NextFunction} next - Express next function
 * @route   POST /api/v1/sell-orders
 * @access  Private
 * @returns {Promise<void>}
 */
const createSellOrder = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { orders, clientId } = req.body;
    const session = await mongoose.startSession();
    await session.startTransaction();

    try {
      let total = 0;

      const sellOrderItems = [];

      for (const order of orders) {
        const { inventoryId, productCode, quantity, sellPrice } = order;

        const product = await AdminProduct.findOne({ productCode }).session(
          session
        );

        if (!product) {
          throw new BadRequestError(`Invalid product code: ${productCode}`);
        }

        total += sellPrice * quantity;

        sellOrderItems.push({
          inventoryId,
          quantity,
          sellPrice,
        });
      }

      const lastOrderNumber = await SellOrder.findOne(
        {},
        { orderNumber: 1 },
        {
          sort: { createdAt: -1 },
        }
      ).session(session);

      // Create one sell order
      const newOrder: ISellOrder = (
        await SellOrder.create(
          [
            {
              userId: req.userId,
              clientId,
              orderNumber: (lastOrderNumber?.orderNumber || 0) + 1,
              total,
            },
          ],
          { session }
        )
      )[0];

      // Associate all items to that order
      const sellOrderItemDocs = sellOrderItems.map((item) => ({
        ...item,
        orderId: newOrder._id,
      }));

      await SellOrderItem.insertMany(sellOrderItemDocs, { session });

      await session.commitTransaction();
      responseHandler(res, 200, "Order created successfully", "success");
    } catch (error) {
      await session.abortTransaction();
      next(error);
    } finally {
      await session.endSession();
    }
  }
);

/**
 * Get sell order by id
 *
 * @async
 * @param  {Request} req - Express request object
 * @param  {Response} res - Express response object
 * @route   GET /api/v1/sell-orders/:id
 * @access  Private
 * @returns {Promise<void>}
 */
const getSellOrderById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const orders = await SellOrderItem.findOne({ orderId: id });

    responseHandler(res, 200, "Order fetched successfully", "success", orders);
  }
);

/**
 * Update sell order
 *
 * @async
 * @param  {Request} req - Express request object
 * @param  {Response} res - Express response object
 * @param  {NextFunction} next - Express next function
 * @route   PUT /api/v1/sell-orders/:id
 * @access  Private
 * @returns {Promise<void>}
 */
const updateSellOrder = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { id } = req.params;
    const { orders } = req.body;

    const session = await mongoose.startSession();
    await session.startTransaction();

    try {
      for (const order of orders) {
        const { id, productCode, quantity, sellPrice } = order;
        const product = await AdminProduct.findOne({ productCode }).session(
          session
        );

        if (!product) {
          throw new BadRequestError(`Invalid product code: ${productCode}`);
        }

        await SellOrderItem.updateOne(
          { _id: id },
          { $set: { inventoryId: product._id, quantity, sellPrice } },
          { session }
        );
      }

      const orderItems = await SellOrderItem.find({ orderId: id }).session(
        session
      );

      const total = orderItems.reduce(
        (sum, item) => sum + item.sellPrice * item.quantity,
        0
      );

      await SellOrder.updateOne({ _id: id }, { $set: { total } }, { session });

      await session.commitTransaction();
      responseHandler(res, 200, "Order updated successfully", "success");
    } catch (error) {
      await session.abortTransaction();
      next(error);
    } finally {
      await session.endSession();
    }
  }
);

/**
 * Delete sell order
 *
 * @async
 * @param  {Request} req - Express request object
 * @param  {Response} res - Express response object
 * @route   DELETE /api/v1/sell-orders/:id
 * @access  Private
 * @returns {Promise<void>}
 */
const deleteSellOrder = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const orderItem = await SellOrderItem.findById(id);

    if (!orderItem) {
      throw new BadRequestError("Order item not found");
    }

    await SellOrderItem.deleteOne({ _id: id });

    responseHandler(res, 200, "Order item deleted successfully", "success");
  }
);

/**
 * Get last sell order
 *
 * @async
 * @param  {Request} req - Express request object
 * @param  {Response} res - Express response object
 * @route   GET /api/v1/sell-orders/last
 * @access  Private
 * @returns {Promise<void>}
 */
const getLastSellOrder = asyncHandler(async (req: Request, res: Response) => {
  const lastOrder = await SellOrder.aggregate([
    {
      $sort: { createdAt: -1 },
    },
    {
      $limit: 1,
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
      $unwind: {
        path: "$orderItems",
        preserveNullAndEmptyArrays: true,
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
      $unwind: {
        path: "$inventory",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: "adminproducts",
        localField: "inventory.productCode",
        foreignField: "productCode",
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
        orderItems: {
          quantity: 1,
          sellPrice: 1,
          adminProduct: {
            productCode: 1,
          },
        },
      },
    },
  ]);
  responseHandler(res, 200, "Order fetched successfully", "success", lastOrder);
});

/**
 * Get most reordered order
 *
 * @async
 * @param  {Request} req - Express request object
 * @param  {Response} res - Express response object
 * @route   GET /api/v1/sell-orders/most-reordered
 * @access  Private
 * @returns {Promise<void>}
 */
const getMostReorderedOrder = asyncHandler(
  async (req: Request, res: Response) => {
    const mostReorderedOrder = await SellOrderItem.aggregate([
      {
        $lookup: {
          from: "sellorders",
          localField: "orderId",
          foreignField: "_id",
          as: "order",
        },
      },
      {
        $unwind: {
          path: "$order",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $match: {
          "order.userId": new mongoose.Types.ObjectId(req.userId),
        },
      },
      {
        $group: {
          _id: "$inventoryId",
          orderCount: { $sum: 1 },
          quantity: { $first: "$quantity" },
          sellPrice: { $first: "$sellPrice" },
        },
      },
      {
        $sort: { orderCount: -1 },
      },
      {
        $lookup: {
          from: "adminproducts",
          localField: "_id",
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
          orderCount: 1,
          productCode: "$adminProduct.productCode",
          quantity: 1,
          sellPrice: 1,
        },
      },
    ]);

    responseHandler(
      res,
      200,
      "Order items fetched successfully",
      "success",
      mostReorderedOrder
    );
  }
);

export {
  searchAllClients,
  searchProductCode,
  createSellOrder,
  getSellOrderById,
  updateSellOrder,
  deleteSellOrder,
  getLastSellOrder,
  getMostReorderedOrder,
};
