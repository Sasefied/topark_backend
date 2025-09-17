import { Request, RequestHandler, Response } from "express";
import mongoose, { Types } from "mongoose";
import Inventory from "../schemas/Inventory";
import { AdminProduct } from "../schemas/AdminProduct";
import { responseHandler } from "../utils/responseHandler";
import Order from "../schemas/Order";
import asyncHandler from "express-async-handler";

const getAllInventories: RequestHandler = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;

    if (!req.userId || !mongoose.Types.ObjectId.isValid(req.userId)) {
      res.status(401).json({ message: "Invalid or missing userId" });
    }

    const matchStage: any = {
      userId: { $eq: new Types.ObjectId(req.userId) },
    };

    if (search) {
      matchStage["adminProduct.productName"] = {
        $regex: search,
        $options: "i",
      };
    }
    const inventoryAggregate = Inventory.aggregate([
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
        $match: matchStage,
      },
      {
        $project: {
          client: 0,
        },
      },
    ]);

    const inventories = await (Inventory as any).aggregatePaginate(
      inventoryAggregate,
      {
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10),
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

const addStockOnInventory: RequestHandler = async (req, res) => {
  try {
    const {
      clientId,
      adminProductId,
      grade,
      pricePerUnit,
      qtyInStock,
      qtyIncoming,
      sourceCountry,
      ccy,
      buyingPrice,
      tradingPrice,
    } = req.body;

    // Validate required fields
    if (
      !adminProductId ||
      !grade ||
      !pricePerUnit ||
      qtyInStock === undefined ||
      qtyIncoming === undefined ||
      !sourceCountry ||
      !ccy ||
      !buyingPrice ||
      !tradingPrice
    ) {
      res.status(400).json({ message: "All fields are required" });
      return;
    }

    // Validate ObjectId fields
    if (!mongoose.Types.ObjectId.isValid(adminProductId)) {
      res.status(400).json({ message: "Invalid adminProductId format" });
      return;
    }

    // Validate referenced documents
    const product = await AdminProduct.findById(adminProductId);
    if (!product) {
      res.status(404).json({ message: "Product not found" });
      return;
    }

    const existedInventoryProduct = await Inventory.findOne({
      userId: req.userId,
      adminProductId,
    });

    if (existedInventoryProduct) {
      await Inventory.updateOne(
        {
          _id: existedInventoryProduct._id,
        },
        {
          $inc: {
            qtyInStock,
            qtyIncoming,
          },
          $set: {
            pricePerUnit,
            sourceCountry,
            ccy,
            buyingPrice,
            tradingPrice,
          },
        }
      );
    } else {
      await Inventory.create({
        userId: req.userId,
        clientId,
        adminProductId,
        grade: grade.toUpperCase(),
        pricePerUnit,
        qtyInStock,
        qtyIncoming,
        sourceCountry: sourceCountry.toUpperCase(),
        ccy: ccy.toUpperCase(),
        buyingPrice,
        tradingPrice,
      });
    }

    res.status(200).json({ message: "Stock added to inventory successfully" });
  } catch (error: any) {
    console.error(
      "Error adding stock to inventory:",
      error.message,
      error.stack
    );
    res
      .status(400)
      .json({ message: error.message || "Error adding stock to inventory" });
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

export {
  getAllInventories,
  addStockOnInventory,
  getAllProductNames,
  getProductById,
  getDeliveredOrders,
  updateTradingPrice,
};
