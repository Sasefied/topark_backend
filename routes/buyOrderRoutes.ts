import { Router } from "express";
import {
  createBuyOrder,
  deleteBuyOrder,
  getAllBuyOrders,
} from "../controllers/BuyOrderController";

const router = Router();

router
  .post("/", createBuyOrder)
  .get("/", getAllBuyOrders)
  .delete("/:id", deleteBuyOrder);

export default router;
