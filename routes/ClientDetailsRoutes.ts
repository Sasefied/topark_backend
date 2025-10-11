import { Router } from "express";
import {
  addClientToUser,
  createClient,
  deleteClient,
  getAllClients,
  getClientById,
  getClientsForUser,
  getProductByClientId,
  searchClients,
  updateClient,
} from "../controllers/ClientDetails";
import authMiddleware from "../middlewares/auth";
import { addStockOnInventory } from "../controllers/inventoryController";

const router = Router();

// CRUD Routes
router.post("/", authMiddleware, createClient); // Create a new client
// router.get("/users-for-clients",authMiddleware , getUsersForClientList); // Fetch users for client list
router.get("/my-clients-list/:teamId", authMiddleware, getClientsForUser);
router.get("/get-all-clients", authMiddleware, getAllClients); // Get all clients
router.get("/search-clients", authMiddleware, searchClients);
router.get("/:clientId", authMiddleware, getClientById); // Get a client by ID
router.put("/:clientId", authMiddleware, updateClient); // Update a client by ID
router.delete("/delete-client", authMiddleware, deleteClient); // Delete a client by ID

router.post("/add-client-to-userList", authMiddleware, addClientToUser);
router.post('/:clientId/addstock', authMiddleware, addStockOnInventory)
router.get("/:clientId/products", authMiddleware, getProductByClientId);
export default router;
