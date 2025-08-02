import { param, query, body } from "express-validator";

const searchAllClientsValidator = () => {
  return [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer")
      .toInt(),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be a positive integer between 1 and 100")
      .toInt(),
    query("query")
      .optional()
      .isString()
      .trim()
      .withMessage("Query must be a string"),
  ];
};

const createSellOrderValidator = () => {
  return [
    body("clientId").isMongoId().withMessage("Invalid client ID"),
    body("orders")
      .isArray({ min: 1 })
      .withMessage("Orders must be a non-empty array"),
    body("orders.*.inventoryId")
      .isMongoId()
      .withMessage("Invalid inventory ID"),
    body("orders.*.productCode")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("Product code is required"),
    body("orders.*.quantity")
      .isInt({ min: 1 })
      .withMessage("Quantity must be a positive integer")
      .toInt(),
    body("orders.*.sellPrice")
      .isFloat({ min: 0 })
      .withMessage("Sell price must be a non-negative number")
      .toFloat(),
  ];
};

const getSellOrderByIdValidator = () => {
  return [param("id").isMongoId().withMessage("Invalid order ID")];
};

const updateSellOrderValidator = () => {
  return [
    param("id").isMongoId().withMessage("Invalid order ID"),
    body("orders")
      .isArray({ min: 1 })
      .withMessage("Orders must be a non-empty array"),
    body("orders.*.id").isMongoId().withMessage("Invalid order item ID"),
    body("orders.*.productCode")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("Product code is required"),
    body("orders.*.quantity")
      .isInt({ min: 1 })
      .withMessage("Quantity must be a positive integer")
      .toInt(),
    body("orders.*.sellPrice")
      .isFloat({ min: 0 })
      .withMessage("Sell price must be a non-negative number")
      .toFloat(),
  ];
};

const deleteSellOrderValidator = () => {
  return [param("id").isMongoId().withMessage("Invalid order item ID")];
};

const getAllSellOrderValidator = () => {
  return [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer")
      .toInt(),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be a positive integer between 1 and 100")
      .toInt()
  ]
}

export {
  searchAllClientsValidator,
  createSellOrderValidator,
  getSellOrderByIdValidator,
  updateSellOrderValidator,
  deleteSellOrderValidator,
  getAllSellOrderValidator
};