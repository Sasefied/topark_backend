import { Router } from "express";
import {
  getAllCashieringOrders,
  getAllCashieringOrdersCombined,
  getAllCashieringSellOrders,
  getCashieringOrderByIds,
  processCashieringOrder,
  searchCashieringOrders,
  searchCashieringSellOrders,
  searchCashieringOrdersCombined,
} from "../controllers/cashieringController";

const router = Router();

router
  .get("/all-combined-orders", getAllCashieringOrdersCombined)
  .get("/all-orders", getAllCashieringOrders)
  .get("/search-orders/:query", searchCashieringOrders)
  .get("/search-sell-orders/:query", searchCashieringSellOrders)
  .get("/search-combined-orders/:query", searchCashieringOrdersCombined)
  .post("/orders-by-ids", getCashieringOrderByIds)
  .post("/process-orders", processCashieringOrder);

export default router;
