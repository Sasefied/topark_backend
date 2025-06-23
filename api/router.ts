/// <reference types="../types/express" />

import express from "express";

import authRoutes from "../routes/authRoutes";
import teamRoutes from "../routes/teamRoutes";
import adminProductRoutes from '../routes/adminProductRoutes';
import ClientDetailsRoutes from "../routes/ClientDetailsRoutes";

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
router.use('/admin/products', adminProductRoutes);
router.use('/clients', ClientDetailsRoutes)



export default router;
