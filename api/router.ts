/// <reference types="../types/express" />

import express from "express";

import authRoutes from "../routes/authRoutes";
import teamRoutes from "../routes/teamRoutes";
import adminProductRoutes from "../routes/adminProductRoutes";
import ClientDetailsRoutes from "../routes/ClientDetailsRoutes";
import inventoryRoutes from "../routes/inventoryRoutes";
import buyProductRoutes from "../routes/buyProductRoute";
import authMiddleware from "../middlewares/auth";
import buyOrderRoutes from "../routes/buyOrderRoutes";
import cashieringRoutes from '../routes/cashieringRoutes'
import sellOrderRoutes from "../routes/sellOrderRoutes";
import creditNoteRoutes from "../routes/creditNoteRoutes";
import operationRoutes from "../routes/operationRoutes";
import logisticRoutes from "../routes/logisticRoutes"
import accountingRoutes from "../routes/accountingRoute";
const router = express.Router();

router.get("/", (_req, res) => {
  res.json({ message: "Welcome to the Toprak Backend" });
});

router.get("/health", (_req, res) => {
  res.status(200).json({ status: "UP" });
});

// Mount the modular routes
router.use("/auth", authRoutes);
router.use("/team", teamRoutes);
router.use("/admin/products", adminProductRoutes);
router.use("/clients", ClientDetailsRoutes);
router.use("/inventories", authMiddleware, inventoryRoutes);
router.use("/buy-products", authMiddleware, buyProductRoutes);
router.use("/buy-orders", authMiddleware, buyOrderRoutes);
router.use("/cashiering", authMiddleware, cashieringRoutes);
router.use("/sell-orders", authMiddleware, sellOrderRoutes);
router.use("/credit-notes", authMiddleware, creditNoteRoutes);
router.use("/operations", authMiddleware, operationRoutes);
router.use("/logistics", authMiddleware, logisticRoutes);
router.use("/accounting", authMiddleware, accountingRoutes);

export default router;
