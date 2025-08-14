import { body, param } from "express-validator";
import { Types } from "mongoose";
import { IOrderWithItems } from "../controllers/BuyOrderController";

const isValidObjectId = (value: string) => {
  return Types.ObjectId.isValid(value);
};

const validateCreateBuyOrder = () => {
  return [
    body("inventoryId")
      .notEmpty()
      .withMessage("Inventory ID is required")
      .custom(isValidObjectId)
      .withMessage("Invalid inventory ID format"),

    body("quantity")
      .isInt({ min: 1 })
      .withMessage("Quantity must be a positive integer"),

    body("price")
      .isFloat({ min: 0 })
      .withMessage("Price must be a positive number"),

    body("deliveryDate")
      .notEmpty()
      .withMessage("Delivery date is required")
      .isISO8601()
      .withMessage("Delivery date must be a valid ISO8601 date")
      .custom((value) => {
        const deliveryDate = new Date(value);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (deliveryDate < today) {
          throw new Error("Delivery date cannot be in the past");
        }
        return true;
      }),
  ];
};

const validateCreateBulkBuyOrders = () => {
  return [
    body("orders")
      .isArray({ min: 1 })
      .withMessage("Orders must be a non-empty array"),

    body("orders.*.inventoryId")
      .notEmpty()
      .withMessage("Inventory ID is required for each order")
      .custom(isValidObjectId)
      .withMessage("Invalid inventory ID format"),

    body("orders.*.quantity")
      .isInt({ min: 1 })
      .withMessage("Quantity must be a positive integer for each order"),

    body("orders.*.price")
      .isFloat({ min: 0 })
      .withMessage("Price must be a positive number for each order"),

    body("orders.*.clientId")
      .optional()
      .custom(isValidObjectId)
      .withMessage("Invalid client ID format"),

    body("orders.*.orderStatus")
      .optional()
      .isIn(["Pending", "Confirmed", "Delivered"])
      .withMessage("Invalid order status"),

    body("orders.*.deliveryDate")
      .notEmpty()
      .withMessage("Delivery date is required for each order")
      .isISO8601()
      .withMessage("Delivery date must be a valid ISO8601 date")
      .custom((value) => {
        const deliveryDate = new Date(value);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (deliveryDate < today) {
          throw new Error("Delivery date cannot be in the past");
        }
        return true;
      }),

    // Custom validation to check for duplicate inventory items
    body("orders").custom((orders: IOrderWithItems[]) => {
      const inventoryIds = orders.map((order) => order.inventoryId);
      const uniqueInventoryIds = [...new Set(inventoryIds)];

      if (inventoryIds.length !== uniqueInventoryIds.length) {
        throw new Error(
          "Duplicate inventory items are not allowed in bulk orders"
        );
      }
      return true;
    }),

    // Custom validation to ensure at least one order has clientId if creating new order
    body("orders").custom((orders: IOrderWithItems[]) => {
      const hasClientId = orders.some((order) => order.clientId);
      if (!hasClientId) {
        throw new Error("At least one order must have a client ID");
      }
      return true;
    }),
  ];
};

const validateDeleteBuyOrder = () => {
  return [
    body("orderId")
      .notEmpty()
      .withMessage("Order ID is required")
      .custom(isValidObjectId)
      .withMessage("Invalid order ID format"),
  ];
};

const validateUpdateBuyOrder = () => {
  return [
    param("buyOrderId")
      .notEmpty()
      .withMessage("Buy order ID is required")
      .custom(isValidObjectId)
      .withMessage("Invalid buy order ID format"),

    body("quantity")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Quantity must be a positive integer"),

    body("price")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Price must be a positive number"),

    body("deliveryDate")
      .optional()
      .isISO8601()
      .withMessage("Delivery date must be a valid ISO8601 date")
      .custom((value) => {
        if (!value) return true; // Skip validation if not provided

        const deliveryDate = new Date(value);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (deliveryDate < today) {
          throw new Error("Delivery date cannot be in the past");
          
        }
        return true;
      }),

    body("orderStatus")
      .optional()
      .isIn(["Pending", "Confirmed", "Delivered"])
      .withMessage("Invalid order status"),

    // Custom validation to ensure at least one field is provided for update
    body().custom((body) => {
      const allowedFields = [
        "quantity",
        "price",
        "deliveryDate",
        "orderStatus",
      ];
      const providedFields = Object.keys(body).filter((key) =>
        allowedFields.includes(key)
      );

      if (providedFields.length === 0) {
        throw new Error(
          "At least one field (quantity, price, deliveryDate, or orderStatus) must be provided for update"
        );
      }
      return true;
    }),
  ];
};

export {
  validateCreateBuyOrder,
  validateCreateBulkBuyOrders,
  validateDeleteBuyOrder,
  validateUpdateBuyOrder,
};
