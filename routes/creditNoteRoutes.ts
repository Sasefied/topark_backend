import { Router } from "express";
// import { validate } from "uuid";
import { createNoteValidator } from "../validators/creditNoteValidator";
import { createCreditNote } from "../controllers/creditNoteController";
// import { validate } from "uuid";


const router = Router();

router.post("/", createNoteValidator(),  createCreditNote); //validate,

export default router;