import { Router } from "express";
import { getAllInventories } from "../controllers/inventoryController";
import { getAllInventoriesValidator } from "../validators/inventoryValidators";
import { validate } from "../middlewares/validate";

const router = Router();

router.get("/", getAllInventoriesValidator(), validate, getAllInventories);

export default router;
