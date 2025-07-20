import { Router } from "express";
import {
  getAllLogisticOrders,
  searchLogisticOrders,
  reportLogisticOrderItem,
  getAllLogisticOrderedItems,
  getAllLogisticReportedIssues,
} from "../controllers/logisticController";
import upload from "../middlewares/multer";

const router = Router();

router
  .get("/", getAllLogisticOrders)
  .get("/search", searchLogisticOrders)
  .post("/:orderItemId/report", upload.single("proof"), reportLogisticOrderItem)
  .get("/:orderId/items", getAllLogisticOrderedItems)
  .get("/:orderId/reported-issues", getAllLogisticReportedIssues);

export default router;
