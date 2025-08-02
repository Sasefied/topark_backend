import { Router } from "express";
import {
  createSellOrder,
  deleteSellOrder,
  getAllSellOrder,
  getLastSellOrder,
  getMostReorderedOrder,
  getSellOrderById,
  searchAllClients,
  searchProductCode,
  updateSellOrder,
} from "../controllers/SellOrderController";
import {
  createSellOrderValidator,
  deleteSellOrderValidator,
  getAllSellOrderValidator,
  getSellOrderByIdValidator,
  searchAllClientsValidator,
  updateSellOrderValidator,
} from "../validators/sellOrderValidator";
import { validate } from "../middlewares/validate";

const router = Router();

router
  .get(
    "/search-clients",
    searchAllClientsValidator(),
    validate,
    searchAllClients
  )
  .get("/search-product-codes", searchProductCode)
  .post("/", createSellOrderValidator(), validate, createSellOrder)
  .get("/last", getLastSellOrder)
  .get("/most-recorded", getMostReorderedOrder)
  .get(
    "/",
    getAllSellOrderValidator(),
    validate,
    getAllSellOrder
  )
  .get("/:id", getSellOrderByIdValidator(), validate, getSellOrderById)
  .put("/:id", updateSellOrderValidator(), validate, updateSellOrder)
  .delete("/:id", deleteSellOrderValidator(), validate, deleteSellOrder);

export default router;
