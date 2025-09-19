import { Router } from "express";
import {
  getAllAccountingRecords,
  getClientById,
  receivePayment,
  sendPayment,
  getPaymentHistory,
  sendReminder,
} from "../controllers/accountingController";

const router = Router();

router
  .get("/", getAllAccountingRecords)
  .get("/:clientId", getClientById)
  .post("/receive-payment", receivePayment)
  .post("/send-payment", sendPayment)
  .get("/:clientId/payment-history", getPaymentHistory)
  .post("/send-reminder/:clientId", sendReminder);

export default router;
