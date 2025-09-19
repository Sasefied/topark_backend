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
import { OrderStatusEnum } from "../api/constants";

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

  const invoiceDir = path.resolve(process.cwd(), "invoices");
  if (!fs.existsSync(invoiceDir)) fs.mkdirSync(invoiceDir, { recursive: true });

  const filePath = path.join(invoiceDir, `invoice_${orderNumber}.pdf`);

  const doc = new PDFDocument({
    margin: 30,
    size: "A4",
  });
  doc.pipe(fs.createWriteStream(filePath));

  // Perforation holes on both sides
  const drawPerforationHoles = () => {
    const holeSpacing = 25;
    const holeRadius = 4;
    for (let y = 40; y < doc.page.height - 40; y += holeSpacing) {
      // Left side holes
      doc.circle(15, y, holeRadius).fillAndStroke("#ffffff", "#000000");
      // Right side holes
      doc
        .circle(doc.page.width - 15, y, holeRadius)
        .fillAndStroke("#ffffff", "#000000");
    }
  };
  drawPerforationHoles();

  // Top-left company info
  doc
    .fontSize(10)
    .fillColor("#000000")
    .text("SALES TICKET", 40, 40)
    .fontSize(8)
    .text("Company Number: 05989080", 40, 55)
    .text("Vat No: GB 925 7101 37", 40, 70)
    .text("Acc. No.", 40, 85);

  // Account number box
  doc.rect(40, 100, 80, 25).stroke("#000000");
  doc.fontSize(14).text("5611", 60, 108);

  // Company logo placeholder and info (right side)
  // Logo placeholder
  doc.rect(320, 40, 80, 50).stroke("#000000");
  doc.fontSize(10).text("LOGO", 350, 60);

  // Company details
  doc
    .fontSize(16)
    .text("Toprak Uk Ltd.", 420, 45)
    .fontSize(9)
    .text("Stand 60, New Spitalfields Market,", 420, 65)
    .text("Sherrin Road", 420, 77)
    .text("Leyton, E10 5SQ", 420, 89)
    .text("Tel: 0208 539 9090", 420, 101)
    .text("Fax: 0207 6917 117", 420, 113)
    .text("Email: info@toprak.uk.com", 420, 125)
    .text("www.toprak.uk.com", 420, 137);

  // Client info section with border
  const clientStartY = 160;
  doc.rect(40, clientStartY, 250, 80).stroke("#000000");

  doc.fontSize(12).text(clientName, 45, clientStartY + 10);

  // Handle client address properly
  const addressLines = clientAddress ? clientAddress.split("\n") : [];
  let clientY = clientStartY + 25;

  addressLines.forEach((line) => {
    doc.text(line.trim(), 45, clientY);
    clientY += 12;
  });

  // S/L BAL
  doc.fontSize(10).text("S/L BAL : 1112.50", 45, clientStartY + 60);

  // Invoice details section - create proper table structure
  const detailsStartY = 260;

  // Create bordered sections for invoice details
  doc.rect(40, detailsStartY, 520, 25).stroke("#000000");

  // Vertical dividers
  const detailCols = [40, 90, 170, 250, 320, 400, 480, 560];
  for (let i = 1; i < detailCols.length - 1; i++) {
    doc
      .moveTo(detailCols[i], detailsStartY)
      .lineTo(detailCols[i], detailsStartY + 25)
      .stroke();
  }

  // Detail headers and values
  doc
    .fontSize(8)
    .text("SLMN", 45, detailsStartY + 5)
    .text("TICKET", 95, detailsStartY + 5)
    .text("DATE", 255, detailsStartY + 5)
    .text("TIME", 325, detailsStartY + 5)
    .text("PAGES", 405, detailsStartY + 5)
    .fontSize(9)
    .text("965972", 175, detailsStartY + 15)
    .text("20/08/25", 255, detailsStartY + 15)
    .text("07:36", 325, detailsStartY + 15)
    .text("1/1", 485, detailsStartY + 15);

  // Title
  const titleY = detailsStartY + 40;
  doc.fontSize(14).text("Despatch Note / Invoice", 40, titleY, {
    width: 520,
    align: "center",
  });

  // Main items table
  const tableStartY = titleY + 25;

  // Table header with grey background
  doc.rect(40, tableStartY, 520, 20).fillAndStroke("#ffffff", "#000000");

  // Column positions
  const tableCols = [40, 120, 350, 420, 490, 540, 560];

  // Column dividers
  for (let i = 1; i < tableCols.length - 1; i++) {
    doc
      .moveTo(tableCols[i], tableStartY)
      .lineTo(tableCols[i], tableStartY + 20)
      .stroke();
  }

  // Table headers
  doc
    .fillColor("#000000")
    .fontSize(9)
    .text("QUANTITY", 45, tableStartY + 6)
    .text("PRODUCT DESCRIPTION", 125, tableStartY + 6)
    .text("PRICE", 355, tableStartY + 6)
    .text("VALUE SOLD", 425, tableStartY + 6)
    .text("VC", 495, tableStartY + 6);

  // Items rows
  let currentRowY = tableStartY + 20;
  const rowHeight = 22;
  const calculatedTotal = items.reduce(
    (sum, item) => sum + item.quantity * item.sellPrice,
    0
  );

  items.forEach((item) => {
    // Row border
    doc.rect(40, currentRowY, 520, rowHeight).stroke("#000000");

    // Column dividers
    for (let i = 1; i < tableCols.length - 1; i++) {
      doc
        .moveTo(tableCols[i], currentRowY)
        .lineTo(tableCols[i], currentRowY + rowHeight)
        .stroke();
    }

    // Item data
    doc
      .fontSize(10)
      .text(item.quantity.toString(), 45, currentRowY + 6)
      .text(item.productName, 125, currentRowY + 6, { width: 220 })
      .text(item.sellPrice.toFixed(2), 355, currentRowY + 6, {
        width: 60,
        align: "right",
      })
      .text((item.quantity * item.sellPrice).toFixed(2), 425, currentRowY + 6, {
        width: 60,
        align: "right",
      })
      .text("0", 495, currentRowY + 6, { width: 40, align: "center" });

    currentRowY += rowHeight;
  });

  // Total Packages row with light grey background
  doc.rect(40, currentRowY, 520, rowHeight).fillAndStroke("#ffffff", "#000000");

  // Column dividers for total row
  for (let i = 1; i < tableCols.length - 1; i++) {
    doc
      .moveTo(tableCols[i], currentRowY)
      .lineTo(tableCols[i], currentRowY + rowHeight)
      .stroke();
  }

  doc
    .fontSize(10)
    .text("1", 45, currentRowY + 6)
    .text("Total Packages", 125, currentRowY + 6)
    .text("", 355, currentRowY + 6)
    .text(calculatedTotal.toFixed(2), 425, currentRowY + 6, {
      width: 60,
      align: "right",
    })
    .text("", 495, currentRowY + 6);

  // VAT Summary section
  const vatSectionY = currentRowY + 40;

  // Left side VAT table
  const vatTableX = 40;
  const vatTableWidth = 300;
  const vatTableHeight = 100;

  // VAT table border
  doc
    .rect(vatTableX, vatSectionY, vatTableWidth, vatTableHeight)
    .stroke("#000000");

  // VAT table header with grey background
  doc
    .rect(vatTableX, vatSectionY, vatTableWidth, 20)
    .fillAndStroke("#ffffff", "#000000");

  // VAT column positions
  const vatCols = [40, 70, 120, 200, 280, 340];

  // VAT column dividers
  for (let i = 1; i < vatCols.length - 1; i++) {
    doc
      .moveTo(vatCols[i], vatSectionY)
      .lineTo(vatCols[i], vatSectionY + vatTableHeight)
      .stroke();
  }

  // VAT headers
  doc
    .fillColor("#000000")
    .fontSize(9)
    .text("VC", 45, vatSectionY + 6)
    .text("RATE", 85, vatSectionY + 6)
    .text("GOODS", 140, vatSectionY + 6)
    .text("VAT AMOUNT", 210, vatSectionY + 6);

  // VAT data rows
  const vatData = [
    { vc: "0", rate: "0.00", goods: calculatedTotal.toFixed(2), vat: "0.00" },
    { vc: "1", rate: "0.00", goods: "0.00", vat: "0.00" },
    { vc: "2", rate: "20.00", goods: "0.00", vat: "0.00" },
    { vc: "3", rate: "5.00", goods: "0.00", vat: "0.00" },
    { vc: "4", rate: "", goods: "", vat: "" },
  ];

  vatData.forEach((row, index) => {
    const rowY = vatSectionY + 20 + index * 16;

    // Horizontal line
    doc
      .moveTo(vatTableX, rowY)
      .lineTo(vatTableX + vatTableWidth, rowY)
      .stroke();

    doc
      .fontSize(9)
      .text(row.vc, 45, rowY + 4)
      .text(row.rate, 75, rowY + 4, { width: 40, align: "center" })
      .text(row.goods, 125, rowY + 4, { width: 70, align: "center" })
      .text(row.vat, 205, rowY + 4, { width: 70, align: "center" });
  });

  // Right side totals box
  const totalsX = 400;
  const totalsY = vatSectionY + 10;
  const totalsWidth = 140;
  const totalsHeight = 60;

  doc.rect(totalsX, totalsY, totalsWidth, totalsHeight).stroke("#000000");

  // Totals content
  doc
    .fontSize(10)
    .text("GOODS", totalsX + 10, totalsY + 10)
    .text(calculatedTotal.toFixed(2), totalsX + 80, totalsY + 10, {
      width: 50,
      align: "right",
    })
    .text("V.A.T.", totalsX + 10, totalsY + 25)
    .text("0.00", totalsX + 80, totalsY + 25, { width: 50, align: "right" })
    .text("TOTAL E. & O.E", totalsX + 10, totalsY + 40)
    .text(calculatedTotal.toFixed(2), totalsX + 80, totalsY + 40, {
      width: 50,
      align: "right",
    });

  // Lines in totals box
  doc
    .moveTo(totalsX, totalsY + 20)
    .lineTo(totalsX + totalsWidth, totalsY + 20)
    .stroke();
  doc
    .moveTo(totalsX, totalsY + 35)
    .lineTo(totalsX + totalsWidth, totalsY + 35)
    .stroke();

  // Payment terms
  doc.fontSize(11).text("7 DAYS NETT", totalsX + 20, totalsY + 75);

  // Conditions
  const conditionsY = vatSectionY + 110;
  doc
    .fillColor("#000000")
    .fontSize(8)
    .text(
      "Conditions: 1. Any shortages or claims must be reported within 24 hours of sale.",
      40,
      conditionsY
    )
    .text(
      "           2. Payments not made on due date bear interest from the date of the invoice",
      40,
      conditionsY + 12
    )
    .text(
      "              at the rate of 2% per month until paid and admin fee of £50 per invoice.",
      40,
      conditionsY + 24
    )
    .text(
      "           3. Credit card payments are subject to a 3% surcharge.",
      40,
      conditionsY + 36
    )
    .text(
      "           4. A bank surcharge will be applied to any returned/bounced cheques.",
      40,
      conditionsY + 48
    );

  // Footer
  const footerY = conditionsY + 70;
  doc
    .fillColor("#000000")
    .fontSize(8)
    .text("Powered by ISSAC from Nation Wilcox Systems Ltd.", 40, footerY)
    .text("JP1 192.168.2.249", 450, footerY);

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
          tradingPrice: 1,
          vat: "$adminProduct.vat",
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
              outstandingTotal: total,
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

      const client = await Client.findById(clientId)
        .select("clientName clientEmail deliveryAddress")
        .session(session);
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

      // const invoiceUrl = `${req.protocol}://${req.hostname}:${process.env.PORT}/${`invoice_${newOrder.orderNumber}.pdf`}`;
      const invoiceUrl =
        process.env.NODE_ENV === "production"
          ? `https://topark-backend.onrender.com/invoice_${newOrder.orderNumber}.pdf`
          : `http://localhost:${process.env.PORT}/invoice_${newOrder.orderNumber}.pdf`;

      newOrder.invoiceUrl = invoiceUrl;
      await newOrder.save();

      await sendEmail({
        to: client.clientEmail,
        // to: "saifmd9536@gmail.com",
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
        attachments: [
          {
            filename: `invoice-${newOrder.orderNumber}.pdf`,
            path: invoicePath,
          },
        ],
      });

      responseHandler(res, 200, "Order created successfully", "success", {
        invoice: invoiceUrl,
      });
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
          invoiceUrl: 1,
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
