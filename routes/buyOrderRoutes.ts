import { Router } from "express";
import {
  createBuyOrder,
  createBulkBuyOrders,
  getAllBuyOrders,
  deleteBuyOrder,
  updateBuyOrder,
} from "../controllers/BuyOrderController";

const router = Router();

router
  .post("/", createBuyOrder)
  .post("/bulk", createBulkBuyOrders)
  .get("/", getAllBuyOrders)
  .patch("/:buyOrderId", updateBuyOrder)
  .delete("/:id", deleteBuyOrder)
  

export default router;