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
  getCashieringSellOrderByIds,
  verifyUserPassword,
  setOpeningAmount,
  setClosingAmount,
  getAllCashieringHistory,
  getTodayCashiering,
} from "../controllers/cashieringController";

const router = Router();

router
  .get("/all-combined-orders", getAllCashieringOrdersCombined)
  .get("/all-orders", getAllCashieringOrders)
  .get("/search-orders/:query", searchCashieringOrders)
  .get("/search-sell-orders/:query", searchCashieringSellOrders)
  .get("/search-combined-orders/:query", searchCashieringOrdersCombined)
  .post("/orders-by-ids", getCashieringOrderByIds)
  .post("/sell-orders-by-ids", getCashieringSellOrderByIds)
  .post("/process-orders", processCashieringOrder)
  .post("/process-sell-orders", processCashieringSellOrder)
  .post("/verify-password", verifyUserPassword)
  .post("/set-opening-amount", setOpeningAmount)
  .post("/set-closing-amount", setClosingAmount)
  .get("/all-cashiering-history", getAllCashieringHistory)
  .get("/today-cashiering", getTodayCashiering);

export default router;
