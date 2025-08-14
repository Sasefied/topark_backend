// import asyncHandler from "express-async-handler";
// import { Request, Response } from "express";
// import CreditNote from "../schemas/CreditNote";
// import { responseHandler } from "../utils/responseHandler";
// import mongoose from "mongoose";
// import SellOrder, { ISellOrder } from "../schemas/SellOrder";
// import { BadRequestError } from "../utils/errors";

// // Define interface for the populated client
// interface PopulatedClient {
//   _id: string;
//   clientName: string;
// }

// // Define interface for the lean order with populated client
// interface LeanSellOrder extends Omit<ISellOrder, "clientId"> {
//   clientId?: PopulatedClient;
// }

// const createCreditNote = asyncHandler(
//   async (req: Request, res: Response): Promise<void> => {
//     const { orderId, clientId, startDate, endDate, total } = req.body;

//     // Validate orderId is a valid ObjectId
//     if (!mongoose.Types.ObjectId.isValid(orderId)) {
//       throw new Error("Invalid order ID");
//     }

//     // Check if the order exists
//     const orderExists = await SellOrder.findById(orderId);
//     if (!orderExists) {
//       throw new Error("Order not found");
//     }

//     // Validate clientId if necessary
//     if (!mongoose.Types.ObjectId.isValid(clientId)) {
//       throw new Error("Invalid client ID");
//     }

//     await CreditNote.create({
//       userId: req.userId,
//       orderId,
//       clientId,
//       startDate,
//       endDate,
//       total,
//     });

//     responseHandler(res, 200, "Credit note created successfully", "success");
//   }
// );

// const getSellOrderForDropdown = asyncHandler(
//   async (req: Request, res: Response): Promise<void> => {
//     const { id } = req.params;

//     try {
//       const order = await SellOrder.findById(id)
//         .populate<{ clientId: PopulatedClient }>("clientId", "clientName")
//         .lean<LeanSellOrder>();

//       if (!order) {
//         throw new BadRequestError("Order not found");
//       }

//       const dropdownOrder = {
//         orderId: order.id.toString(), // Fixed: Use _id instead of id
//         clientId: order.clientId?._id?.toString() || "",
//         clientName: order.clientId?.clientName || "Unknown Client",
//         orderNumber: order.orderNumber || "N/A",
//       };

//       responseHandler(
//         res,
//         200,
//         "Dropdown order fetched successfully",
//         "success",
//         dropdownOrder
//       );
//     } catch (error) {
//       throw new BadRequestError("Order not found");
//     }
//   }
// );

// export { createCreditNote, getSellOrderForDropdown };



import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import CreditNote from "../schemas/CreditNote";
import { responseHandler } from "../utils/responseHandler";
import mongoose from "mongoose";
import SellOrder, { ISellOrder } from "../schemas/SellOrder";
import { BadRequestError } from "../utils/errors";

// Define interface for the populated client
interface PopulatedClient {
  _id: string;
  clientName: string;
}

// Define interface for the lean order with populated client
interface LeanSellOrder extends Omit<ISellOrder, "clientId"> {
  clientId?: PopulatedClient;
  total: number; // Ensure total is included
}

const createCreditNote = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { orderId, clientId, startDate, endDate, total } = req.body;

    // Validate orderId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      throw new Error("Invalid order ID");
    }

    // Check if the order exists
    const orderExists = await SellOrder.findById(orderId);
    if (!orderExists) {
      throw new Error("Order not found");
    }

    // Validate clientId if necessary
    if (!mongoose.Types.ObjectId.isValid(clientId)) {
      throw new Error("Invalid client ID");
    }

    await CreditNote.create({
      userId: req.userId,
      orderId,
      clientId,
      startDate,
      endDate,
      total,
    });

    responseHandler(res, 200, "Credit note created successfully", "success");
  }
);

const getSellOrderForDropdown = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    try {
      const order = await SellOrder.findById(id)
        .populate<{ clientId: PopulatedClient }>("clientId", "clientName")
        .lean<LeanSellOrder>();

      if (!order) {
        throw new BadRequestError("Order not found");
      }

      const dropdownOrder = {
        orderId: order.id.toString(),
        clientId: order.clientId?._id?.toString() || "",
        clientName: order.clientId?.clientName || "Unknown Client",
        orderNumber: order.orderNumber || "N/A",
        total: order.total || 0, // Include total
      };

      responseHandler(
        res,
        200,
        "Dropdown order fetched successfully",
        "success",
        dropdownOrder
      );
    } catch (error) {
      throw new BadRequestError("Order not found");
    }
  }
);

export { createCreditNote, getSellOrderForDropdown };