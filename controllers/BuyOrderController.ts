import { Request, Response } from "express";
import BuyOrder from "../schemas/BuyOrder";
import { responseHandler } from "../utils/responseHandler";
import { Types } from "mongoose";

/**
 * Creates a new buy order.
 *
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 *
 * @returns {Promise<void>}
 */
const createBuyOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, inventoryId, quantity, price, deliveryDate, orderStatus } =
      req.body;

    if (id) {
      await BuyOrder.findByIdAndUpdate(id, {
        inventoryId,
        quantity,
        price,
        deliveryDate,
        orderStatus,
      });
    } else {
      await BuyOrder.create({
        userId: req.userId,
        inventoryId,
        quantity,
        price,
        deliveryDate,
        orderStatus,
      });
    }

    responseHandler(res, 200, "Buy order created successfully", "success");
  } catch (error) {
    console.error("Error creating buy order:", error);
    responseHandler(res, 500, "Internal server error", "error");
  }
};

/**
 * Retrieves all buy orders with pagination and populates related inventory and product details.
 *
 * @param {Request} req - Express request object containing pagination query parameters.
 * @param {Response} res - Express response object used to return the buy orders data.
 *
 * @returns {Promise<void>}
 */

const getAllBuyOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const aggregate = BuyOrder.aggregate([
        {
            $match: {
                userId: { $eq: new Types.ObjectId(req.userId) },
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
        $lookup: {
          from: "adminproducts",
          localField: "inventory.adminProductId",
          foreignField: "_id",
          as: "adminProduct",
        },
      },
    ]);

    const buyOrders = await (BuyOrder as any).aggregatePaginate(aggregate, {
      page,
      limit,
      customLabels: {
        docs: "buyOrders",
        totalDocs: "totalBuyOrders",
      },
      sort: {
        createdAt: -1,
      },
    });

    responseHandler(
      res,
      200,
      "Buy orders fetched successfully",
      "success",
      buyOrders
    );
  } catch (error) {
    console.error("Error fetching buy orders:", error);
    responseHandler(res, 500, "Internal server error", "error");
  }
};

/**
 * Deletes a buy order by its ID.
 *
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 *
 * @returns {Promise<void>}
 */
const deleteBuyOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { buyOrderId } = req.params;
    await BuyOrder.findByIdAndDelete(buyOrderId);
    responseHandler(res, 200, "Buy order deleted successfully", "success");
  } catch (error) {
    console.error("Error deleting buy order:", error);
    responseHandler(res, 500, "Internal server error", "error");
  }
};

export { createBuyOrder, getAllBuyOrders, deleteBuyOrder };
