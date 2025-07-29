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
import { updateUserProfileValidator } from "../validators/authValidatore";
import { validate } from "../middlewares/validate";
import authMiddleware from "../middlewares/auth";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);
router.get("/profile",authMiddleware, getUserProfile)
router.put(
    "/profile",authMiddleware,
    updateUserProfileValidator(),
    validate,
    updateUserProfile
  )
router.delete("/profile", authMiddleware, deleteUserProfile);

export default router;
 