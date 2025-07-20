import { Request, Response } from "express";
import { responseHandler } from "../utils/responseHandler";
import Order from "../schemas/Order";
import {
  BadRequestError,
  BaseError,
  InternalServerError,
} from "../utils/errors";
import ReportedIssue from "../schemas/ReportedIssue";
import mongoose from "mongoose";
import { getStaticFilePath } from "../utils/helpers";

/**
 * Get all logistic orders
 *
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @route GET /api/logistics
 * @access Private
 * @returns {Promise<void>} - A promise that resolves when the function is complete
 */
const getAllLogisticOrders = async (req: Request, res: Response) => {
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
        $unwind: {
          path: "$client",
          preserveNullAndEmptyArrays: true,
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
          clientId: 1,
          invoiceNumber: 1,
          total: 1,
          outstandingTotal: 1,
          orderStatus: 1,
          client: {
            clientName: 1,
          },
          adminProduct: {
            productName: 1,
            color: 1,
            size: 1,
            variety: 1,
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
    console.error("Error fetching orders:", error);
    throw new InternalServerError();
  }
};

/**
 * Search logistic orders
 *
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {string} page - The page number
 * @param {string} limit - The number of items per page
 * @param {string} query - The search query
 * @route GET /api/logistics/search/
 * @access Private
 * @returns {Promise<void>} - A promise that resolves when the function is complete
 */
const searchLogisticOrders = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10, query = "" } = req.query;

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
        $unwind: {
          path: "$client",
          preserveNullAndEmptyArrays: true,
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
        $match: {
          $or: [
            {
              invoiceNumber: {
                $regex: query,
                $options: "i",
              },
            },
            {
              "client.clientName": {
                $regex: query,
                $options: "i",
              },
            },
            {
              "adminProduct.productName": {
                $regex: query,
                $options: "i",
              },
            },
          ],
        },
      },
      {
        $project: {
          _id: 1,
          clientId: 1,
          invoiceNumber: 1,
          total: 1,
          outstandingTotal: 1,
          orderStatus: 1,
          client: {
            clientName: 1,
          },
          adminProduct: {
            productName: 1,
            color: 1,
            size: 1,
            variety: 1,
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
    console.error("Error fetching orders:", error);
    throw new InternalServerError();
  }
};

/**
 * Report an issue with a logistic order item
 * @param {string} orderItemId - _id of the order item
 * @param {object} req.body - issue details
 * @param {string} issueCategory - category of the issue
 * @param {number} receivedQuantity - quantity received
 * @param {string} proof - proof of issue (e.g. image)
 * @param {string} additionalNotes - additional notes about the issue
 * @param {boolean} productUnusable - whether the product is unusable
 * @param {string} issue - description of the issue
 * @param {boolean} productCompletelyDifferent - whether the product is completely different
 * @route POST /api/logistics/:orderItemId/report
 * @access Private
 * @returns {Promise<void>}
 */
const reportLogisticOrderItem = async (req: Request, res: Response) => {
  try {
    const { orderItemId } = req.params;
    const {
      orderId,
      issueCategory,
      receivedQuantity,
      additionalNotes,
      productUnusable,
      issue,
      productCompletelyDifferent,
    } = req.body;

    console.log("file", req.file);

    if (!req.file?.path) {
      throw new BadRequestError("Proof is required");
    }

    const proof = getStaticFilePath(req, req.file.filename);

    await ReportedIssue.updateOne(
      { orderItemId },
      {
        $set: {
          orderId,
          issueCategory,
          receivedQuantity,
          proof,
          additionalNotes,
          productUnusable,
          issue,
          productCompletelyDifferent,
        },
      },
      { upsert: true }
    );

    responseHandler(res, 200, "Issue reported successfully", "success");
  } catch (error: any) {
    console.log("Error reporting logistic order:", error);
    throw new BadRequestError(error.message);
  }
};

/**
 * Fetches all logistic ordered items for a given order ID.
 *
 * @param {Request} req - Express request object containing the order ID in params.
 * @param {Response} res - Express response object for sending back the response.
 * @route GET /api/logistics/:orderId/items
 * @access Private
 * @returns {Promise<void>} - A promise that resolves when the function is complete.
 */

const getAllLogisticOrderedItems = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    const orderAggregate = Order.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(orderId),
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
          clientId: 1,
          invoiceNumber: 1,
          total: 1,
          outstandingTotal: 1,
          orderStatus: 1,
          client: {
            clientName: 1,
          },
          adminProduct: {
            productName: 1,
            color: 1,
            size: 1,
            variety: 1,
          },
        },
      },
    ]);

    const orderItems = await (Order as any).aggregatePaginate(orderAggregate, {
      page: 1,
      limit: 10,
      customLabels: {
        docs: "orderItems",
        totalDocs: "totalOrderItems",
      },
    });

    responseHandler(
      res,
      200,
      "Orders fetched successfully",
      "success",
      orderItems
    );
  } catch (error: any) {
    console.error("Error fetching orders:", error);
    throw new InternalServerError();
  }
};

/**
 * Get all reported issues for a specific logistic order
 *
 * @param {Request} req - Express request object containing the orderId in params and pagination options in query
 * @param {Response} res - Express response object used to send the response
 * @route GET /api/logistics/:orderId/reported-issues
 * @access Private
 * @returns {Promise<void>} - A promise that resolves when the function is complete
 */

const getAllLogisticReportedIssues = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const reportedIssuesAggregate = ReportedIssue.aggregate([
      {
        $match: {
          orderId: new mongoose.Types.ObjectId(orderId),
        },
      },
      {
        $lookup: {
          from: "orderitems",
          localField: "orderItemId",
          foreignField: "_id",
          as: "orderItem",
        },
      },
      {
        $unwind: {
          path: "$orderItem",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "inventories",
          localField: "orderItem.inventoryId",
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
          issueCategory: 1,
          receivedQuantity: 1,
          proof: 1,
          additionalNotes: 1,
          productUnusable: 1,
          issue: 1,
          productCompletelyDifferent: 1,
          orderItem: {
            quantity: 1,
            price: 1,
            outstandingPrice: 1,
            deliveryDate: 1,
            adminProduct: {
              productName: 1,
              color: 1,
              size: 1,
              variety: 1,
            },
          },
        },
      },
      {
        $sort: {
          createdAt: -1,
        },
      },
    ]);

    const reportedIssues = await (ReportedIssue as any).aggregatePaginate(
      reportedIssuesAggregate,
      {
        page,
        limit,
        customLabels: {
          docs: "reportedIssues",
          totalDocs: "totalReportedIssues",
        },
      }
    );

    responseHandler(
      res,
      200,
      "Reported issues fetched successfully",
      "success",
      reportedIssues
    );
  } catch (error: any) {
    console.error("Error fetching reported issues:", error);
    throw new InternalServerError();
  }
};

export {
  getAllLogisticOrders,
  searchLogisticOrders,
  reportLogisticOrderItem,
  getAllLogisticOrderedItems,
  getAllLogisticReportedIssues,
};
