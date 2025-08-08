import { Router } from "express";
import { createCreditNote } from "../controllers/creditNoteController";
import { createNoteValidator } from "../validators/creditNoteValidator";
import { validate } from "../middlewares/validate";

const router = Router();

router.post("/", createNoteValidator(), validate, createCreditNote);

export default router;
