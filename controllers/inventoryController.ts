import { RequestHandler } from "express";
import Inventory from "../schemas/Inventory";

/**
 * Get all inventories
 *
 * @route GET /inventory
 * @access Private
 */
const getAllInventories: RequestHandler = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const inventoryAggregate = Inventory.aggregate([
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

export { getAllInventories };
