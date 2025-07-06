import { param } from "express-validator";

const buyProductValidator = () => {
  return [
    param("query")
      .trim()
      .notEmpty()
      .withMessage("Search query is required")
      .isString()
      .withMessage("Search query must be a string"),
    param("page")
      .optional()
      .isInt({ min: 1 })
      .toInt()
      .withMessage("Page must be a positive integer"),
    param("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .toInt()
      .withMessage("Limit must be between 1 and 100"),
  ];
};

export { buyProductValidator };