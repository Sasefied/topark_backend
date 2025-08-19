import asyncHandler from "express-async-handler";
import { NextFunction, Request, Response } from "express";
import Client from "../schemas/ClientDetails";
import { responseHandler } from "../utils/responseHandler";
import { AdminProduct } from "../schemas/AdminProduct";
import { BadRequestError } from "../utils/errors";
import SellOrder, { ISellOrder } from "../schemas/SellOrder";
import SellOrderItem from "../schemas/SellOrderItem";
import mongoose, { Types } from "mongoose";
import Inventory from "../schemas/Inventory";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import sendEmail from "../utils/mail";

interface InvoiceItem {
  productName: string;
  quantity: number;
  sellPrice: number;
}

interface InvoiceData {
  orderNumber: number;
  clientName: string;
  clientEmail?: string;
  clientAddress?: string;
  items: InvoiceItem[];
  total: number;
}

const generateInvoice = async (data: InvoiceData): Promise<string> => {
  const { orderNumber, clientName, clientEmail, clientAddress, items, total } =
    data;

  // Ensure invoices directory exists
  const invoiceDir = path.join(__dirname, "../invoices");
  if (!fs.existsSync(invoiceDir)) fs.mkdirSync(invoiceDir);

  const filePath = path.join(invoiceDir, `invoice_${orderNumber}.pdf`);

  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(fs.createWriteStream(filePath));

  /** ---------- HEADER ---------- */
  // Company Info
  doc
    .fontSize(20)
    .text("Your Company Name", 50, 45, { align: "left" })
    .fontSize(10)
    .text("123 Business Street", 50, 70)
    .text("City, State, ZIP", 50, 85)
    .text("Phone: +91-1234567890", 50, 100)
    .moveDown();

  // Title
  doc
    .fontSize(24)
    .text("INVOICE", 400, 45, { align: "right" })
    .fontSize(12)
    .text(`Invoice No: ${orderNumber}`, 400, 80, { align: "right" })
    .text(`Date: ${new Date().toLocaleDateString()}`, 400, 95, {
      align: "right",
    })
    .moveDown(2);

  /** ---------- CLIENT INFO ---------- */
  doc
    .fontSize(14)
    .fillColor("#444444")
    .text("Bill To:", 50, 150)
    .fontSize(12)
    .fillColor("black")
    .text(clientName, 50, 170)
    .text(clientEmail || "", 50, 185)
    .text(clientAddress || "", 50, 200)
    .moveDown(2);

  /** ---------- TABLE HEADER ---------- */
  const tableTop = 250;
  const itemSpacing = 30;

  doc
    .fontSize(12)
    .fillColor("white")
    .rect(50, tableTop, 500, 20)
    .fill("#2c3e50")
    .stroke()
    .fillColor("white")
    .text("Item", 55, tableTop + 5, { width: 200 })
    .text("Qty", 280, tableTop + 5, { width: 90, align: "center" })
    .text("Price", 370, tableTop + 5, { width: 90, align: "center" })
    .text("Total", 460, tableTop + 5, { width: 90, align: "right" });

  /** ---------- TABLE ROWS ---------- */
  let y = tableTop + 30;
  doc.fillColor("black");

  items.forEach((item, i) => {
    const rowY = y + i * itemSpacing;
    doc
      .fontSize(12)
      .text(item.productName, 55, rowY, { width: 200 })
      .text(item.quantity.toString(), 280, rowY, { width: 90, align: "center" })
      .text(item.sellPrice.toFixed(2), 370, rowY, {
        width: 90,
        align: "center",
      })
      .text((item.quantity * item.sellPrice).toFixed(2), 460, rowY, {
        width: 90,
        align: "right",
      });

    // Row line
    doc
      .moveTo(50, rowY + 20)
      .lineTo(550, rowY + 20)
      .strokeColor("#cccccc")
      .stroke();
  });

  /** ---------- TOTAL ---------- */
  const totalY = tableTop + 30 + items.length * itemSpacing + 20;

  doc
    .fontSize(14)
    .fillColor("#000")
    .text("Grand Total:", 370, totalY, { width: 90, align: "center" })
    .text(total.toFixed(2), 460, totalY, { width: 90, align: "right" });

  /** ---------- FOOTER ---------- */
  doc
    .fontSize(12)
    .fillColor("#555")
    .text("Thank you for your business!", 50, 700, {
      align: "center",
      width: 500,
    });

  doc.end();

  return filePath;
};

interface PopulatedClient {
  _id: string;
  clientName: string;
}

interface LeanSellOrder extends Omit<ISellOrder, "clientId"> {
  _id: string;
  clientId: string;
  client?: PopulatedClient;
}

const updateSellOrder = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { id } = req.params;
    const { orders } = req.body; // Array of { inventoryId, productCode, quantity, sellPrice }
    console.log("Request body:", JSON.stringify(req.body, null, 2));

    const session = await mongoose.startSession();
    await session.startTransaction();

    try {
      console.log("Finding order with ID:", id);
      const existingOrder = await SellOrder.findById(id).session(session);
      if (!existingOrder) {
        throw new BadRequestError("Order not found");
      }
      console.log("Found order:", existingOrder);

      console.log("Fetching existing order items for order ID:", id);
      const existingItems = await SellOrderItem.find({ orderId: id }).session(
        session
      );
      console.log("Existing items:", existingItems);

      // Step 1: Restore inventory for ALL existing items (add back quantities)
      for (const existingItem of existingItems) {
        const inventory = await Inventory.findById(
          existingItem.inventoryId
        ).session(session);
        if (inventory) {
          inventory.qtyInStock += existingItem.quantity;
          await inventory.save({ session });
          console.log(
            `Restored ${existingItem.quantity} to inventory ${existingItem.inventoryId}`
          );
        } else {
          console.warn(
            `Inventory not found for existing item ${existingItem.inventoryId} during restore`
          );
        }
      }

      // Step 2: Validate new/updated items (without stock check)
      let total = 0;
      for (const product of orders) {
        const { inventoryId, productCode, quantity, sellPrice } = product;
        console.log("Processing product:", product);

        console.log("Checking AdminProduct for productCode:", productCode);
        const adminProduct = await AdminProduct.findOne({
          productCode,
        }).session(session);
        if (!adminProduct) {
          throw new BadRequestError(`Invalid product code: ${productCode}`);
        }
        console.log("Found AdminProduct:", adminProduct);

        console.log("Checking Inventory for inventoryId:", inventoryId);
        const inventory = await Inventory.findOne({
          _id: inventoryId,
          adminProductId: adminProduct._id,
        }).session(session);
        if (!inventory) {
          throw new BadRequestError(
            `Inventory not found for product ${productCode}`
          );
        }
        console.log("Found Inventory:", inventory);

        // Accumulate total
        total += sellPrice * quantity;
      }

      // Step 3: Delete existing order items
      console.log("Deleting existing order items for order ID:", id);
      await SellOrderItem.deleteMany({ orderId: id }).session(session);
      console.log("Deleted existing order items");

      // Step 4: Insert new order items
      const sellOrderItems = orders.map((product: any) => ({
        orderId: id,
        inventoryId: product.inventoryId,
        quantity: product.quantity,
        sellPrice: product.sellPrice,
      }));
      console.log("New order items:", sellOrderItems);

      await SellOrderItem.insertMany(sellOrderItems, { session });
      console.log("Inserted new order items");

      // Step 5: Update order total
      console.log("Calculated new total:", total);
      console.log("Updating order total...");
      await SellOrder.updateOne({ _id: id }, { $set: { total } }, { session });
      console.log("Updated order total");

      await session.commitTransaction();
      console.log("Transaction committed");
      responseHandler(res, 200, "Order updated successfully", "success", {
        orderId: id,
      });
    } catch (error: any) {
      console.error("Error in updateSellOrder:", error.message, error.stack);
      await session.abortTransaction();
      next(error);
    } finally {
      await session.endSession();
      console.log("Session ended");
    }
  }
);

// Other functions (unchanged)
const searchAllClients = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { page = 1, limit = 10, query } = req.query;

    const clientAggregate = Client.aggregate([
      { $match: { clientName: { $regex: query, $options: "i" } } },
      {
        $project: {
          _id: 1,
          clientName: 1,
        },
      },
    ]);

    const clients = await (Client as any).aggregatePaginate(clientAggregate, {
      page,
      limit,
      customLabels: {
        docs: "clients",
        totalDocs: "totalClients",
      },
    });

    responseHandler(
      res,
      200,
      "Clients fetched successfully",
      "success",
      clients
    );
  }
);

const searchProductCode = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { query } = req.query;

    const products = await Inventory.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(req.userId),
        },
      },
      {
        $lookup: {
          from: "adminproducts",
          localField: "adminProductId",
          foreignField: "_id",
          as: "adminProduct",
        },
      },
      {
        $unwind: {
          path: "$adminProduct",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $match: {
          "adminProduct.productCode": {
            $regex: query,
            $options: "i",
          },
        },
      },
      {
        $project: {
          inventoryId: "$_id",
          productCode: "$adminProduct.productCode",
          productName: "$adminProduct.productName",
          qtyInStock: 1,
          qtyIncoming: 1,
          pricePerUnit: 1,
        },
      },
    ]);

    responseHandler(
      res,
      200,
      "Products fetched successfully",
      "success",
      products
    );
  }
);

const createSellOrder = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { orderItems, clientId, shipToday } = req.body;
    const session = await mongoose.startSession();
    await session.startTransaction();

    try {
      let total = 0;
      const sellOrderItems: any[] = [];

      for (const order of orderItems) {
        const { inventoryId, productCode, quantity, sellPrice } = order;

        const product = await AdminProduct.findOne({ productCode }).session(
          session
        );
        if (!product)
          throw new BadRequestError(`Invalid product code: ${productCode}`);

        const inventory = await Inventory.findOne({
          _id: inventoryId,
          adminProductId: product._id,
        }).session(session);
        if (!inventory)
          throw new BadRequestError(`Inventory not found for ${productCode}`);

        total += sellPrice * quantity;

        sellOrderItems.push({
          inventoryId,
          quantity,
          sellPrice,
          productName: product.productName,
        });

        inventory.qtyInStock -= quantity;
        await inventory.save({ session });
      }

      const lastOrderNumber = await SellOrder.findOne(
        {},
        { orderNumber: 1 },
        { sort: { createdAt: -1 } }
      ).session(session);

      const newOrder: ISellOrder = (
        await SellOrder.create(
          [
            {
              userId: req.userId,
              clientId,
              orderNumber: (lastOrderNumber?.orderNumber || 0) + 1,
              total,
              shipToday,
            },
          ],
          { session }
        )
      )[0];

      const sellOrderItemDocs = sellOrderItems.map((item) => ({
        ...item,
        orderId: newOrder._id,
      }));
      await SellOrderItem.insertMany(sellOrderItemDocs, { session });

      await session.commitTransaction();

      const client = await Client.findById(clientId).select("clientName clientEmail deliveryAddress").session(session);
      if (!client) {
        throw new BadRequestError(`Client not found for ${clientId}`);
      }

      // ✅ Generate Invoice
      const invoicePath = await generateInvoice({
        orderNumber: newOrder.orderNumber,
        clientName: client.clientName,
        clientEmail: client.clientEmail,
        clientAddress: client.deliveryAddress,
        items: sellOrderItems,
        total,
      });

      const invoiceUrl = `${req.protocol}://${req.hostname}/${`invoice_${newOrder.orderNumber}.pdf`}`;

      newOrder.invoiceUrl = invoiceUrl;
      await newOrder.save();

      await sendEmail({
        //to: client.clientEmail,
        to: "saifmd9536@gmail.com",
        subject: `Invoice for Order #${newOrder.orderNumber}`,
        html: `
          <p>Dear ${client.clientName},</p>
          <p>Thank you for your order! Please find your invoice for Order #${newOrder.orderNumber} attached.</p>

          <h3>Order Details:</h3>
          <table border="1" cellspacing="0" cellpadding="6">
          <thead>
          <tr>
            <th>Product</th>
            <th>Quantity</th>
            <th>Sell Price</th>
            <th>Subtotal</th>
          </tr>
          </thead>
          <tbody>
          ${sellOrderItems
            .map(
              (item) =>
                `<tr>
              <td>${item.productName}</td>
              <td>${item.quantity}</td>
              <td>${item.sellPrice}</td>
              <td>${(item.quantity * item.sellPrice).toFixed(2)}</td>
            </tr>`
            )
            .join("")}
          <tr>
            <td colspan="3"><strong>Total</strong></td>
            <td><strong>${total.toFixed(2)}</strong></td>
          </tr>
          </tbody>
          </table>
          <p>Shipping: ${shipToday ? "Ship today" : "Standard shipping"}</p>

          <p>If you have any questions, please reply to this email.</p>
          <p>Best regards,<br/>Your Company Name</p>
        `,
        attachments: [{
          filename: `invoice-${newOrder.orderNumber}.pdf`,
          path: invoicePath
        }],
      });

      responseHandler(res, 200, "Order created successfully", "success");
    } catch (error) {
      await session.abortTransaction();
      next(error);
    } finally {
      await session.endSession();
    }
  }
);

const getLastSellOrder = asyncHandler(async (req: Request, res: Response) => {
  const lastOrder = await SellOrder.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(req.userId),
      },
    },
    {
      $sort: { createdAt: -1 },
    },
    {
      $limit: 1,
    },
    {
      $lookup: {
        from: "sellorderitems",
        localField: "_id",
        foreignField: "orderId",
        as: "orderItems",
      },
    },
    {
      $lookup: {
        from: "inventories",
        localField: "orderItems.inventoryId",
        foreignField: "_id",
        as: "inventory",
      },
    },
    {
      $unwind: {
        path: "$inventory",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: "adminproducts",
        localField: "inventory.adminProductId",
        foreignField: "_id",
        as: "adminProduct",
      },
    },
    {
      $unwind: {
        path: "$adminProduct",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        _id: 1,
        userId: 1,
        clientId: 1,
        orderNumber: 1,
        total: 1,
        orderItems: {
          $map: {
            input: "$orderItems",
            as: "item",
            in: {
              inventoryId: "$$item.inventoryId",
              quantity: "$$item.quantity",
              sellPrice: "$$item.sellPrice",
              productCode: "$adminProduct.productCode",
            },
          },
        },
      },
    },
  ]);

  responseHandler(
    res,
    200,
    "Order fetched successfully",
    "success",
    lastOrder[0] || null
  );
});

const getMostReorderedOrder = asyncHandler(
  async (req: Request, res: Response) => {
    const { clientId } = req.query;

    if (
      !clientId ||
      typeof clientId !== "string" ||
      !mongoose.Types.ObjectId.isValid(clientId)
    ) {
      throw new BadRequestError("Invalid client ID");
    }

    const mostReorderedItems = await SellOrderItem.aggregate([
      {
        $match: {
          inventoryId: { $exists: true, $type: "objectId" },
        },
      },
      {
        $lookup: {
          from: "sellorders",
          localField: "orderId",
          foreignField: "_id",
          as: "order",
        },
      },
      {
        $unwind: {
          path: "$order",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $match: {
          "order.userId": new mongoose.Types.ObjectId(req.userId),
          "order.clientId": new mongoose.Types.ObjectId(clientId),
        },
      },
      {
        $lookup: {
          from: "inventories",
          localField: "inventoryId",
          foreignField: "_id",
          as: "inventory",
        },
      },
      {
        $unwind: {
          path: "$inventory",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "adminproducts",
          localField: "inventory.adminProductId",
          foreignField: "_id",
          as: "adminProduct",
        },
      },
      {
        $unwind: {
          path: "$adminProduct",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $match: {
          "inventory._id": { $exists: true },
          "adminProduct._id": { $exists: true },
        },
      },
      {
        $group: {
          _id: "$inventoryId",
          orderCount: { $sum: 1 },
          quantity: { $max: "$quantity" },
          sellPrice: { $max: "$sellPrice" },
          productCode: { $first: "$adminProduct.productCode" },
          inventoryId: { $first: "$inventoryId" },
        },
      },
      {
        $sort: { orderCount: -1 },
      },
      {
        $limit: 10,
      },
      {
        $project: {
          inventoryId: 1,
          productCode: 1,
          quantity: 1,
          sellPrice: 1,
          orderCount: 1,
        },
      },
    ]);

    if (!mostReorderedItems || mostReorderedItems.length === 0) {
      return responseHandler(
        res,
        200,
        "No reordered items found for this client",
        "success",
        {
          _id: null,
          userId: req.userId,
          clientId,
          orderNumber: null,
          total: 0,
          orderItems: [],
        }
      );
    }

    const total = mostReorderedItems.reduce(
      (sum, item) => sum + item.sellPrice * item.quantity,
      0
    );
    const order = {
      _id: null,
      userId: req.userId,
      clientId,
      orderNumber: null,
      total,
      orderItems: mostReorderedItems.map((item) => ({
        inventoryId: item.inventoryId,
        productCode: item.productCode || null,
        quantity: item.quantity,
        sellPrice: item.sellPrice,
      })),
    };

    responseHandler(
      res,
      200,
      "Most reordered items fetched successfully",
      "success",
      order
    );
  }
);

const getAllSellOrder = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { page = "1", limit = "10", search = "" } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);

    try {
      const query: any = {};
      if (search) {
        // Convert orderNumber to string for regex matching
        query.$or = [
          {
            $expr: {
              $regexMatch: {
                input: { $toString: "$orderNumber" },
                regex: search,
                options: "i",
              },
            },
          },
          { "client.clientName": { $regex: search, $options: "i" } },
        ];
      }

      const aggregate = SellOrder.aggregate([
        {
          $match: { userId: new Types.ObjectId(req.userId) },
        },
        {
          $lookup: {
            from: "clients",
            localField: "clientId",
            foreignField: "_id",
            as: "client",
          },
        },
        { $unwind: { path: "$client", preserveNullAndEmptyArrays: true } },
        { $match: query },
        { $sort: { createdAt: -1 } },
      ]);

      const options = {
        page: pageNum,
        limit: limitNum,
        lean: true,
      };

      const result = await (SellOrder as any).aggregatePaginate(
        aggregate,
        options
      );

      const orders: LeanSellOrder[] = result.docs.map((doc: any) => ({
        _id: doc._id.toString(),
        userId: doc.userId.toString(),
        clientId: doc.clientId.toString(),
        client: doc.client
          ? {
              _id: doc.client._id.toString(),
              clientName: doc.client.clientName,
            }
          : undefined,
        orderNumber: doc.orderNumber,
        total: doc.total,
        shipToday: doc.shipToday,
        status: doc.status,
        createdAt: doc.createdAt,
      }));

      responseHandler(res, 200, "Orders fetched successfully", "success", {
        orders,
        totalPages: result.totalPages,
        currentPage: result.page,
        totalOrders: result.totalDocs,
      });
    } catch (error) {
      console.error("Error fetching orders:", error);
      throw new Error("Failed to fetch orders");
    }
  }
);

// const getSellOrderById = asyncHandler(
//   async (req: Request, res: Response): Promise<void> => {
//     const { id } = req.params;

//     const orders = await SellOrder.aggregate([
//       { $match: { _id: new mongoose.Types.ObjectId(id) } },
//       {
//         $lookup: {
//           from: "clients",
//           localField: "clientId",
//           foreignField: "_id",
//           as: "client",
//         },
//       },
//       { $unwind: { path: "$client", preserveNullAndEmptyArrays: true } },
//       {
//         $lookup: {
//           from: "sellorderitems",
//           localField: "_id",
//           foreignField: "orderId",
//           as: "orderItems",
//         },
//       },
//       {
//         $lookup: {
//           from: "inventories",
//           localField: "orderItems.inventoryId",
//           foreignField: "_id",
//           as: "inventory",
//         },
//       },
//       {
//         $lookup: {
//           from: "adminproducts",
//           localField: "inventory.adminProductId",
//           foreignField: "_id",
//           as: "adminProduct",
//         },
//       },
//       {
//         $project: {
//           _id: 1,
//           orderNumber: 1,
//           total: 1,
//           createdAt: 1,
//           "client._id": 1,
//           "client.clientName": 1,
//           orderItems: {
//             $map: {
//               input: "$orderItems",
//               as: "item",
//               in: {
//                 inventoryId: "$$item.inventoryId",
//                 quantity: "$$item.quantity",
//                 sellPrice: "$$item.sellPrice",
//                 productCode: {
//                   $arrayElemAt: [
//                     "$adminProduct.productCode",
//                     {
//                       $indexOfArray: ["$inventory._id", "$$item.inventoryId"],
//                     },
//                   ],
//                 },
//               },
//             },
//           },
//         },
//       },
//     ]);

//     if (!orders || orders.length === 0) {
//       throw new Error("Order not found");
//     }

//     responseHandler(
//       res,
//       200,
//       "Order fetched successfully",
//       "success",
//       orders[0]
//     );
//   }
// );
// Already updated in your provided code
const getSellOrderById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    console.log(`Fetching order by ID: ${id}`);

    const orders = await SellOrder.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(id) } },
      {
        $lookup: {
          from: "clients",
          localField: "clientId",
          foreignField: "_id",
          as: "client",
        },
      },
      { $unwind: { path: "$client", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "sellorderitems",
          localField: "_id",
          foreignField: "orderId",
          as: "orderItems",
        },
      },
      {
        $lookup: {
          from: "inventories",
          localField: "orderItems.inventoryId",
          foreignField: "_id",
          as: "inventory",
        },
      },
      {
        $lookup: {
          from: "adminproducts",
          localField: "inventory.adminProductId",
          foreignField: "_id",
          as: "adminProduct",
        },
      },
      {
        $addFields: {
          orderItems: {
            $map: {
              input: "$orderItems",
              as: "item",
              in: {
                inventoryId: "$$item.inventoryId",
                quantity: "$$item.quantity",
                sellPrice: "$$item.sellPrice",
                productCode: {
                  $arrayElemAt: [
                    "$adminProduct.productCode",
                    {
                      $indexOfArray: ["$inventory._id", "$$item.inventoryId"],
                    },
                  ],
                },
              },
            },
          },
        },
      },
      {
        $project: {
          _id: 1,
          orderNumber: 1,
          total: 1,
          createdAt: 1,
          "client._id": 1,
          "client.clientName": 1,
          orderItems: 1,
        },
      },
    ]);

    if (!orders || orders.length === 0) {
      console.warn(`Order not found for ID: ${id}`);
      throw new BadRequestError("Order not found");
    }

    console.log(
      "getSellOrderById response:",
      JSON.stringify(orders[0], null, 2)
    );
    responseHandler(
      res,
      200,
      "Order fetched successfully",
      "success",
      orders[0]
    );
  }
);
const deleteSellOrder = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const session = await mongoose.startSession();
    await session.startTransaction();

    try {
      const order = await SellOrder.findById(id).session(session);
      if (!order) {
        throw new BadRequestError("Order not found");
      }

      // Delete all order items associated with the order
      await SellOrderItem.deleteMany({ orderId: id }).session(session);

      // Delete the order
      await SellOrder.deleteOne({ _id: id }).session(session);

      await session.commitTransaction();
      responseHandler(res, 200, "Order deleted successfully", "success");
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }
);

export {
  searchAllClients,
  searchProductCode,
  createSellOrder,
  getSellOrderById,
  updateSellOrder,
  deleteSellOrder,
  getLastSellOrder,
  getMostReorderedOrder,
  getAllSellOrder,
};
