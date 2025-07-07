import { RequestHandler } from "express";
import Inventory from "../schemas/Inventory";
import { Types } from "mongoose";

/**
 * Get all inventories
 *
 * @route GET /inventories
 * @access Private
 */
const getAllInventories: RequestHandler = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const inventoryAggregate = Inventory.aggregate([
      {
        $match: {
          userId: { $eq: new Types.ObjectId(req.userId) },
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
    ]);

    const inventories = await (Inventory as any).aggregatePaginate(
      inventoryAggregate,
      {
        page,
        limit,
        customLabels: {
          docs: "inventories",
          totalDocs: "totalInventories",
        },
      }
    );
    res.status(200).json(inventories);
  } catch (error: any) {
    console.error("Error fetching inventories:", error.message, error.stack);
    res
      .status(500)
      .json({ message: "Error fetching inventories", error: error.message });
  }
};

/**
 * Add stock to inventory
 *
 * @route POST /inventories
 * @access Private
 */
const addStockOnInventory: RequestHandler = async (req, res) => {
  try {
    const {
      userId,
      adminProductId,
      clientId,
      grade,
      pricePerUnit,
      qtyInStock,
      qtyIncoming,
      sourceCountry,
      ccy,
      buyingPrice,
      tradingPrice,
    } = req.body;

    await Inventory.create({
      userId,
      adminProductId,
      clientId,
      grade,
      pricePerUnit,
      qtyInStock,
      qtyIncoming,
      sourceCountry,
      ccy,
      buyingPrice,
      tradingPrice,
    });

    res.status(200).json({ message: "Stock added to inventory successfully" });
  } catch (error) {
    console.error("Error adding stock to inventory:", error);
    res.status(500).json({ message: "Error adding stock to inventory" });
  }
};

export { getAllInventories, addStockOnInventory };
