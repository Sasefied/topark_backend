import { Request, Response } from "express";
import Inventory from "../schemas/Inventory";
import { responseHandler } from "../utils/responseHandler";
import mongoose, { mongo, Types } from "mongoose";
import MyClientModel from "../schemas/MyClient";
import Client from "../schemas/ClientDetails";
import Team from "../schemas/Team";

const searchBuyProducts = async (req: Request, res: Response) => {
  try {
    const { query = "", page = "1", limit = "10", teamId } = req.query;
    const team = await Team.findById(teamId);
    if(!team){
       return responseHandler(res, 200, "No buy orders found", "success", {
        buyOrders: [],
        totalBuyOrders: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
        pagingCounter: 1,
        hasPrevPage: false,
        hasNextPage: false,
        prevPage: null,
        nextPage: null,
      });
    }

    const myClient = await MyClientModel.findOne({ userId: team.createdBy }).select("clientId client").lean();
    if (!myClient || !myClient.clientId || myClient.clientId.length === 0) {
      // No clients associated with this user, return empty results
      return responseHandler(res, 200, "No buy orders found", "success", {
        buyOrders: [],
        totalBuyOrders: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
        pagingCounter: 1,
        hasPrevPage: false,
        hasNextPage: false,
        prevPage: null,
        nextPage: null,
      });
    }

    const allowedClientIds = myClient?.client?.map((client: any) => client.clientId);
    const inventory = await Inventory.find({clientId:{$in:allowedClientIds}}).populate("adminProductId clientId","clientName productName productAlias productCode variety referenceNumber size color productType comments")
    const object:any = {}
    for(const product of inventory){
      const id = (product.clientId as mongoose.Schema.Types.ObjectId).toString() as string
      if(object[id]){
        const allids = object[id].map((obj:any)=>(obj.adminProductId._id.toString()))
        const newid = (product.adminProductId as any)._id;
        if(!allids.includes(newid.toString())) object[id].push(product)
      } else {
        object[id] = [product]
      }
    }
    const updatedarray:any = []
    Object.keys(object).map(key=>{
      updatedarray.push(...object[key])
    })
    
    responseHandler(res, 200, "Buy orders found", "success",updatedarray);
  } catch (error) {
    console.error("Error searching buy orders:", error);
    responseHandler(res, 500, "Internal server error");
  }
};

export { searchBuyProducts };
