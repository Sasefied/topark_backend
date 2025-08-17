import { Router } from "express";
import {
  confirmOperationSellOrderItem,
  getAllOperationSellOrder,
  getAllOperationSellOrderItem,
  getAllShippedOrders,
  markAsShippedOperationSellOrder,
} from "../controllers/operationController";

const router = Router();

router
  .get("/", getAllOperationSellOrder)
  .get("/:orderId/items", getAllOperationSellOrderItem)
  .get("/shipped", getAllShippedOrders)
  .put("/:id/confirm", confirmOperationSellOrderItem)
  .put("/:id/mark-as-shipped", markAsShippedOperationSellOrder);

export default router;