import { RequestHandler } from "express"
import Inventory from "../schemas/Inventory"

/**
 * Get all inventories
 *
 * @route GET /inventory
 * @access Private
 */
const getAllInventories: RequestHandler = async (req, res) => {
  try {
    const inventory = await Inventory.find()

    res.status(200).json(inventory)
  } catch (error: any) {
    console.error("Error fetching products:", error.message, error.stack)
    res
      .status(500)
      .json({ message: "Error fetching products", error: error.message })
  }
}

export { getAllInventories }
