import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";

export const validateProductId = (req: Request, res: Response, next: NextFunction): void => {
  if (req.path.endsWith("/colors") || req.path.endsWith("/sizes")) {
    return next();
  }
  const { productId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    res.status(400).json({ message: "Invalid product ID format" });
  }
  next();
};