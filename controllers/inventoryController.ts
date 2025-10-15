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
import OrderItem from "../schemas/OrderItem";
//code by saif
// const getAllInventories: RequestHandler = async (req, res) => {
//   try {
//     const { page = 1, limit = 10, search, teamId, status } = req.query;

//     if (!req.userId || !mongoose.Types.ObjectId.isValid(req.userId)) {
//       return res.status(401).json({ message: "Invalid or missing userId" });
//     }

//     if (typeof teamId !== "string" || !Types.ObjectId.isValid(teamId)) {
//       return res.status(400).json({ message: "Invalid or missing teamId" });
//     }

//     const pageNumber = parseInt(page as string) || 1;
//     const limitNumber = parseInt(limit as string) || 10;
//     const searchTerm = search as string || "";
//     const statusFilter = status === 'before' || status === 'after' ? status : 'all';
//     const teamObjectId = new Types.ObjectId(teamId);

//     const orderAggregate = Order.aggregate([
//       { $match: { teamId: teamObjectId } },
//       { $lookup: { from: "orderitems", localField: "_id", foreignField: "orderId", as: "orderItems" } },
//       { $unwind: { path: "$orderItems", preserveNullAndEmptyArrays: true } },
      
//       // 🚀 Inventory lookup
//       { 
//         $lookup: { 
//           from: "inventories", 
//           localField: "orderItems._id", 
//           foreignField: "orderItemId", 
//           as: "inventory" 
//         } 
//       },
//       { $unwind: { path: "$inventory", preserveNullAndEmptyArrays: true } },
      
//       // 🚀 FIXED: AdminProduct lookup - PRIORITY: inventory FIRST, then orderItem
//       { 
//         $lookup: { 
//           from: "adminproducts", 
//           let: { 
//             inventoryId: "$inventory.adminProductId",  // ✅ PRIORITY 1
//             orderItemId: "$orderItems.adminProductId"  // ✅ PRIORITY 2
//           },
//           pipeline: [
//             {
//               $match: {
//                 $expr: {
//                   $or: [
//                     // ✅ TRY INVENTORY FIRST
//                     {
//                       $and: [
//                         { $ne: ["$$inventoryId", null] },
//                         { $ne: ["$$inventoryId", ""] },
//                         { $eq: ["$_id", { $toObjectId: "$$inventoryId" }] }
//                       ]
//                     },
//                     // ✅ THEN ORDERITEM
//                     {
//                       $and: [
//                         { $ne: ["$$orderItemId", null] },
//                         { $ne: ["$$orderItemId", ""] },
//                         { $eq: ["$_id", { $toObjectId: "$$orderItemId" }] }
//                       ]
//                     }
//                   ]
//                 }
//               }
//             }
//           ],
//           as: "adminProduct" 
//         } 
//       },
//       { $unwind: { path: "$adminProduct", preserveNullAndEmptyArrays: true } },
      
//       // 🚀 CREATE FULL INVENTORY IF MISSING (YOUR ORIGINAL LOGIC - UNCHANGED)
//       {
//         $addFields: {
//           inventory: {
//             $cond: {
//               if: { $eq: ["$inventory", null] },
//               then: {
//                 _id: new Types.ObjectId(),
//                 userId: req.userId,
//                 adminProductId: "$orderItems.adminProductId",
//                 clientId: "$clientId",
//                 orderItemId: "$orderItems._id",
//                 teamId: "$teamId",
//                 size: { $ifNull: ["$adminProduct.size", "Small"] },
//                 color: { $ifNull: ["$adminProduct.color", null] },
//                 vat: null,
//                 sellBy: { $ifNull: ["$adminProduct.sellBy", "Kg"] },
//                 sellByQuantity: "",
//                 shelfLife: { $ifNull: ["$adminProduct.shelfLife", "6"] },
//                 season: { $ifNull: ["$adminProduct.season", []] },
//                 countryOfOrigin: { $ifNull: ["$adminProduct.countryOfOrigin", "USA"] },
//                 qtyInStock: 0,
//                 qtyIncoming: {
//                   $cond: [
//                     { $eq: ["$orderStatus", "Delivered"] },
//                     0,
//                     "$orderItems.quantity"
//                   ]
//                 },
//                 variety: { $ifNull: ["$adminProduct.variety", null] }, // ✅ FIXED: Uses adminProduct
//                 supplierName: { $ifNull: ["$adminProduct.supplierName", "Default Supplier"] },
//                 createdAt: "$$NOW",
//                 updatedAt: "$$NOW"
//               },
//               else: "$inventory" // ✅ Keep existing inventory AS-IS
//             }
//           }
//         }
//       },
      
//       // 🔍 FILTERS (UNCHANGED)
//       ...(searchTerm ? [{ $match: { 
//         $or: [
//           { "adminProduct.productName": { $regex: searchTerm, $options: "i" } },
//           { "orderItems.adminProductId": { $regex: searchTerm, $options: "i" } }
//         ]
//       } }] : []),
//       ...(statusFilter !== 'all' ? [{
//         $match: {
//           $expr: {
//             $cond: [
//               { $eq: ["$orderStatus", "Delivered"] },
//               { $eq: [statusFilter, "after"] },
//               { $eq: [statusFilter, "before"] }
//             ]
//           }
//         }
//       }] : []),
      
//       // ✅ YOUR ORIGINAL PROJECTION (ONLY 2 LINES FIXED)
//       {
//         $project: {
//           _id: { $ifNull: ["$inventory._id", new Types.ObjectId()] },
//           userId: { $ifNull: ["$inventory.userId", req.userId] },
//           clientId: "$clientId",
//           orderItemId: "$orderItems._id",
//           teamId: { $ifNull: ["$inventory.teamId", "$teamId"] },
//           size: { $ifNull: ["$inventory.size", "$adminProduct.size", "Small"] },
//           color: { $ifNull: ["$inventory.color", "$adminProduct.color", null] },
//           vat: { $ifNull: ["$inventory.vat", null] },
//           sellBy: { $ifNull: ["$inventory.sellBy", "$adminProduct.sellBy", "Kg"] },
//           sellByQuantity: { $ifNull: ["$inventory.sellByQuantity", ""] },
//           shelfLife: { $ifNull: ["$inventory.shelfLife", "$adminProduct.shelfLife", "6"] },
//           season: { $ifNull: ["$inventory.season", "$adminProduct.season", []] },
//           countryOfOrigin: { $ifNull: ["$inventory.countryOfOrigin", "$adminProduct.countryOfOrigin", "USA"] },
//           qtyInStock: { $ifNull: ["$inventory.qtyInStock", 0] },
//           qtyIncoming: {
//             $cond: [
//               { $eq: ["$orderStatus", "Delivered"] },
//               0,
//               { $ifNull: ["$inventory.qtyIncoming", "$orderItems.quantity"] }
//             ]
//           },
//           variety: { 
//             $ifNull: ["$inventory.variety", "$adminProduct.variety", null] 
//           }, // ✅ FIXED #1: Add adminProduct fallback
//           createdAt: { $ifNull: ["$inventory.createdAt", "$$NOW"] },
//           updatedAt: { $ifNull: ["$inventory.updatedAt", "$$NOW"] },
          
//           // ✅ FIXED #2: AdminProduct OUTSIDE inventory
//           adminProduct: {
//             _id: { $ifNull: ["$adminProduct._id", null] }, // ✅ NOT from orderItems
//             productName: { $ifNull: ["$adminProduct.productName", "Unknown Product"] },
//             productAlias: { $ifNull: ["$adminProduct.productAlias", ""] },
//             productCode: { $ifNull: ["$adminProduct.productCode", "N/A"] },
//             variety: { $ifNull: ["$adminProduct.variety", null] },
//             size: { $ifNull: ["$adminProduct.size", "Small"] },
//             color: { $ifNull: ["$adminProduct.color", null] },
//             productType: { $ifNull: ["$adminProduct.productType", ""] },
//             supplierName: { $ifNull: ["$adminProduct.supplierName", ""] },
//             comments: { $ifNull: ["$adminProduct.comments", ""] },
//             createdAt: { $ifNull: ["$adminProduct.createdAt", "$$NOW"] },
//             updatedAt: { $ifNull: ["$adminProduct.updatedAt", "$$NOW"] },
//           },
          
//           supplierName: { 
//             $ifNull: ["$inventory.supplierName", ""] 
//           },
          
//           orderItem: {
//             _id: "$orderItems._id",
//             orderId: "$orderItems.orderId",
//             inventoryId: "$orderItems.inventoryId",
//             quantity: "$orderItems.quantity",
//             price: "$orderItems.price",
//             outstandingPrice: "$orderItems.outstandingPrice",
//             deliveryDate: "$orderItems.deliveryDate",
//             extraCostPrice: "$orderItems.extraCostPrice",
//             status: "$orderItems.status",
//             createdAt: "$orderItems.createdAt",
//             updatedAt: "$orderItems.updatedAt",
//           },
//           outstandingPrice: "$orderItems.outstandingPrice"
//         }
//       }
//     ]);

//     const inventories = await (Order as any).aggregatePaginate(orderAggregate, {
//       page: pageNumber,
//       limit: limitNumber,
//       customLabels: { docs: "inventories", totalDocs: "totalInventories" },
//     });

//     res.status(200).json({
//       status: "success",
//       message: "Orders fetched successfully",
//       data: inventories
//     });

//   } catch (error: any) {
//     console.error("Error fetching inventories:", error.message);
//     res.status(500).json({ status: "error", message: "Error fetching inventories", error: error.message });
//   }
// };



// code by ansh of inventory
const getAllInventories: RequestHandler = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", teamId } = req.query;

    // Validate user
    if (!req.userId || !mongoose.Types.ObjectId.isValid(req.userId)) {
      return res.status(401).json({ message: "Invalid or missing userId" });
    }

    if (!teamId || typeof teamId !== "string" || !Types.ObjectId.isValid(teamId)) {
      return res.status(400).json({ message: "Invalid or missing teamId" });
    }

    const teamObjectId = new Types.ObjectId(teamId as string);
    const pageNumber = parseInt(page as string);
    const limitNumber = parseInt(limit as string);
    const skip = (pageNumber - 1) * limitNumber;

    // Get total orders count for pagination
    const totalOrders = await Order.countDocuments({ teamId: teamObjectId });

    // Get orders for the team with pagination and latest first
    const orders = await Order.find({ teamId: teamObjectId })
      .populate("clientId", "clientName")
      .sort({ createdAt: -1 }) // 🔹 sort latest first
      .skip(skip)
      .limit(limitNumber)
      .lean();

    const allOrderIds = orders.map(order => order._id);

    // Get order items and populate inventory and nested adminProductId
    const allOrderItems = await OrderItem.find({
      orderId: { $in: allOrderIds }
    })
      .populate({
        path: "inventoryId",
        select: "userId adminProductId clientId orderItemId teamId size color sellBy sellByQuantity shelfLife season countryOfOrigin qtyInStock qtyIncoming variety tradingPrice",
        populate: {
          path: "adminProductId",
          select: "productName productAlias productCode variety size color productType comments createdAt updatedAt"
        },
        options: { lean: true }
      })
      .lean();

    // Map order items to orders
    const orderMap: Record<string, any> = {};
    for (const item of allOrderItems) {
      const orderId = (item.orderId as mongoose.Schema.Types.ObjectId).toString();
      orderMap[orderId] = {
        OrderItem: {
          _id: item._id,
          quantity: item.quantity,
          price: item.price,
          outstandingPrice: item.outstandingPrice,
          deliveryDate: item.deliveryDate,
          extraCostPrice: item.extraCostPrice,
          status: item.status,
        },
        Inventory: item.inventoryId
      };
    }

    // Merge orders with their order item & inventory
    const updatedOrders = orders.map(order => {
      const id = order._id.toString();
      return {
        ...order,
        OrderItem: orderMap[id]?.OrderItem,
        Inventory: orderMap[id]?.Inventory
      };
    });

    // Compute qtyInStock and qtyIncoming
    const data = updatedOrders.map(order => {
      const qtyIncoming = order.orderStatus === "Pending" ? order.OrderItem?.quantity || 0 : 0;
      const qtyInStock = order.orderStatus !== "Pending" ? order.OrderItem?.quantity || 0 : 0;

      return {
        ...order,
        Inventory: {
          ...order.Inventory,
          qtyInStock,
          qtyIncoming
        }
      };
    });

    return res.status(200).json({
      data,
      length: updatedOrders.length,
      total: totalOrders,
      page: pageNumber,
      limit: limitNumber,
      totalPages: Math.ceil(totalOrders / limitNumber)
    });
  } catch (error: any) {
    return res.status(500).json({
      status: "error",
      message: "Error fetching inventories",
      error: error.message
    });
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
  if(!id || !mongoose.isValidObjectId(id)) {
    responseHandler(res,400,"Invalid or missing inventory id","error")
    return
  }
  
  if(!tradingPrice){
    responseHandler(res,404,"Trading price is required","error")
    return
  }

  const existingInventory = await Inventory.findById(id)
  if(!existingInventory) {
    responseHandler(res,404,"Product not found in inventory","error")
    return
  }
  await Inventory.findByIdAndUpdate(id,{tradingPrice});
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
