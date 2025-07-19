// import { Router } from "express";
// import {
//   getAllCashieringOrders,
//   getCashieringOrderByIds,
//   processCashieringOrder,
//   searchCashieringOrders,
// } from "../controllers/cashieringController";

// const router = Router();

// router
//   .get("/all-orders", getAllCashieringOrders)
//   .get("/search/:query", searchCashieringOrders)
//   .get("/:id", getCashieringOrderByIds)
//   .post("/process-order", processCashieringOrder);

// export default router;

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
  .get("/search-orders/:query", searchCashieringOrders)
  .post("/orders-by-ids", getCashieringOrderByIds)
  .post("/process-orders", processCashieringOrder);

export default router;