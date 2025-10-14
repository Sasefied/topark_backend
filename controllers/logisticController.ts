import asyncHandler from "express-async-handler";
import { NextFunction, Request, Response } from "express";
import { responseHandler } from "../utils/responseHandler";
import Order from "../schemas/Order";
import {
  BadRequestError,
  BaseError,
  InternalServerError,
  NotFoundError,
} from "../utils/errors";
import ReportedIssue from "../schemas/ReportedIssue";
import mongoose, { Types } from "mongoose";
import { getStaticFilePath } from "../utils/helpers";
import OrderItem from "../schemas/OrderItem";
import { OrderItemStatusEnum } from "../api/constants";
import Inventory from "../schemas/Inventory";
import Client from "../schemas/ClientDetails";
import sendEmail from "../utils/mail";

const getAllLogisticOrders = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10, teamId } = req.query;
    console.log("tem", teamId);

    const orderAggregate = Order.aggregate([
      {
        $match: {
          teamId: new Types.ObjectId(teamId as string),
          // userId: new Types.ObjectId(req.userId),
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
            _id: 1,
            clientName: 1,
            clientEmail: 1,
            registeredName: 1,
            address: 1,
            clientNotes: 1,
            registeredAddress: 1,
          },
          orderItems: {
            _id: 1,
            deliveryDate: 1,
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
        docs: "logistics",
        totalDocs: "totalLogistics",
      },
    });

    responseHandler(res, 200, "Orders fetched successfully", "success", orders);
  } catch (error: any) {
    console.error("Error fetching orders:", error);
    throw new InternalServerError();
  }
};

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
            _id: 1,
            clientName: 1,
          },
          orderItems: {
            _id: 1,
            deliveryDate: 1,
          },
          adminProduct: {
            _id: 1,
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
        docs: "logistics",
        totalDocs: "totalLogistics",
      },
    });

    responseHandler(res, 200, "Orders fetched successfully", "success", orders);
  } catch (error: any) {
    console.error("Error fetching orders:", error);
    throw new InternalServerError();
  }
};




const reportLogisticOrderItem = async (req: Request, res: Response) => {
  const orderItemIdParam = req.params.orderItemId;

  const {
    clientId,
    orderId,
    issueCategory,
    receivedQuantity,
    additionalNotes,
    productUnusable,
    productUnAcceptable,
    issue,
    productCompletelyDifferent,
  } = req.body as {
    clientId?: string;
    orderId?: string;
    issueCategory?: string;
    receivedQuantity?: number | string;
    additionalNotes?: string;
    productUnusable?: boolean;
    productUnAcceptable?: boolean;
    issue?: string;
    productCompletelyDifferent?: boolean;
  };

  console.log('Request body:', JSON.stringify(req.body, null, 2));

  const session = await mongoose.startSession();
  await session.startTransaction();

  try {
    // Validate file/proof
    if (!req.file?.path || !req.file.filename) {
      throw new BadRequestError('Proof is required');
    }

    // Validate and normalize IDs
    if (!orderItemIdParam || !mongoose.Types.ObjectId.isValid(orderItemIdParam)) {
      throw new BadRequestError('Invalid orderItemId');
    }
    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      throw new BadRequestError('Invalid orderId');
    }

    // Derive clientId if not provided
    let finalClientId = clientId;
    if (!finalClientId || !mongoose.Types.ObjectId.isValid(finalClientId)) {
      const order = await Order.findById(orderId).session(session);
      if (!order) {
        throw new NotFoundError('Order not found');
      }
      finalClientId = order.clientId?.toString();
      if (!finalClientId || !mongoose.Types.ObjectId.isValid(finalClientId)) {
        throw new BadRequestError('Invalid clientId derived from order');
      }
    }

    // Validate category
    const allowedCategories = ['Quantity mismatch', 'Quality issue', 'Wrong Variety', 'Others'] as const;
    if (!issueCategory || !allowedCategories.includes(issueCategory as typeof allowedCategories[number])) {
      throw new BadRequestError('Invalid issue category');
    }

    // Normalize quantity
    const receivedQtyNum = typeof receivedQuantity === 'string' ? Number(receivedQuantity) : receivedQuantity;
    if (receivedQtyNum != null && (Number.isNaN(receivedQtyNum) || receivedQtyNum < 0)) {
      throw new BadRequestError('Invalid receivedQuantity');
    }

    const proof = getStaticFilePath(req, req.file.filename);

    const client = await Client.findById(finalClientId).session(session);
    if (!client) {
      throw new NotFoundError('Client not found');
    }

    const ISSUE_CATEGORIES = {
      'Quantity mismatch': client?.supplier?.quantityIssueEmail,
      'Quality issue': client?.supplier?.qualityIssueEmail,
      'Wrong Variety': client?.supplier?.deliveryDelayIssueEmail,
      'Others': client?.supplier?.deliveryDelayIssueEmail, // Adjust as needed
    } as const;

    const orderItemObjectId = new mongoose.Types.ObjectId(orderItemIdParam);

    // Upsert reported issue and mark order item status
    await Promise.all([
      ReportedIssue.updateOne(
        { orderItemId: orderItemObjectId },
        {
          $set: {
            orderItemId: orderItemObjectId,
            orderId,
            issueCategory,
            receivedQuantity: receivedQtyNum,
            proof,
            additionalNotes,
            productUnusable: !!productUnusable,
            productUnAcceptable: !!productUnAcceptable,
            issue,
            productCompletelyDifferent: !!productCompletelyDifferent,
          },
        },
        { upsert: true }
      ).session(session),

      OrderItem.updateOne(
        { _id: orderItemObjectId },
        { $set: { status: OrderItemStatusEnum.HAS_ISSUES } }
      ).session(session),
    ]);

    // Commit the transaction
    await session.commitTransaction();

    // Send email notification (best-effort)
    const toEmails = ISSUE_CATEGORIES[issueCategory as keyof typeof ISSUE_CATEGORIES];
    if (toEmails) {
      const recipients = Array.isArray(toEmails) ? toEmails.filter(Boolean).join(',') : toEmails;

      const html = [
        `<p>An issue has been reported for order item <strong>${orderItemIdParam}</strong>.</p>`,
        '<h4>Issue Details</h4>',
        '<ul>',
        `<li>Category: ${issueCategory}</li>`,
        receivedQtyNum != null ? `<li>Received Quantity: ${receivedQtyNum}</li>` : '',
        additionalNotes ? `<li>Additional Notes: ${additionalNotes}</li>` : '',
        `<li>Product Unusable: ${!!productUnusable}</li>`,
        `<li>Product Unacceptable: ${!!productUnAcceptable}</li>`,
        issue ? `<li>Issue Description: ${issue}</li>` : '',
        `<li>Product Completely Different: ${!!productCompletelyDifferent}</li>`,
        `</ul>`,
        `<p>Proof: <a href="${proof}" target="_blank" rel="noreferrer">${proof}</a></p>`,
      ].join('');

      await sendEmail({
        to: recipients,
        subject: `New Reported Issue: ${issueCategory}`,
        html,
        attachments: req.file?.path
          ? [
              {
                filename: (req.file as any).originalname || req.file.filename,
                path: req.file.path,
              },
            ]
          : undefined,
      });
    }

    responseHandler(res, 200, 'Issue reported successfully', 'success');
  } catch (error: any) {
    await session.abortTransaction();
    console.error('Error reporting logistic order:', error);
    throw new BadRequestError(error.message || 'Failed to report issue');
  } finally {
    await session.endSession();
  }
};




const receivedOkLogisticOrderItem = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { orderItemId } = req.params;
    const { teamId } = req.query;
    const session = await mongoose.startSession();
    await session.startTransaction();
    try {
      const orderItem = await OrderItem.findById(orderItemId).session(session);
      if (!orderItem) {
        throw new NotFoundError("Order item not found");
      }

      if (orderItem.status === OrderItemStatusEnum.RECEIVE_OK) {
        throw new BadRequestError(
          "Order item is already marked as received ok"
        );
      }

      const inventory = await Inventory.findById(orderItem.inventoryId).session(
        session
      );
      if (!inventory) {
        throw new NotFoundError("Inventory not found");
      }
      console.log("inventory", inventory);
      // const existedInventoryProduct = await Inventory.findOne({
      //   userId: req.userId,
      //   adminProductId: inventory.adminProductId,
      // });
      // console.log("existedInventoryProduct", existedInventoryProduct);
      // if (existedInventoryProduct) {
      //   await Inventory.updateOne(
      //     { _id: existedInventoryProduct._id },
      //     {
      //       $inc: {
      //         qtyInStock: orderItem.quantity,
      //         qtyIncoming: orderItem.quantity,
      //       },
      //       $set: {
      //         pricePerUnit: orderItem.price,
      //         sourceCountry: inventory.sourceCountry,
      //         ccy: inventory.ccy,
      //         buyingPrice: orderItem.price,
      //         tradingPrice: orderItem.price,
      //       },
      //     }
      //   ).session(session);
      // } else {

      // }

      await Inventory.create(
        [
          {
            userId: req.userId,
            clientId: inventory.clientId,
            adminProductId: inventory.adminProductId,
            orderItemId: orderItem._id,
            teamId: teamId,
            // grade: inventory.,
            pricePerUnit: orderItem.price,
            qtyInStock: orderItem.quantity,
            qtyIncoming: orderItem.quantity,
            sourceCountry: inventory.countryOfOrigin,
            // ccy: inventory.ccy,
            buyingPrice: orderItem.price,
            tradingPrice: orderItem.price,
            countryOfOrigin: inventory.countryOfOrigin,
            shelfLife: inventory.shelfLife,
            sellBy: inventory.sellBy,
            size: inventory.size,
          },
        ],
        { session }
      );

      await OrderItem.updateOne(
        { _id: orderItemId },
        {
          $set: {
            status: OrderItemStatusEnum.RECEIVE_OK,
          },
        }
      ).session(session);

      await Order.updateOne(
        { _id: orderItem.orderId },
        {
          $set: {
            orderStatus: "Delivered",
          },
        }
      ).session(session);

      await session.commitTransaction();

      responseHandler(res, 200, "Order item marked as received ok", "success");
    } catch (error: any) {
      console.error("Error marking order item as received ok:", error);
      await session.abortTransaction();
      next(error);
    } finally {
      await session.endSession();
    }
  }
);


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
            _id: 1,
            clientName: 1,
          },
          orderItems: {
            _id: 1,
            quantity: 1,
            price: 1,
            outstandingPrice: 1,
            deliveryDate: 1,
            status: 1,
          },
          adminProduct: {
            _id: 1,
            productName: 1,
            color: 1,
            size: 1,
            variety: 1,
            productCode: 1,
            productAlias: 1,
            comments: 1,
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
          },
          adminProduct: {
            _id: 1,
            productName: 1,
            color: 1,
            size: 1,
            variety: 1,
            productCode: 1,
            productAlias: 1,
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
  receivedOkLogisticOrderItem,
};
