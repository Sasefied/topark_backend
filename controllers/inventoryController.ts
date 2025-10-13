import { Request, RequestHandler, Response } from "express";
import mongoose, { Types, PipelineStage } from "mongoose";
import Inventory from "../schemas/Inventory";
import { AdminProduct } from "../schemas/AdminProduct";
import { responseHandler } from "../utils/responseHandler";
import Order from "../schemas/Order";
import asyncHandler from "express-async-handler";
import Client from "../schemas/ClientDetails";
import { BadRequestError } from "../utils/errors";
import Team from "../schemas/Team";

const getAllInventories: RequestHandler = async (req, res) => {
  try {
    const { page, limit, search, teamId } = req.query;

    if (!req.userId || !mongoose.Types.ObjectId.isValid(req.userId)) {
      return res.status(401).json({ message: "Invalid or missing userId" });
    }

    // Normalize and validate query params
    const pageStr = Array.isArray(page) ? page[0] : page;
    const limitStr = Array.isArray(limit) ? limit[0] : limit;
    const searchStr = Array.isArray(search) ? search[0] : search;
    const teamIdStr = Array.isArray(teamId) ? teamId[0] : teamId;

    if (typeof teamIdStr !== "string" || !Types.ObjectId.isValid(teamIdStr)) {
      return res.status(400).json({ message: "Invalid or missing teamId" });
    }

    const pageNumber = (() => {
      const n = typeof pageStr === "string" ? parseInt(pageStr, 10) : 1;
      return Number.isFinite(n) && n > 0 ? n : 1;
    })();

    const limitNumber = (() => {
      const n = typeof limitStr === "string" ? parseInt(limitStr, 10) : 10;
      return Number.isFinite(n) && n > 0 ? n : 10;
    })();

    const searchTerm = typeof searchStr === "string" ? searchStr : "";

    const teamObjectId = new Types.ObjectId(teamIdStr);

    // Build the aggregation stages dynamically for optimization
    const stages: PipelineStage[] = [
      {
        $match: {
          teamId: { $eq: teamObjectId },
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
    ];

    // Add search match after adminProduct lookup if search is provided
    if (searchTerm) {
      stages.push({
        $match: {
          "adminProduct.productName": {
            $regex: searchTerm,
            $options: "i",
          },
        },
      } as PipelineStage);
    }

    // Continue with other stages
    stages.push(
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
        $addFields: {
          clientName: "$client.name",
        },
      },
      {
        $lookup: {
          from: "users",
          let: {
            supplierUserId: { $arrayElemAt: ["$client.client.userId", 0] },
          },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$_id", "$$supplierUserId"] },
              },
            },
            {
              $project: {
                _id: 1,
                firstName: 1,
                lastName: 1,
              },
            },
          ],
          as: "supplierUser",
        },
      },
      {
        $addFields: {
          supplierName: {
            $cond: {
              if: { $gt: [{ $size: "$supplierUser" }, 0] },
              then: {
                $concat: [
                  { $arrayElemAt: ["$supplierUser.firstName", 0] },
                  " ",
                  { $arrayElemAt: ["$supplierUser.lastName", 0] },
                ],
              },
              else: null,
            },
          },
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
        $addFields: {
          outstandingPrice: {
            $ifNull: ["$orderItem.outstandingPrice", 0],
          },
        },
      },
      {
        $project: {
          client: 0,
          supplierUser: 0,
        },
      }
    );

    const inventoryAggregate = Inventory.aggregate(stages);

    const inventories = await (Inventory as any).aggregatePaginate(
      inventoryAggregate,
      {
        page: pageNumber,
        limit: limitNumber,
        customLabels: {
          docs: "inventories",
          totalDocs: "totalInventories",
        },
      }
    );

    console.log("Fetched inventories:", JSON.stringify(inventories, null, 2));
    res.status(200).json(inventories);
  } catch (error: any) {
    console.error("Error fetching inventories:", error.message, error.stack);
    res
      .status(500)
      .json({ message: "Error fetching inventories", error: error.message });
  }
};

const getAllProductNames: RequestHandler = async (req, res) => {
  try {
    const products = await AdminProduct.find().select(
      "_id productName productCode"
    );
    const productNames = products.map((product) => ({
      id: product.id.toString(),
      name: product.productName,
    }));
    res.status(200).json(productNames);
  } catch (error: any) {
    console.error("Error fetching product names:", error.message, error.stack);
    res
      .status(500)
      .json({ message: "Error fetching product names", error: error.message });
  }
};

const getProductById: RequestHandler = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      res.status(400).json({ message: "Invalid product ID format" });
      return;
    }

    const product = await AdminProduct.findById(productId);
    if (!product) {
      res.status(404).json({ message: "Product not found" });
      return;
    }
    res.status(200).json(product);
  } catch (error: any) {
    console.error("Error fetching product:", error.message, error.stack);
    res
      .status(500)
      .json({ message: "Error fetching product", error: error.message });
  }
};

const getDeliveredOrders: RequestHandler = async (req, res) => {
  try {
    if (!req.userId || !Types.ObjectId.isValid(req.userId)) {
      return responseHandler(res, 401, "Invalid or missing userId", "error");
    }

    const orderAggregate = Order.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(req.userId),
          orderStatus: "Delivered",
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
        $lookup: {
          from: "inventories",
          localField: "orderItems.inventoryId",
          foreignField: "_id",
          as: "inventory",
        },
      },
      {
        $lookup: {
          from: "clients",
          localField: "inventory.clientId",
          foreignField: "_id",
          as: "clientDetails",
        },
      },
      {
        $lookup: {
          from: "adminproducts",
          localField: "inventory.adminProductId",
          foreignField: "_id",
          as: "adminProducts",
        },
      },

      {
        $set: {
          clientDetails: {
            $cond: {
              if: { $eq: ["$clientDetails", []] },
              then: [{ clientName: "Unknown Supplier" }],
              else: "$clientDetails",
            },
          },
          adminProducts: {
            $cond: {
              if: { $eq: ["$adminProducts", []] },
              then: [
                { productName: "Unknown Product", size: "N/A", color: "N/A" },
              ],
              else: "$adminProducts",
            },
          },
        },
      },
      {
        $unwind: { path: "$clientDetails", preserveNullAndEmptyArrays: true },
      },
      {
        $unwind: { path: "$adminProducts", preserveNullAndEmptyArrays: true },
      },
      {
        $project: {
          _id: 1,
          inventoryId: { $first: "$inventory._id" },
          invoiceNumber: 1,
          orderStatus: 1,
          total: 1,
          orderItems: 1,
          tradingPrice: { $first: "$inventory.tradingPrice" },
          clientDetails: { clientName: 1 },
          adminProducts: { productName: 1, size: 1, color: 1 },
          inventory: { ccy: 1, sourceCountry: 1, grade: 1 },
        },
      },
    ]);

    const deliveredOrders = await (Order as any).aggregatePaginate(
      orderAggregate,
      {
        customLabels: {
          docs: "orders",
          totalDocs: "totalOrders",
        },
      }
    );

    // Ensure orderItems is always an array
    deliveredOrders.orders = deliveredOrders.orders.map((order: any) => ({
      ...order,
      orderItems: Array.isArray(order.orderItems)
        ? order.orderItems
        : [order.orderItems],
    }));

    responseHandler(
      res,
      200,
      "Delivered orders fetched successfully",
      "success",
      deliveredOrders
    );
  } catch (error: any) {
    console.error("Error fetching delivered orders:", {
      message: error.message,
      stack: error.stack,
      userId: req.userId,
    });
    responseHandler(
      res,
      500,
      error.message || "Failed to fetch delivered orders",
      "error"
    );
  }
};

const updateTradingPrice = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { tradingPrice } = req.body;

  await Inventory.updateOne(
    { _id: id },
    {
      tradingPrice,
    }
  );

  responseHandler(res, 200, "Trading price updated successfully", "success");
});

const addStockOnInventory: RequestHandler = async (req, res) => {
  try {
    const {
      userId,
      clientId,
      teamId, // Add this
      adminProductId,
      size,
      color,
      vat,
      sellBy,
      sellByQuantity,
      shelfLife,
      season,
      countryOfOrigin,
      variety,
    } = req.body;
    
    console.log("teamId", teamId)

    // Validate teamId
    if (!teamId || !mongoose.Types.ObjectId.isValid(teamId)) {
      return res.status(400).json({ message: "Valid teamId is required" });
    }

    // Validate userId
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Valid userId is required" });
    }

    // Validate ObjectId fields
    if (!mongoose.Types.ObjectId.isValid(adminProductId)) {
      return res.status(400).json({ message: "Invalid adminProductId format" });
    }

    // Validate referenced documents
    const product = await AdminProduct.findById(adminProductId);
    if (!product) {
      return res.status(400).json({ message: "Product not found" });
    }

    // Validate team exists
    const team = await Team.findById(teamId); // Assuming you have a Team model
    if (!team) {
      return res.status(400).json({ message: "Team not found" });
    }

    // Validate client if clientId is provided
    let client = null;
    if (clientId) {
      if (!mongoose.Types.ObjectId.isValid(clientId)) {
        return res.status(400).json({ message: "Invalid clientId format" });
      }
      client = await Client.findById(clientId);
      if (!client) {
        return res.status(400).json({ message: "Client not found" });
      }
    }

    // Validate season
    const validMonths = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    if (
      !Array.isArray(season) ||
      !season.every((m: string) => validMonths.includes(m))
    ) {
      return res.status(400).json({
        message: "Invalid season format. Must be an array of valid months.",
      });
    }

    // Validate sellBy
    const validSellByTypes = [
      "Box", "Kg", "Unit", "Dozen", "Liter", "Packet", 
      "Gram", "Pound", "Ounce", "Milliliter",
    ];
    if (!validSellByTypes.includes(sellBy)) {
      return res.status(400).json({
        message: `Invalid sellBy. Must be one of: ${validSellByTypes.join(", ")}`,
      });
    }

    // Validate size and color against AdminProduct
    if (size !== product.size) {
      return res.status(400).json({
        message: `Size "${size}" does not match product's size "${product.size}"`,
      });
    }
    if (color && product.color && color !== product.color) {
      return res.status(400).json({
        message: `Color "${color}" does not match product's color "${product.color}"`,
      });
    }

    // Validate vat
    if (vat !== undefined && (isNaN(parseFloat(vat as any)) || parseFloat(vat as any) < 0)) {
      return res
        .status(400)
        .json({ message: "VAT must be a non-negative number" });
    }

    // Create inventory entry - NOW INCLUDING teamId
    const inventoryEntry = await Inventory.create({
      userId,
      teamId, // Add this
      clientId,
      adminProductId,
      size,
      color: color || null,
      vat: vat !== undefined ? parseFloat(vat.toString()) : undefined,
      sellBy,
      shelfLife,
      season,
      countryOfOrigin,
      variety,
      sellByQuantity,
    });

    // Update client's inventoryIds if clientId is provided
    if (clientId && client) {
      await Client.findByIdAndUpdate(
        clientId,
        { $addToSet: { inventoryIds: inventoryEntry._id } },
        { new: true }
      );
    }

    return res.status(201).json({
      message: "Stock added to inventory and associated with team successfully",
      inventory: inventoryEntry,
    });
  } catch (error: any) {
    console.error(
      "Error adding stock to inventory:",
      error.message,
      error.stack
    );
    return res
      .status(500)
      .json({ message: error.message || "Error adding stock to inventory" });
  }
};
const deleteInventoryById = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestError("Invalid inventory ID format");
    }

    const inventory = await Inventory.findById(id);
    if (!inventory) {
      throw new BadRequestError("Inventory not found");
    }

    await Inventory.findByIdAndDelete(id);
    responseHandler(res, 200, "Inventory deleted successfully", "success");
  }
);

// Updated Backend Controllers
// Updated Backend Controller for updateInventoryById
const updateInventoryById = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestError("Invalid inventory ID format");
    }

    const {
      userId,
      clientId,
      adminProductId,
      size,
      color,
      vat,
      sellBy,
      sellByQuantity,
      shelfLife,
      season,
      countryOfOrigin,
      variety,
      productType,
      productAlias,
    } = req.body;

    // Validate ObjectId fields
    if (!mongoose.Types.ObjectId.isValid(adminProductId)) {
      throw new BadRequestError("Invalid adminProductId format");
    }
    // if (clientId && !mongoose.Types.ObjectId.isValid(clientId)) {
    //   throw new BadRequestError("Invalid clientId format");
    // }

    // Validate referenced documents
    const product = await AdminProduct.findById(adminProductId);
    if (!product) {
      throw new BadRequestError("Product not found");
    }

    // Update product fields if provided
    if (productType !== undefined) {
      product.productType = productType;
    }
    if (productAlias !== undefined) {
      product.productAlias = productAlias;
    }
    await product.save();

    // Validate client if clientId is provided
    let client = null;
    if (clientId) {
      client = await Client.findById(clientId);
      if (!client) {
        throw new BadRequestError("Client not found");
      }
    }

    // Validate season
    const validMonths = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    if (
      !Array.isArray(season) ||
      !season.every((m: string) => validMonths.includes(m))
    ) {
      throw new BadRequestError(
        "Invalid season format. Must be an array of valid months."
      );
    }

    // Validate sellBy
    const validSellByTypes = [
      "Box",
      "Kg",
      "Unit",
      "Dozen",
      "Liter",
      "Packet",
      "Gram",
      "Pound",
      "Ounce",
      "Milliliter",
    ];
    if (!validSellByTypes.includes(sellBy)) {
      throw new BadRequestError(
        `Invalid sellBy. Must be one of: ${validSellByTypes.join(", ")}`
      );
    }

    // Validate size and color against AdminProduct
    if (size !== product.size) {
      throw new BadRequestError(
        `Size "${size}" does not match product's size "${product.size}"`
      );
    }
    if (color && product.color && color !== product.color) {
      throw new BadRequestError(
        `Color "${color}" does not match product's color "${product.color}"`
      );
    }

    // Validate vat
    if (
      vat !== undefined &&
      (isNaN(parseFloat(vat as any)) || parseFloat(vat as any) < 0)
    ) {
      throw new BadRequestError("VAT must be a non-negative number");
    }

    const inventory = await Inventory.findById(id);
    if (!inventory) {
      throw new BadRequestError("Inventory not found");
    }

    inventory.userId = userId;
    inventory.clientId = clientId;
    inventory.adminProductId = adminProductId;
    inventory.size = size;
    inventory.color = color || null;
    inventory.vat = vat !== undefined ? parseFloat(vat as any) : undefined;
    inventory.sellBy = sellBy;
    inventory.sellByQuantity = sellByQuantity;
    inventory.shelfLife = shelfLife;
    inventory.season = season;
    inventory.countryOfOrigin = countryOfOrigin;
    inventory.variety = variety;
    await inventory.save();

    // Repopulate after save
    const populatedInventory = await Inventory.findById(id).populate({
      path: "adminProductId",
      select: "productName productAlias productType productCode variety",
    });

    responseHandler(res, 200, "Inventory updated successfully", "success", {
      inventory: populatedInventory,
    });
  }
);

const getInventoryById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new BadRequestError("Invalid inventory ID format");
  }

  const inventory = await Inventory.findById(id).populate({
    path: "adminProductId",
    select: "productName productAlias productType productCode variety",
  });
  if (!inventory) {
    throw new BadRequestError("Inventory not found");
  }
  responseHandler(res, 200, "Inventory found successfully", "success", {
    inventory,
  });
});

export {
  getAllInventories,
  addStockOnInventory,
  getAllProductNames,
  getProductById,
  getDeliveredOrders,
  updateTradingPrice,
  deleteInventoryById,
  updateInventoryById,
  getInventoryById,
};
