import { body } from "express-validator";

const createNoteValidator = () => {
  return [
    body("orderId").isMongoId().withMessage("Invalid order ID"),
    body("clientId").isMongoId().withMessage("Invalid client ID"),
    body("startDate").isDate().withMessage("Invalid start date"),
    body("endDate").isDate().withMessage("Invalid end date"),
    body("total")
      .isFloat({ min: 0 })
      .withMessage("Total must be a non-negative number"),
  ];
};

export { createNoteValidator };
