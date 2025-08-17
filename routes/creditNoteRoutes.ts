



import { Router } from "express";
import { createNoteValidator } from "../validators/creditNoteValidator";
import { createCreditNote, getActiveCreditNotes, getSellOrderForDropdown, getAllCreditNotes } from "../controllers/creditNoteController";
import { validate } from "../middlewares/validate";
import authMiddleware from "../middlewares/auth";

const router = Router();

router.get("/dropdown/:id", authMiddleware, getSellOrderForDropdown);
router.post("/", authMiddleware, createNoteValidator(), validate, createCreditNote);
router.get("/active", authMiddleware, getActiveCreditNotes);
router.get("/history", authMiddleware, getAllCreditNotes);
router.get("/", authMiddleware, getAllCreditNotes);

export default router;