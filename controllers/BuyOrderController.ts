import { RequestHandler } from "express";
import { AdminProduct } from "../schemas/AdminProduct";
import Client from "../schemas/ClientDetails";

const searchBuyOrders: RequestHandler = (req, res) => {
    try {
        const { query } = req.params;

        
    } catch (error) {
        res.status(500).json({ message: "Error searching buy orders" });
    }
}