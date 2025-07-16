import { Router } from "express";
import {
  createBuyOrder,
  createBulkBuyOrders,
  getAllBuyOrders,
  deleteBuyOrder,
  updateBuyOrder,
} from "../controllers/BuyOrderController";
import {
  validateCreateBuyOrder,
  validateCreateBulkBuyOrders,
  validateDeleteBuyOrder,
  validateUpdateBuyOrder,
} from "../validators/buyOrderValidators";
import { validate } from "../middlewares/validate";

const router = Router();

router
  .post("/", validateCreateBuyOrder(), validate, createBuyOrder)
  .post("/bulk", validateCreateBulkBuyOrders(), validate, createBulkBuyOrders)
  .get("/", getAllBuyOrders)
  .delete("/:id", validateDeleteBuyOrder(), validate, deleteBuyOrder)
  .patch("/:buyOrderId", validateUpdateBuyOrder(), validate, updateBuyOrder);

export default router;
