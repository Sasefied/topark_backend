import express from "express";

import authRoutes from "../routes/authRoutes";
import userRoutes from "../routes/userRoutes";
import clientRoutes from "../routes/clientRoutes";
import dashboardRoutes from "../routes/dashboardRoutes";
import teamRoutes from "../routes/teamRoutes";

const router = express.Router();

router.get("/", (_req, res) => {
  res.json({ message: "Welcome to the Toprak Backend" });
});

router.get("/health", (_req, res) => {
  res.status(200).json({ status: "UP" });
});

// Mount the modular routes
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/clients", clientRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/team", teamRoutes);

export default router;
