import { Router } from 'express';
import { addClientToUser, createClient, deleteClient, getAllClients, getClientById, getClientsForUser, searchClients, updateClient } from '../controllers/ClientDetails';
import authMiddleware from '../middlewares/auth';

const router = Router();

// CRUD Routes
router.post('/', authMiddleware ,createClient);          // Create a new client
// router.get("/users-for-clients",authMiddleware , getUsersForClientList); // Fetch users for client list
router.get('/my-clients-list', authMiddleware, getClientsForUser)
router.get('/get-all-clients',authMiddleware , getAllClients);          // Get all clients
router.get('/search-clients', authMiddleware, searchClients)
router.get('/:clientId',authMiddleware , getClientById);       // Get a client by ID
router.put('/:clientId',authMiddleware , updateClient);        // Update a client by ID
router.delete('/delete-client',authMiddleware , deleteClient);     // Delete a client by ID

router.post('/add-client-to-userList', authMiddleware, addClientToUser )

export default router;