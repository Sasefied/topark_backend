import { body } from "express-validator";

const updateUserProfileValidator = () => {
  return [
    body("firstName")
      .isString()
      .withMessage("firstName must be a string")
      .isLength({ min: 2, max: 50 })
      .withMessage("firstName must be between 2 and 50 characters"),

    body("lastName")
      .isString()
      .withMessage("lastName must be a string")
      .isLength({ min: 2, max: 50 })
      .withMessage("lastName must be between 2 and 50 characters"),

    body("email")
      .isEmail()
      .withMessage("email must be a valid email address")
      .isLength({ max: 255 })
      .withMessage("email must be less than 255 characters"),

    body("oldPassword")
      .isString()
      .withMessage("password must be a string")
      .isLength({ min: 6, max: 255 })
      .withMessage("password must be between 6 and 255 characters"),

    body("newPassword")
      .isString()
      .withMessage("newPassword must be a string")
      .isLength({ min: 6, max: 255 })
      .withMessage("newPassword must be between 6 and 255 characters"),

    body("primaryUsage")
      .isIn(["Buying", "Selling", "Buying and Selling"])
      .withMessage(
        "primaryUsage must be Buying, Selling, or Buying and Selling"
      ),
  ];
};

export { updateUserProfileValidator };
