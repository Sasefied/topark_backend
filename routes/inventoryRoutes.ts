import { Router } from "express"
import { getAllInventories } from "../controllers/inventoryController"

const router = Router()

router.get("/", getAllInventories)

export default router
