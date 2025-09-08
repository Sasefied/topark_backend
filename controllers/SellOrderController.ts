import asyncHandler from "express-async-handler";
import { NextFunction, Request, Response } from "express";
import Client from "../schemas/ClientDetails";
import { responseHandler } from "../utils/responseHandler";
import { AdminProduct } from "../schemas/AdminProduct";
import { BadRequestError } from "../utils/errors";
import SellOrder, { ISellOrder } from "../schemas/SellOrder";
import SellOrderItem from "../schemas/SellOrderItem";
import mongoose, { Types } from "mongoose";
import Inventory from "../schemas/Inventory";


interface PopulatedClient {
  _id: string;
  clientName: string;
}

interface LeanSellOrder extends Omit<ISellOrder, "clientId"> {
  _id: string;
  clientId: string;
  client?: PopulatedClient;
}

const updateSellOrder = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { id } = req.params;
    const { orders } = req.body; // Array of { inventoryId, productCode, quantity, sellPrice }
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

      // Step 1: Restore inventory for ALL existing items (add back quantities)
      for (const existingItem of existingItems) {
        const inventory = await Inventory.findById(
          existingItem.inventoryId
        ).session(session);
        if (inventory) {
          inventory.qtyInStock += existingItem.quantity;
          await inventory.save({ session });
          console.log(
            `Restored ${existingItem.quantity} to inventory ${existingItem.inventoryId}`
          );
        } else {
          console.warn(
            `Inventory not found for existing item ${existingItem.inventoryId} during restore`
          );
        }
      }

      // Step 2: Validate new/updated items (without stock check)
      let total = 0;
      for (const product of orders) {
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

        // Accumulate total
        total += sellPrice * quantity;
      }

      // Step 3: Delete existing order items
      console.log("Deleting existing order items for order ID:", id);
      await SellOrderItem.deleteMany({ orderId: id }).session(session);
      console.log("Deleted existing order items");

      // Step 4: Insert new order items
      const sellOrderItems = orders.map((product: any) => ({
        orderId: id,
        inventoryId: product.inventoryId,
        quantity: product.quantity,
        sellPrice: product.sellPrice,
      }));
      console.log("New order items:", sellOrderItems);

      await SellOrderItem.insertMany(sellOrderItems, { session });
      console.log("Inserted new order items");

      // Step 5: Update order total
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

// Other functions (unchanged)
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
          inventoryId: "$_id",
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



// const createSellOrder = asyncHandler(
//   async (req: Request, res: Response, next: NextFunction): Promise<void> => {
//     const { orderItems, clientId, shipToday } = req.body;
//     console.log("Request body:", JSON.stringify(req.body, null, 2));

//     const session = await mongoose.startSession();
//     await session.startTransaction();

//     try {
//       let total = 0;
//       const sellOrderItems = [];

//       // Validate all items and prepare order items
//       for (const order of orderItems) {
//         const { inventoryId, productCode, quantity, sellPrice } = order;

//         // 1. Verify product exists
//         const product = await AdminProduct.findOne({ productCode }).session(session);
//         if (!product) {
//           throw new BadRequestError(`Invalid product code: ${productCode}`);
//         }

//         // 2. Verify inventory exists
//         const inventory = await Inventory.findOne({
//           _id: inventoryId,
//           adminProductId: product._id,
//         }).session(session);

//         if (!inventory) {
//           throw new BadRequestError(`Inventory not found for product ${productCode}`);
//         }

//         // 3. Calculate total
//         total += sellPrice * quantity;

//         // 4. Prepare order item
//         sellOrderItems.push({
//           inventoryId,
//           quantity,
//           sellPrice,
//         });

//         // 5. Update inventory (allow negative stock)
//         inventory.qtyInStock -= quantity;
//         await inventory.save({ session });
//         if (inventory.qtyInStock < 0) {
//           console.warn(
//             `Inventory for ${productCode} is now negative: ${inventory.qtyInStock}`
//           );
//           // Optionally, flag the order for review or log for backorder
//         }
//       }

//       // Check for negative stock
//       let hasNegativeStock = false;
//       for (const item of sellOrderItems) {
//         const inventory = await Inventory.findById(item.inventoryId).session(session);
//         if (inventory && inventory.qtyInStock < 0) {
//           hasNegativeStock = true;
//           break;
//         }
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
//               shipToday,
//               hasNegativeStock,
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

//       await session.commitTransaction();

//       const createdOrder = await SellOrder.findById(newOrder._id)
//         .populate("clientId", "clientName")
//         .lean();

//       responseHandler(
//         res,
//         200,
//         "Order created successfully",
//         "success",
//         createdOrder
//       );
//     } catch (error) {
//       console.error("Error in createSellOrder:", error);
//       await session.abortTransaction();
//       next(error);
//     } finally {
//       await session.endSession();
//       console.log("Session ended");
//     }
//   }
// );

const createSellOrder = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { orderItems, clientId, shipToday } = req.body;
    console.log("request body", req.body);
    const session = await mongoose.startSession();
    await session.startTransaction();

    try {
      let total = 0;
      const sellOrderItems: any[] = [];

      // Validate all items
      for (const order of orderItems) {
        const { inventoryId, productCode, quantity, sellPrice } = order;

        // 1. Verify product exists
        const product = await AdminProduct.findOne({ productCode }).session(
          session
        );
        if (!product) {
          throw new BadRequestError(`Invalid product code: ${productCode}`);

        const inventory = await Inventory.findOne({
          _id: inventoryId,
          adminProductId: product._id,
        }).session(session);

        if (!inventory) {
          throw new BadRequestError(
            `Inventory not found for product ${productCode}`
          );
        }

        // 3. Calculate total
        total += sellPrice * quantity;

        sellOrderItems.push({
          inventoryId,
          quantity,
          sellPrice,
          productName: product.productName,
        });

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
              outstandingTotal: total,
              shipToday,
              // Optionally, add a flag for orders with negative stock
              hasNegativeStock: sellOrderItems.some(async (item) => {
                const inventory = await Inventory.findById(
                  item.inventoryId
                ).session(session);
                return inventory && inventory.qtyInStock < 0;
              }),
            },
          ],
          { session }
        )
      )[0];

      const sellOrderItemDocs = sellOrderItems.map((item) => ({
        ...item,
        orderId: newOrder.id,
        status: OrderStatusEnum.ORDER_PRINTED, // Set order item status to ORDER_PRINTED
      }));
      await SellOrderItem.insertMany(sellOrderItemDocs, { session });

      await session.commitTransaction();

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
      console.error("Error in createSellOrder:", error);
      await session.abortTransaction();
      next(error);
    } finally {
      await session.endSession();
      console.log("Session ended");
    }
  }
);

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
          inventoryId: { $exists: true, $type: "objectId" },
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
    const { page = "1", limit = "10", search = "" } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);

    try {
      const query: any = {};
      if (search) {
        // Convert orderNumber to string for regex matching
        query.$or = [
          {
            $expr: {
              $regexMatch: {
                input: { $toString: "$orderNumber" },
                regex: search,
                options: "i",
              },
            },
          },
          { "client.clientName": { $regex: search, $options: "i" } },
        ];
      }

      const aggregate = SellOrder.aggregate([
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
        { $unwind: { path: "$client", preserveNullAndEmptyArrays: true } },
        { $match: query },
        { $sort: { createdAt: -1 } },
      ]);

      const options = {
        page: pageNum,
        limit: limitNum,
        lean: true,
      };

      const result = await (SellOrder as any).aggregatePaginate(
        aggregate,
        options
      );

      const orders: LeanSellOrder[] = result.docs.map((doc: any) => ({
        _id: doc._id.toString(),
        userId: doc.userId.toString(),
        clientId: doc.clientId.toString(),
        client: doc.client
          ? {
              _id: doc.client._id.toString(),
              clientName: doc.client.clientName,
            }
          : undefined,
        orderNumber: doc.orderNumber,
        total: doc.total,
        shipToday: doc.shipToday,
        status: doc.status,
        createdAt: doc.createdAt,
      }));

      responseHandler(res, 200, "Orders fetched successfully", "success", {
        orders,
        totalPages: result.totalPages,
        currentPage: result.page,
        totalOrders: result.totalDocs,
      });
    } catch (error) {
      console.error("Error fetching orders:", error);
      throw new Error("Failed to fetch orders");
    }
  }
);


const getSellOrderById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    console.log(`Fetching order by ID: ${id}`);

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
        $addFields: {
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
      {
        $project: {
          _id: 1,
          orderNumber: 1,
          total: 1,
          createdAt: 1,
          "client._id": 1,
          "client.clientName": 1,
          orderItems: 1,
        },
      },
    ]);

    if (!orders || orders.length === 0) {
      console.warn(`Order not found for ID: ${id}`);
      throw new BadRequestError("Order not found");
    }

    console.log(
      "getSellOrderById response:",
      JSON.stringify(orders[0], null, 2)
    );
    responseHandler(
      res,
      200,
      "Order fetched successfully",
      "success",
      orders[0]
    );
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
