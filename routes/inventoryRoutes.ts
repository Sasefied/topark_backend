import { Router } from "express";
import {
  addStockOnInventory,
  getAllInventories,
} from "../controllers/inventoryController";
import { addStockOnInventoryValidator, getAllInventoriesValidator } from "../validators/inventoryValidators";
import { validate } from "../middlewares/validate";

const router = Router();

router
  .get("/", getAllInventoriesValidator(), validate, getAllInventories)
  .post("/", addStockOnInventoryValidator(), validate, addStockOnInventory);

export default router;
