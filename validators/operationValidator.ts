import { param, query } from "express-validator";

const validateGetAllSellOrders = () => {
  return [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Limit must be a positive integer"),
  ];
};

const validateGetSellOrderItems = () => {
  return [
    param("orderId").isMongoId().withMessage("Invalid order ID"),
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Limit must be a positive integer"),
  ];
};

const validateOrderItemId = () => {
  return [param("id").isMongoId().withMessage("Invalid ID")];
};

export {
  validateGetAllSellOrders,
  validateGetSellOrderItems,
  validateOrderItemId,
};
