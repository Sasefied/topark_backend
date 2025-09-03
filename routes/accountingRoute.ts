import { Router } from "express";
import {
  getAllAccountingRecords,
  getClientById,
  receivePayment,
  sendPayment,
  getPaymentHistory,
} from "../controllers/accountingController";

const router = Router();

router
  .get("/", getAllAccountingRecords)
  .get("/:clientId", getClientById)
  .post("/receive-payment", receivePayment)
  .post("/send-payment", sendPayment)
  .get("/:clientId/payment-history", getPaymentHistory);

export default router;
