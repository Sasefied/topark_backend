

import { Router } from "express";
import {
  getAllCashieringOrders,
  getAllCashieringSellOrders,
  getCashieringOrderByIds,
  getCashieringSellOrderByIds,
  processCashieringOrder,
  processCashieringSellOrder,
  searchCashieringOrders,
  searchCashieringSellOrders,
} from "../controllers/cashieringController";

const router = Router();

router
  .get("/all-orders", getAllCashieringOrders)
  .get("/all-sell-orders", getAllCashieringSellOrders)
  .get("/search-orders/:query", searchCashieringOrders)
  .get("/search-sell-orders/:query", searchCashieringSellOrders)
  .post("/orders-by-ids", getCashieringOrderByIds)
  .post("/sell-orders-by-ids", getCashieringSellOrderByIds)
  .post("/process-orders", processCashieringOrder)
  .post("/process-sell-orders", processCashieringSellOrder);

export default router;