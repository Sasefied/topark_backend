import { query, body } from "express-validator";
import mongoose from "mongoose";

const isObjectId = (value: string) => mongoose.Types.ObjectId.isValid(value);

const getAllInventoriesValidator = () => {
  return [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .toInt()
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .toInt()
      .withMessage("Limit must be between 1 and 100"),
  ];
};

const addStockOnInventoryValidator = () => {
  return [
    body("adminProductId")
      .notEmpty()
      .withMessage("adminProductId is required")
      .custom(isObjectId)
      .withMessage("adminProductId must be a valid ObjectId"),

    // body("clientId")
    //   .notEmpty()
    //   .withMessage("clientId is required")
    //   .custom(isObjectId)
    //   .withMessage("clientId must be a valid ObjectId"),

    body("grade")
      .notEmpty()
      .withMessage("grade is required")
      .isString()
      .withMessage("grade must be a string")
      .toUpperCase(),

    body("pricePerUnit")
      .notEmpty()
      .withMessage("pricePerUnit is required")
      .isFloat({ min: 0 })
      .withMessage("pricePerUnit must be a non-negative number"),

    body("qtyInStock")
      .notEmpty()
      .withMessage("qtyInStock is required")
      .isInt({ min: 0 })
      .withMessage("qtyInStock must be a non-negative integer"),

    body("qtyIncoming")
      .notEmpty()
      .withMessage("qtyIncoming is required")
      .isInt({ min: 0 })
      .withMessage("qtyIncoming must be a non-negative integer"),

    body("sourceCountry")
      .notEmpty()
      .withMessage("sourceCountry is required")
      .isString()
      .withMessage("sourceCountry must be a string"),

    body("ccy")
      .notEmpty()
      .withMessage("ccy is required")
      .isLength({ min: 3, max: 3 })
      .withMessage("ccy must be a 3-letter currency code"),

    body("buyingPrice")
      .notEmpty()
      .withMessage("buyingPrice is required")
      .isFloat({ min: 0 })
      .withMessage("buyingPrice must be a non-negative number"),

    body("tradingPrice")
      .notEmpty()
      .withMessage("tradingPrice is required")
      .isFloat({ min: 0 })
      .withMessage("tradingPrice must be a non-negative number"),
  ];
};

export { getAllInventoriesValidator, addStockOnInventoryValidator };
