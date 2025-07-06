import { Router } from "express";
import { searchBuyOrders } from "../controllers/BuyOrderController";

const router = Router();

router.get("/", searchBuyOrders);

export default router;
