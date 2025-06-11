import express from "express";
import {
  checkProductName,
  createProduct,
  deleteProduct,
  getAllProducts,
  getColors,
  getProductById,
  getSizes,
  updateProduct,
} from "../controllers/adminProductController";
import { validateProductId } from "../middlewares/productValidation";

const router = express.Router();

router.post("/", createProduct);
router.get("/", getAllProducts);
router.put("/:productId", validateProductId, updateProduct);
router.delete("/:productId", validateProductId, deleteProduct);
router.get("/check-name", checkProductName);
router.get("/colors", getColors);
router.get("/sizes", getSizes);
router.get("/:productId", validateProductId, getProductById);

export default router;
