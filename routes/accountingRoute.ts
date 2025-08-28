import { Router } from "express";
import { getAllAccountingRecords } from "../controllers/accountingController";

const router = Router();

router.get("/", getAllAccountingRecords);

export default router;
