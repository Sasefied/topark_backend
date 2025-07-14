import { Router } from "express";
import {
  getAllCashieringOrders,
  getCashieringOrderById,
  processCashieringOrder,
  searchCashieringOrders,
} from "../controllers/cashieringController";

const router = Router();

router
  .get("/", getAllCashieringOrders)
  .get("/search/:query", searchCashieringOrders)
  .get("/:orderId", getCashieringOrderById)
  .post("/:orderId", processCashieringOrder);

export default router;
