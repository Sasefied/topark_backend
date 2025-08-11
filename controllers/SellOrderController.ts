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


interface SellOrderItemInput {
  inventoryId: string;
  productCode: string;
  quantity: number;
  sellPrice: number;
}

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
        $project: {
          inventoryId: "$_id", // Return Inventory _id as inventoryId
          productCode: "$adminProduct.productCode",
          productName: "$adminProduct.productName",
          qtyInStock: 1,
          qtyIncoming: 1,
          pricePerUnit: 1,
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

const createSellOrder = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { orderItems, clientId } = req.body;
    console.log("request body", req.body);
    const session = await mongoose.startSession();
    await session.startTransaction();

    try {
      let total = 0;
      const sellOrderItems = [];

      // Validate all items first
      for (const order of orderItems) {
        const { inventoryId, productCode, quantity, sellPrice } = order;

        // 1. Verify product exists
        const product = await AdminProduct.findOne({ productCode }).session(
          session
        );
        if (!product) {
          throw new BadRequestError(`Invalid product code: ${productCode}`);
        }

        // 2. Verify inventory exists and has sufficient stock
        const inventory = await Inventory.findOne({
          _id: inventoryId,
          adminProductId: product._id,
        }).session(session);

        if (!inventory) {
          throw new BadRequestError(
            `Inventory not found for product ${productCode}`
          );
        }

        if (inventory.qtyInStock < quantity) {
          throw new BadRequestError(
            `Insufficient stock for product ${productCode}`
          );
        }

        // 3. Calculate total
        total += sellPrice * quantity;

        // 4. Prepare order item
        sellOrderItems.push({
          inventoryId,
          quantity,
          sellPrice,
        });

        // 5. Update inventory (will be committed if transaction succeeds)
        inventory.qtyInStock -= quantity;
        await inventory.save({ session });
      }

      // Create the order
      const lastOrderNumber = await SellOrder.findOne(
        {},
        { orderNumber: 1 },
        { sort: { createdAt: -1 } }
      ).session(session);

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

      // Create order items
      const sellOrderItemDocs = sellOrderItems.map((item) => ({
        ...item,
        orderId: newOrder._id,
      }));

      await SellOrderItem.insertMany(sellOrderItemDocs, { session });

      await session.commitTransaction();

      // Return the created order in response
      const createdOrder = await SellOrder.findById(newOrder._id)
        .populate("clientId", "clientName")
        .lean();

      responseHandler(
        res,
        200,
        "Order created successfully",
        "success",
        createdOrder
      );
    } catch (error) {
      await session.abortTransaction();
      next(error);
    } finally {
      await session.endSession();
    }
  }
);


// interface CreateSellOrderRequest extends Request {
//   body: {
//     orderItems: SellOrderItemInput[];
//     clientId: string;
//     shippingToday?: boolean;
//   };
//   userId?: string; 
// }

// const createSellOrder = asyncHandler(
//   async (req: CreateSellOrderRequest, res: Response, next: NextFunction): Promise<void> => {
//     const { orderItems, clientId, shippingToday } = req.body;
//     console.log("Request body:", req.body);

//     const session = await mongoose.startSession();
//     await session.startTransaction();

//     try {
//       let total = 0;
//       const sellOrderItems: any[] = [];

//       // Validate all items first
//       for (const order of orderItems) {
//         const { inventoryId, productCode, quantity, sellPrice } = order;

//         // 1. Verify product exists
//         const product = await AdminProduct.findOne({ productCode }).session(session);
//         if (!product) {
//           throw new BadRequestError(`Invalid product code: ${productCode}`);
//         }

//         // 2. Verify inventory exists and has sufficient stock
//         const inventory = await Inventory.findOne({
//           _id: inventoryId,
//           adminProductId: product._id,
//         }).session(session);

//         if (!inventory) {
//           throw new BadRequestError(`Inventory not found for product ${productCode}`);
//         }

//         if (inventory.qtyInStock < quantity) {
//           throw new BadRequestError(`Insufficient stock for product ${productCode}`);
//         }

//         // 3. Calculate total
//         total += sellPrice * quantity;

//         // 4. Prepare order item
//         sellOrderItems.push({
//           inventoryId,
//           quantity,
//           sellPrice,
//           productCode, // Include productCode in SellOrderItem
//         });

//         // 5. Update inventory (will be committed if transaction succeeds)
//         inventory.qtyInStock -= quantity;
//         await inventory.save({ session });
//       }

//       // Create the order
//       const lastOrderNumber = await SellOrder.findOne(
//         {},
//         { orderNumber: 1 },
//         { sort: { createdAt: -1 } }
//       ).session(session);

//       const newOrder: ISellOrder = (
//         await SellOrder.create(
//           [
//             {
//               userId: req.userId,
//               clientId,
//               orderNumber: (lastOrderNumber?.orderNumber || 0) + 1,
//               total,
//               outstandingTotal: total, // Initialize outstandingTotal to total
//               shippingToday: shippingToday || false, // Include shippingToday
//               orderItems: [], // Initialize empty array (populated in SellOrderItem)
//             },
//           ],
//           { session }
//         )
//       )[0];

//       // Create order items
//       const sellOrderItemDocs = sellOrderItems.map((item) => ({
//         ...item,
//         orderId: newOrder._id,
//       }));

//       await SellOrderItem.insertMany(sellOrderItemDocs, { session });

//       // Update SellOrder with orderItems references
//       newOrder.orderItems = sellOrderItemDocs.map((item) => item._id);
//       await newOrder.save({ session });

//       await session.commitTransaction();

//       // Return the created order in response
//       const createdOrder = await SellOrder.findById(newOrder._id)
//         .populate("clientId", "clientName")
//         .populate({
//           path: "orderItems",
//           populate: { path: "inventoryId", select: "productCode qtyInStock" },
//         })
//         .lean();

//       responseHandler(res, 200, "Order created successfully", "success", createdOrder);
//     } catch (error) {
//       await session.abortTransaction();
//       next(error);
//     } finally {
//       await session.endSession();
//     }
//   }
// );


const getLastSellOrder = asyncHandler(async (req: Request, res: Response) => {
  const lastOrder = await SellOrder.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(req.userId),
      },
    },
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
        userId: 1,
        clientId: 1,
        orderNumber: 1,
        total: 1,
        orderItems: {
          $map: {
            input: "$orderItems",
            as: "item",
            in: {
              inventoryId: "$$item.inventoryId",
              quantity: "$$item.quantity",
              sellPrice: "$$item.sellPrice",
              productCode: "$adminProduct.productCode",
            },
          },
        },
      },
    },
  ]);

  responseHandler(
    res,
    200,
    "Order fetched successfully",
    "success",
    lastOrder[0] || null
  );
});

const getMostReorderedOrder = asyncHandler(
  async (req: Request, res: Response) => {
    const { clientId } = req.query;

    if (
      !clientId ||
      typeof clientId !== "string" ||
      !mongoose.Types.ObjectId.isValid(clientId)
    ) {
      throw new BadRequestError("Invalid client ID");
    }

    const mostReorderedItems = await SellOrderItem.aggregate([
      {
        $match: {
          inventoryId: { $exists: true, $type: "objectId" }, // Ensure inventoryId is a valid ObjectId
        },
      },
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
          "order.clientId": new mongoose.Types.ObjectId(clientId),
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
        $match: {
          "inventory._id": { $exists: true },
          "adminProduct._id": { $exists: true },
        },
      },
      {
        $group: {
          _id: "$inventoryId",
          orderCount: { $sum: 1 },
          quantity: { $max: "$quantity" },
          sellPrice: { $max: "$sellPrice" },
          productCode: { $first: "$adminProduct.productCode" },
          inventoryId: { $first: "$inventoryId" },
        },
      },
      {
        $sort: { orderCount: -1 },
      },
      {
        $limit: 10,
      },
      {
        $project: {
          inventoryId: 1,
          productCode: 1,
          quantity: 1,
          sellPrice: 1,
          orderCount: 1,
        },
      },
    ]);

    if (!mostReorderedItems || mostReorderedItems.length === 0) {
      return responseHandler(
        res,
        200,
        "No reordered items found for this client",
        "success",
        {
          _id: null,
          userId: req.userId,
          clientId,
          orderNumber: null,
          total: 0,
          orderItems: [],
        }
      );
    }

    const total = mostReorderedItems.reduce(
      (sum, item) => sum + item.sellPrice * item.quantity,
      0
    );
    const order = {
      _id: null,
      userId: req.userId,
      clientId,
      orderNumber: null,
      total,
      orderItems: mostReorderedItems.map((item) => ({
        inventoryId: item.inventoryId,
        productCode: item.productCode || null,
        quantity: item.quantity,
        sellPrice: item.sellPrice,
      })),
    };

    responseHandler(
      res,
      200,
      "Most reordered items fetched successfully",
      "success",
      order
    );
  }
);

const getAllSellOrder = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { page = 1, limit = 10, search = '' } = req.query;

    // Build the match stage with search query
    const matchStage: any = {
      userId: new mongoose.Types.ObjectId(req.userId),
    };

    if (search) {
      matchStage.$or = [
        { 'client.clientName': { $regex: search, $options: 'i' } },
        { orderNumber: { $regex: search, $options: 'i' } },
      ];
    }

    const orderAggregate = SellOrder.aggregate([
      {
        $lookup: {
          from: 'clients',
          localField: 'clientId',
          foreignField: '_id',
          as: 'client',
        },
      },
      {
        $unwind: {
          path: '$client',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $match: matchStage,
      },
      {
        $sort: {
          createdAt: -1,
        },
      },
      {
        $project: {
          orderNumber: 1,
          total: 1,
          createdAt: 1,
          client: {
            _id: 1,
            clientName: 1,
          },
        },
      },
    ]);

    console.log('Aggregation pipeline:', JSON.stringify(orderAggregate.pipeline(), null, 2));
    const order = await (SellOrder as any).aggregatePaginate(orderAggregate, {
      page: Number(page),
      limit: Number(limit),
      customLabels: {
        docs: 'orders',
        totalDocs: 'totalOrders',
      },
    });

    console.log('Response data:', order);
    responseHandler(res, 200, 'Orders fetched successfully', 'success', order);
  }
);

const getSellOrderById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const orders = await SellOrder.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(id) } },
      {
        $lookup: {
          from: "clients",
          localField: "clientId",
          foreignField: "_id",
          as: "client",
        },
      },
      { $unwind: { path: "$client", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "sellorderitems",
          localField: "_id",
          foreignField: "orderId",
          as: "orderItems",
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
        $lookup: {
          from: "adminproducts",
          localField: "inventory.adminProductId",
          foreignField: "_id",
          as: "adminProduct",
        },
      },
      {
        $project: {
          _id: 1,
          orderNumber: 1,
          total: 1,
          createdAt: 1,
          "client._id": 1,
          "client.clientName": 1,
          orderItems: {
            $map: {
              input: "$orderItems",
              as: "item",
              in: {
                inventoryId: "$$item.inventoryId",
                quantity: "$$item.quantity",
                sellPrice: "$$item.sellPrice",
                productCode: {
                  $arrayElemAt: [
                    "$adminProduct.productCode",
                    {
                      $indexOfArray: ["$inventory._id", "$$item.inventoryId"],
                    },
                  ],
                },
              },
            },
          },
        },
      },
    ]);

    if (!orders || orders.length === 0) {
      throw new Error("Order not found");
    }

    responseHandler(
      res,
      200,
      "Order fetched successfully",
      "success",
      orders[0]
    );
  }
);

const updateSellOrder = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { id } = req.params;
    const { orders } = req.body; // Changed to orders
    console.log("Request body:", JSON.stringify(req.body, null, 2));

    const session = await mongoose.startSession();
    await session.startTransaction();

    try {
      console.log("Finding order with ID:", id);
      const existingOrder = await SellOrder.findById(id).session(session);
      if (!existingOrder) {
        throw new BadRequestError("Order not found");
      }
      console.log("Found order:", existingOrder);

      console.log("Fetching existing order items for order ID:", id);
      const existingItems = await SellOrderItem.find({ orderId: id }).session(
        session
      );
      console.log("Existing items:", existingItems);

      for (const product of orders) {
        // Changed to orders
        const { inventoryId, productCode, quantity, sellPrice } = product;
        console.log("Processing product:", product);

        console.log("Checking AdminProduct for productCode:", productCode);
        const adminProduct = await AdminProduct.findOne({
          productCode,
        }).session(session);
        if (!adminProduct) {
          throw new BadRequestError(`Invalid product code: ${productCode}`);
        }
        console.log("Found AdminProduct:", adminProduct);

        console.log("Checking Inventory for inventoryId:", inventoryId);
        const inventory = await Inventory.findOne({
          _id: inventoryId,
          adminProductId: adminProduct._id,
        }).session(session);
        if (!inventory) {
          throw new BadRequestError(
            `Inventory not found for product ${productCode}`
          );
        }
        console.log("Found Inventory:", inventory);

        const existingItem = existingItems.find(
          (item) => item.inventoryId.toString() === inventoryId
        );
        const oldQuantity = existingItem ? existingItem.quantity : 0;
        const quantityDiff = quantity - oldQuantity;
        console.log(
          `Quantity diff for inventoryId ${inventoryId}: ${quantityDiff}`
        );

        if (inventory.qtyInStock < quantityDiff) {
          throw new BadRequestError(
            `Insufficient stock for product ${productCode}. Available: ${inventory.qtyInStock}, Required: ${quantityDiff}`
          );
        }

        inventory.qtyInStock -= quantityDiff;
        await inventory.save({ session });
        console.log("Updated Inventory:", inventory);
      }

      console.log("Deleting existing order items for order ID:", id);
      await SellOrderItem.deleteMany({ orderId: id }).session(session);
      console.log("Deleted existing order items");

      const sellOrderItems = orders.map((product: any) => ({
        // Changed to orders
        orderId: id,
        inventoryId: product.inventoryId,
        productCode: product.productCode,
        quantity: product.quantity,
        sellPrice: product.sellPrice,
      }));
      console.log("New order items:", sellOrderItems);

      await SellOrderItem.insertMany(sellOrderItems, { session });
      console.log("Inserted new order items");

      const total = orders.reduce(
        // Changed to orders
        (sum: number, item: any) => sum + item.sellPrice * item.quantity,
        0
      );
      console.log("Calculated new total:", total);

      console.log("Updating order total...");
      await SellOrder.updateOne({ _id: id }, { $set: { total } }, { session });
      console.log("Updated order total");

      await session.commitTransaction();
      console.log("Transaction committed");
      responseHandler(res, 200, "Order updated successfully", "success", {
        orderId: id,
      });
    } catch (error: any) {
      console.error("Error in updateSellOrder:", error.message, error.stack);
      await session.abortTransaction();
      next(error);
    } finally {
      await session.endSession();
      console.log("Session ended");
    }
  }
);

const deleteSellOrder = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const session = await mongoose.startSession();
    await session.startTransaction();

    try {
      const order = await SellOrder.findById(id).session(session);
      if (!order) {
        throw new BadRequestError("Order not found");
      }

      // Delete all order items associated with the order
      await SellOrderItem.deleteMany({ orderId: id }).session(session);

      // Delete the order
      await SellOrder.deleteOne({ _id: id }).session(session);

      await session.commitTransaction();
      responseHandler(res, 200, "Order deleted successfully", "success");
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
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
  getAllSellOrder,
};
