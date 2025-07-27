import { query } from "express-validator";

const buyProductValidator = () => {
  return [
    query("query")
      .trim()
      .notEmpty()
      .withMessage("Search query is required")
      .isString()
      .withMessage("Search query must be a string"),
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

export { buyProductValidator };