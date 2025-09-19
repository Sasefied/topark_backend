import { Router } from "express";
import {
  addStockOnInventory,
  getAllInventories,
  getAllProductNames,
  getDeliveredOrders,
  getProductById,
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
  .post("/", addStockOnInventoryValidator(), validate, addStockOnInventory)
  .get("/products/names", validate, getAllProductNames)
  .get("/products/:productId", validate, getProductById)
  .get("/delivered-orders", getDeliveredOrders)
  .patch("/trading-price/:id", updateTradingPrice);

export default router;
