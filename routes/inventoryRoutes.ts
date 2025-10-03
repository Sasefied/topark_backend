import { Router } from "express";
import {
  addStockOnInventory,
  deleteInventoryById,
  getAllInventories,
  getAllProductNames,
  getDeliveredOrders,
  getInventoryById,
  getProductById,
  updateInventoryById,
  updateTradingPrice,
} from "../controllers/inventoryController";
import {
  addStockOnInventoryValidator,
  getAllInventoriesValidator,
} from "../validators/inventoryValidators";
import { validate } from "../middlewares/validate";

const router = Router();

router
  .get("/", getAllInventoriesValidator(), validate, getAllInventories)
  .post("/", addStockOnInventoryValidator(), addStockOnInventory)
  .get("/products/names", validate, getAllProductNames)
  .get("/products/:productId", validate, getProductById)
  .get("/delivered-orders", getDeliveredOrders)
  .patch("/trading-price/:id", updateTradingPrice)
  .get("/inventory/:id", getInventoryById)
  .delete("/inventory/:id", deleteInventoryById)
  .patch("/inventory/:id", updateInventoryById);

export default router;
