import { Router } from 'express';
import { createClient, deleteClient, getAllClients, getClientById, getUsersForClientList, updateClient } from '../controllers/ClientDetails';
import authMiddleware from '../middlewares/auth';

const router = Router();

// CRUD Routes
router.post('/', authMiddleware ,createClient);          // Create a new client
router.get("/users-for-clients",authMiddleware , getUsersForClientList); // Fetch users for client list
router.get('/',authMiddleware , getAllClients);          // Get all clients
router.get('/:clientId',authMiddleware , getClientById);       // Get a client by ID
router.put('/:clientId',authMiddleware , updateClient);        // Update a client by ID
router.delete('/:clientId',authMiddleware , deleteClient);     // Delete a client by ID

export default router;