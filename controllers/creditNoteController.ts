


import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import CreditNote, { ICreditNote } from "../schemas/CreditNote";
import SellOrder from "../schemas/SellOrder";
import SellOrderItem from "../schemas/SellOrderItem";
import { responseHandler } from "../utils/responseHandler";
import mongoose from "mongoose";
import { BadRequestError } from "../utils/errors";
import Client from "../schemas/ClientDetails";
import path from "path";
import fs from "fs";
import PDFDocument from "pdfkit";

// Define interface for populated client
interface PopulatedClient {
  _id: string;
  clientName: string;
}

// Define interface for populated order
interface PopulatedOrder {
  _id: string;
  orderNumber: number;
  status: string;
}

// Define interface for the lean credit note with populated fields
interface LeanCreditNote extends Omit<ICreditNote, "clientId" | "orderId"> {
  _id: mongoose.Types.ObjectId;
  clientId?: PopulatedClient;
  orderId?: PopulatedOrder;
  total: number;
  createdAt?: Date;
}

const createCreditNote = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { orderId, clientId, startDate, endDate, total } = req.body;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      throw new Error("Invalid order ID");
    }

    const order = await SellOrder.findById(orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    if (!mongoose.Types.ObjectId.isValid(clientId)) {
      throw new Error("Invalid client ID");
    }

    const client = await Client.findById(clientId);
    if (!client) {
      throw new Error("Client not found");
    }

    const creditNote  = await CreditNote.create({
      userId: req.userId,
      orderId,
      clientId,
      startDate,
      endDate,
      total,
    });

    // Create directory for credit notes
    const creditNoteDir = path.resolve(process.cwd(), "invoices");
    if (!fs.existsSync(creditNoteDir)) {
      fs.mkdirSync(creditNoteDir, { recursive: true });
    }

    // Define file path for PDF
    const filePath = path.join(creditNoteDir, `credit_note_${creditNote._id}.pdf`);

    // Generate PDF
    const doc = new PDFDocument({ margin: 50 });
    
    // Save PDF to file
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    // Header
    doc.fillColor('#444444')
      .fontSize(20)
      .text('Credit Note', 50, 57);

    // Credit Note Details
    const detailsY = 100;
    doc.fontSize(10)
      .text('Credit Note Number:', 50, detailsY)
      .text(creditNote._id.toString(), 200, detailsY)
      .text('Date Issued:', 50, detailsY + 15)
      .text(new Date().toLocaleDateString(), 200, detailsY + 15)
      .text('Reference Order:', 50, detailsY + 30)
      .text(orderId.toString(), 200, detailsY + 30)
      .text('Period:', 50, detailsY + 45)
      .text(`${startDate} to ${endDate}`, 200, detailsY + 45);

    // Client Information
    const clientY = detailsY + 80;
    doc.text('Bill To:', 50, clientY)
      .font('Helvetica-Bold')
      .text(client.clientName, 50, clientY + 15)
      .font('Helvetica')
      .text(client.registeredAddress || client.deliveryAddress || 'N/A', 50, clientY + 30)
      .text(client.clientEmail || '', 50, clientY + 45);

    // Fetch items for this order
    const sellOrderItems = await SellOrderItem.find({ orderId: order._id })
      .populate({
        path: 'inventoryId',
        populate: { path: 'adminProductId', model: 'AdminProduct', select: 'productName size color variety' },
      })
      .lean();

    // Items Table
    let tableY = clientY + 80;
    doc.moveTo(50, tableY - 10).lineTo(550, tableY - 10).stroke();
    doc.fontSize(10)
      .text('Description', 50, tableY)
      .text('Qty', 200, tableY)
      .text('Unit Price', 250, tableY)
      .text('Total', 350, tableY);
    tableY += 20;
    doc.moveTo(50, tableY - 10).lineTo(550, tableY - 10).stroke();

    let subtotal = 0;
    if (sellOrderItems && sellOrderItems.length > 0) {
      sellOrderItems.forEach((item: any, index: number) => {
        const itemY = tableY + (index * 20);
        const adminProd = item?.inventoryId?.adminProductId as any;
        const description = [
          adminProd?.productName,
          adminProd?.variety,
          adminProd?.size,
          adminProd?.color,
          item?.inventoryId?.grade,
        ]
          .filter(Boolean)
          .join(' - ') || 'N/A';
        const qty = item?.quantity || 0;
        const unitPrice = item?.sellPrice || 0;
        const lineTotal = qty * unitPrice;
        doc.text(description, 50, itemY)
          .text(qty.toString(), 200, itemY)
          .text(unitPrice.toFixed(2), 250, itemY)
          .text(lineTotal.toFixed(2), 350, itemY);
        subtotal += lineTotal;
      });
      tableY += (sellOrderItems.length * 20);
    } else {
      doc.text('No items to credit', 50, tableY);
      tableY += 20;
    }

    // Total
    doc.moveTo(50, tableY).lineTo(550, tableY).stroke();
    doc.text('Total Credit Amount:', 350, tableY + 15, { align: 'right' })
      .font('Helvetica-Bold')
      .text(subtotal.toFixed(2), 550, tableY + 15, { align: 'right', width: 100 });

    // Footer
    doc.moveDown(10);
    doc.fontSize(8)
      .text('Thank you for your business.', 50, doc.y, { align: 'center', width: 500 });

    doc.end();

    // Wait for PDF generation to complete
    await new Promise<void>((resolve, reject) => {
      writeStream.on('finish', () => resolve());
      writeStream.on('error', (err) => reject(new Error(`Failed to save credit note PDF: ${err.message}`)));
    });

    // Construct URL for the credit note
    const creditNoteUrl = process.env.NODE_ENV === "production"
      ? `https://topark-backend.onrender.com/credit_note_${creditNote._id}.pdf`
      : `http://localhost:${process.env.PORT}/credit_note_${creditNote._id}.pdf`;

    // Save the URL to the CreditNote document
    creditNote.url = creditNoteUrl;
    await creditNote.save();

    // Send response with the URL
    responseHandler(res, 200, "Credit note created successfully", "success", { creditNoteUrl });
  }
);

const getSellOrderForDropdown = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    try {
      const order = await SellOrder.findById(id)
        .populate<{ clientId: PopulatedClient }>("clientId", "clientName")
        .lean();

      if (!order) {
        throw new BadRequestError("Order not found");
      }

      const dropdownOrder = {
        orderId: order._id.toString(),
        clientId: order.clientId?._id?.toString() || "",
        clientName: order.clientId?.clientName || "Unknown Client",
        orderNumber: order.orderNumber || "N/A",
        total: order.total || 0,
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

const getActiveCreditNotes = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || "";

    try {
      const pipeline: any[] = [
        {
          $match: {
            userId: new mongoose.Types.ObjectId(req.userId),
            endDate: { $gte: new Date() },
          },
        },
        {
          $lookup: {
            from: "clients",
            localField: "clientId",
            foreignField: "_id",
            as: "clientId",
          },
        },
        {
          $unwind: {
            path: "$clientId",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "sellorders",
            localField: "orderId",
            foreignField: "_id",
            as: "orderId",
          },
        },
        {
          $unwind: {
            path: "$orderId",
            preserveNullAndEmptyArrays: true,
          },
        },
      ];

      if (search) {
        pipeline.push({
          $match: {
            $or: [
              { "clientId.clientName": { $regex: search, $options: "i" } },
              { "orderId.orderNumber": { $regex: search, $options: "i" } },
            ],
          },
        });
      }

      pipeline.push({
        $sort: { createdAt: -1 },
      });

      const aggregate = CreditNote.aggregate(pipeline);
      const options = { page, limit };
      const result = await (CreditNote as any).aggregatePaginate(aggregate, options);

      console.log("Aggregation result.docs:", JSON.stringify(result.docs, null, 2));

      const creditNotes = result.docs.map((note: LeanCreditNote) => ({
        _id: note._id.toString(),
        orderId: note.orderId?._id?.toString() || "",
        clientId: note.clientId?._id?.toString() || "",
        clientName: note.clientId?.clientName || "Unknown Client",
        orderNumber: note.orderId?.orderNumber || "N/A",
        total: note.total || 0,
        status: note.orderId?.status || "ORDER_PRINTED",
        startDate: note.startDate,
        endDate: note.endDate,
        createdAt: note.createdAt,
      }));

      const responseData = {
        creditNotes,
        totalPages: result.totalPages,
        totalDocs: result.totalDocs,
        page: result.page,
        limit: result.limit,
      };

      responseHandler(
        res,
        200,
        "Active credit notes fetched successfully",
        "success",
        responseData
      );
    } catch (error: any) {
      console.error("Error fetching active credit notes:", error);
      throw new BadRequestError("Failed to fetch active credit notes");
    }
  }
);

const getAllCreditNotes = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || "";

    try {
      const pipeline: any[] = [
         {
          $match: {
            userId: new mongoose.Types.ObjectId(req.userId)
          },
        },
        {
          $lookup: {
            from: "clients",
            localField: "clientId",
            foreignField: "_id",
            as: "clientId",
          },
        },
        {
          $unwind: {
            path: "$clientId",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "sellorders",
            localField: "orderId",
            foreignField: "_id",
            as: "orderId",
          },
        },
        {
          $unwind: {
            path: "$orderId",
            preserveNullAndEmptyArrays: true,
          },
        },
      ];

      if (search) {
        pipeline.push({
          $match: {
            $or: [
              { "clientId.clientName": { $regex: search, $options: "i" } },
              { "orderId.orderNumber": { $regex: search, $options: "i" } },
            ],
          },
        });
      }

      pipeline.push({
        $sort: { createdAt: -1 },
      });

      const aggregate = CreditNote.aggregate(pipeline);
      const options = { page, limit };
      const result = await (CreditNote as any).aggregatePaginate(aggregate, options);

      console.log("Aggregation result.docs (all):", JSON.stringify(result.docs, null, 2));

      const creditNotes = result.docs.map((note: LeanCreditNote) => ({
        _id: note._id.toString(),
        orderId: note.orderId?._id?.toString() || "",
        clientId: note.clientId?._id?.toString() || "",
        clientName: note.clientId?.clientName || "Unknown Client",
        orderNumber: note.orderId?.orderNumber || "N/A",
        total: note.total || 0,
        status: note.orderId?.status || "ORDER_PRINTED",
        startDate: note.startDate,
        endDate: note.endDate,
        createdAt: note.createdAt,
      }));

      const responseData = {
        creditNotes,
        totalPages: result.totalPages,
        totalDocs: result.totalDocs,
        page: result.page,
        limit: result.limit,
      };

      responseHandler(
        res,
        200,
        "Credit notes fetched successfully",
        "success",
        responseData
      );
    } catch (error: any) {
      console.error("Error fetching credit notes:", error);
      throw new BadRequestError("Failed to fetch credit notes");
    }
  }
);

export { createCreditNote, getSellOrderForDropdown, getActiveCreditNotes, getAllCreditNotes };