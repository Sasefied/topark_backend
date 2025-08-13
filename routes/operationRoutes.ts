import { Router } from "express";
import {
  confirmOperationSellOrderItem,
  getAllOperationSellOrder,
  getAllOperationSellOrderItem,
  markAsShippedOperationSellOrder,
} from "../controllers/operationController";

const router = Router();

router
  .get("/", getAllOperationSellOrder)
  .get("/:id/items", getAllOperationSellOrderItem)
  .put("/:id/confirm", confirmOperationSellOrderItem)
  .put("/:id/mark-as-shipped", markAsShippedOperationSellOrder);

export default router;