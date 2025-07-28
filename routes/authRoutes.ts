import express from "express";
import {
  signup,
  login,
  forgotPassword,
  resetPassword,
  getUserProfile,
  updateUserProfile,
  deleteUserProfile,
} from "../controllers/authController";
import authMiddleware from "../middlewares/auth";
import { validate } from "../middlewares/validate";
import { updateUserProfileValidator } from "../validators/authValidator";

const router = express.Router();

router
  .post("/signup", signup)
  .post("/login", login)
  .post("/forgot-password", forgotPassword)
  .post("/reset-password/:token", resetPassword)
  .get("/profile", authMiddleware, getUserProfile)
  .put(
    "/profile",
    authMiddleware,
    updateUserProfileValidator(),
    validate,
    updateUserProfile
  )
  .delete("/profile", authMiddleware, deleteUserProfile);

export default router;
