import { Router } from "express";
import {
  confirmOperationSellOrderItem,
  getAllOperationSellOrder,
  getAllOperationSellOrderItem,
  markAsShippedOperationSellOrder,
} from "../controllers/operationController";
import {
  validateGetAllSellOrders,
  validateGetSellOrderItems,
  validateOrderItemId,
} from "../validators/operationValidator";
import { validate } from "../middlewares/validate";

const router = Router();

router
  .get("/", validateGetAllSellOrders(), validate, getAllOperationSellOrder)
  .get(
    "/:id/items",
    validateGetSellOrderItems(),
    validate,
    getAllOperationSellOrderItem
  )
  .put(
    "/:id/confirm",
    validateOrderItemId(),
    validate,
    confirmOperationSellOrderItem
  )
  .put(
    "/:id/mark-as-shipped",
    validateOrderItemId(),
    validate,
    markAsShippedOperationSellOrder
  );

export default router;
