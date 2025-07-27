import { Router } from "express";
import { searchBuyProducts } from "../controllers/BuyProductController";
import { buyProductValidator } from "../validators/buyProductValidators";
import { validate } from "../middlewares/validate";

const router = Router();

router.get("/", buyProductValidator(), validate, searchBuyProducts);

export default router;
