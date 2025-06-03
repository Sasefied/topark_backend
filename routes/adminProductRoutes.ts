import express from 'express'
import { createProduct, deleteProduct, getAllProducts, getProductById,searchCategories,updateProduct } from "../controllers/adminProductController";


const router = express.Router();

router.post('/', createProduct);
router.get('/', getAllProducts);
router.get('/:productId', getProductById);
router.get("/categories", searchCategories);
router.put('/:productId', updateProduct);
router.delete('/:productId', deleteProduct);

export default router;