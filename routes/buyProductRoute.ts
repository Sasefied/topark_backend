import { Router } from "express";
import { searchBuyProducts } from "../controllers/BuyProductController";

const router = Router();

router.get("/", searchBuyProducts);

export default router;
