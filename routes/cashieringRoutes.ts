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
  processCashieringSellOrder,
} from "../controllers/cashieringController";

const router = Router();

router
  .get("/all-combined-orders", getAllCashieringOrdersCombined)
  .get("/all-orders", getAllCashieringOrders)
  .get("/search-orders/:query", searchCashieringOrders)
  .get("/search-sell-orders/:query", searchCashieringSellOrders)
  .get("/search-combined-orders/:query", searchCashieringOrdersCombined)
  .post("/orders-by-ids", getCashieringOrderByIds)
  .post("/process-orders", processCashieringOrder)
  .post("/process-sell-orders", processCashieringSellOrder);

export default router;
