import { Router } from "express";
// import { validate } from "uuid";
import { createNoteValidator } from "../validators/creditNoteValidator";
import { createCreditNote, getSellOrderForDropdown } from "../controllers/creditNoteController";
// import { validate } from "uuid";
import { validate } from "../middlewares/validate";


const router = Router();
router.get("/dropdown/:id", getSellOrderForDropdown);
router.post("/", createNoteValidator(),  validate, createCreditNote); //validate,

export default router;