import { Router } from "express";
import {
  getAllCashieringOrders,
  getCashieringOrderByIds,
  processCashieringOrder,
  searchCashieringOrders,
} from "../controllers/cashieringController";

const router = Router();

router
  .get("/all-orders", getAllCashieringOrders)
  .get("/search/:query", searchCashieringOrders)
  .get("/", getCashieringOrderByIds)
  .post("/process-order", processCashieringOrder);

export default router;
