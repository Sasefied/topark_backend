import { Request, Response } from "express";
import Client, { IClient } from "../schemas/ClientDetails";
import User from "../schemas/User";
import MyClient from "../schemas/MyClient";
import { responseHandler } from "../utils/responseHandler";
import sendEmail from "../utils/mail";
import { ClientSession, ObjectId, Types } from "mongoose";
import mongoose from "mongoose";
import Inventory, { IInventory } from "../schemas/Inventory";
import { AdminProduct } from "../schemas/AdminProduct";
import { BadRequestError } from "../utils/errors";

const excludeId = (doc: any) => {
  const { _id, ...rest } = doc.toObject();
  return rest;
};

// Constants for validation
const VALID_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const VALID_SELL_BY_TYPES = [
  "Box",
  "Kg",
  "Unit",
  "Dozen",
  "Liter",
  "Packet",
  "Gram",
  "Pound",
  "Ounce",
  "Milliliter",
];
const VALID_CREDIT_PERIODS = [0, 1, 7, 14, 30, 60, 90];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Reusable validation functions
const validateEmail = (email: string | undefined): boolean =>
  !!email && EMAIL_REGEX.test(email.trim());

const validateCreditPeriod = (period: any): boolean =>
  period !== undefined && VALID_CREDIT_PERIODS.includes(Number(period));


const addStockOnInventory = async (
  userId: string,
  product: IInventory,
  session: ClientSession,
  clientId?: String
) => {
  const {
    adminProductId,
    size,
    color,
    vat,
    sellBy,
    sellByQuantity,
    shelfLife,
    season,
    countryOfOrigin,
    variety,
  } = product;

  // Validate referenced documents
  const productExists =
    await AdminProduct.findById(adminProductId).session(session);
  if (!productExists) {
    throw new BadRequestError("Product not found");
  }

  // Validate client if clientId is provided
  if (clientId) {
    const client = await Client.findById(clientId).session(session);
    if (!client) {
      throw new BadRequestError("Client not found");
    }
  }

  // Validate season
  if (
    !Array.isArray(season) ||
    !season.every((m: string) => VALID_MONTHS.includes(m))
  ) {
    throw new BadRequestError(
      "Invalid season format. Must be an array of valid months."
    );
  }

  // Validate sellBy
  if (!VALID_SELL_BY_TYPES.includes(sellBy)) {
    throw new BadRequestError("Invalid sellBy type");
  }

  // Validate size and color against AdminProduct
  if (size !== productExists.size) {
    throw new BadRequestError(
      `Size "${size}" does not match product's size "${productExists.size}"`
    );
  }
  if (color && productExists.color && color !== productExists.color) {
    throw new BadRequestError(
      `Color "${color}" does not match product's color "${productExists.color}"`
    );
  }

  // Create inventory entry
  const inventoryEntry = await Inventory.create(
    [
      {
        userId,
        clientId,
        adminProductId,
        size,
        color: color || null,
        vat: vat !== undefined ? parseFloat(vat.toString()) : undefined,
        sellBy,
        shelfLife,
        season,
        countryOfOrigin,
        variety,
        sellByQuantity,
      },
    ],
    { session }
  );

  return inventoryEntry[0];
};


  interface Counter {
  _id: string;
  sequence: number;
}

// Schema for the counters collection
const CounterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  sequence: { type: Number, default: 0 },
});

const Counter = mongoose.model("Counter", CounterSchema);

// Function to get the next clientId
const getNextClientId = async (session: ClientSession): Promise<string> => {
  // Find the highest existing clientId in the clients collection
  const lastClient = await Client.findOne()
    .sort({ clientId: -1 })
    .session(session)
    .lean();
  let maxSequence = 0;
  if (lastClient && lastClient.clientId && lastClient.clientId.startsWith("CLIENT-")) {
    const lastNumber = parseInt(lastClient.clientId.replace("CLIENT-", ""), 10);
    if (!isNaN(lastNumber)) {
      maxSequence = lastNumber;
    }
  }

  // Synchronize the counters collection to ensure sequence is at least maxSequence + 1
  await Counter.findOneAndUpdate(
    { _id: "clientId" },
    { $max: { sequence: maxSequence + 1 } },
    { upsert: true, session }
  );

  // Increment the sequence to get the next clientId
  const counter = await Counter.findOneAndUpdate(
    { _id: "clientId" },
    { $inc: { sequence: 1 } },
    { new: true, upsert: true, session }
  );

  return `CLIENT-${String(counter.sequence).padStart(3, "0")}`;
};



export const createClient = async (
  req: Request,
  res: Response
): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      userId,
      clientName,
      workanniversary,
      clientEmail,
      registeredName,
      registeredAddress,
      deliveryAddress,
      countryName,
      clientNotes,
      companyReferenceNumber,
      creditLimit,
      preference,
      invoiceEmail,
      returnToSupplierEmail,
      quantityIssueEmail,
      qualityIssueEmail,
      deliveryDelayIssueEmail,
      supplierCreditLimitAmount,
      supplierCreditLimitDays,
      products,
    } = req.body;

    // Validate required fields
    if (
      !clientName ||
      !clientEmail?.trim() ||
      !registeredName ||
      !userId ||
      !preference
    ) {
      throw new BadRequestError(
        "Required fields: clientName, clientEmail, registeredName, userId, preference"
      );
    }

    // Validate email format
    if (!validateEmail(clientEmail)) {
      throw new BadRequestError("Invalid client email format");
    }

    // Validate preference
    if (!["Client", "Supplier", "Both"].includes(preference)) {
      throw new BadRequestError(
        "Preference must be 'Client', 'Supplier', or 'Both'"
      );
    }

    const isClient = preference === "Client" || preference === "Both";
    const isSupplier = preference === "Supplier" || preference === "Both";

    // Validate preference-specific fields
    if (isClient && !deliveryAddress?.trim()) {
      throw new BadRequestError(
        "Delivery address is required for Client or Both preference"
      );
    }

    if (isSupplier) {
      const supplierEmailFields = [
        invoiceEmail,
        returnToSupplierEmail,
        quantityIssueEmail,
        qualityIssueEmail,
        deliveryDelayIssueEmail,
      ];
      const invalidEmails = supplierEmailFields.filter(
        (email) => email && !validateEmail(email)
      );
      if (invalidEmails.length > 0) {
        throw new BadRequestError(
          "One or more supplier email fields have invalid format"
        );
      }

      if (supplierCreditLimitAmount !== undefined) {
        if (
          typeof supplierCreditLimitAmount !== "number" ||
          isNaN(supplierCreditLimitAmount) ||
          supplierCreditLimitAmount < 0
        ) {
          throw new BadRequestError(
            "Invalid supplierCreditLimitAmount. Must be a valid non-negative number."
          );
        }
      }

      if (
        supplierCreditLimitDays !== undefined &&
        !validateCreditPeriod(supplierCreditLimitDays)
      ) {
        throw new BadRequestError(
          "Supplier credit limit days must be one of: 0, 1, 7, 14, 30, 60, 90"
        );
      }
    }

    // Validate creditLimit if provided
    if (creditLimit) {
      if (
        typeof creditLimit.amount !== "number" ||
        isNaN(creditLimit.amount) ||
        creditLimit.amount < 0
      ) {
        throw new BadRequestError(
          "Invalid creditLimit.amount. Must be a valid non-negative number."
        );
      }
      if (creditLimit.period && !validateCreditPeriod(creditLimit.period)) {
        throw new BadRequestError(
          "Credit limit period must be one of: 0, 1, 7, 14, 30, 60, 90"
        );
      }
    }

    // Validate products array structure
    if (
      products &&
      (!Array.isArray(products) ||
        products.some((p) => !p.adminProductId || !p.sellBy))
    ) {
      throw new BadRequestError(
        "Products must be an array of objects with adminProductId and sellBy"
      );
    }

    // Generate unique clientId
    const clientId = await getNextClientId(session);

    // Check for existing client by email
    if (await Client.findOne({ clientEmail }).session(session)) {
      throw new BadRequestError("Client email already exists");
    }

    // Verify authenticated user
    const createdBy = new mongoose.Types.ObjectId(req.userId);
    if (!createdBy) {
      throw new BadRequestError("Authentication required");
    }

    const user = await User.findById(createdBy).session(session);
    if (!user) {
      throw new BadRequestError("Invalid user");
    }

    // Construct the creditLimit object
    const creditLimitData = creditLimit
      ? {
          amount: creditLimit.amount,
          period: creditLimit.period ? Number(creditLimit.period) : 0,
        }
      : { amount: 0, period: 0 };

    // Construct the client data
    const clientData: Partial<IClient> = {
      clientId,
      userId,
      clientName,
      workanniversary: workanniversary ? new Date(workanniversary) : null,
      clientEmail,
      registeredName,
      registeredAddress: registeredAddress || "",
      countryName: countryName || "",
      clientNotes: clientNotes || "",
      companyReferenceNumber: companyReferenceNumber || clientId,
      createdBy,
      creditLimit: creditLimitData,
      preference,
    };

    // Add preference-specific fields
    if (isClient) {
      clientData.deliveryAddress = deliveryAddress || "";
    }
    if (isSupplier) {
      clientData.supplier = {
        creditLimitAmount: supplierCreditLimitAmount || 0,
        creditLimitDays: supplierCreditLimitDays
          ? Number(supplierCreditLimitDays)
          : 0,
        invoiceEmail: invoiceEmail || "",
        returnToSupplierEmail: returnToSupplierEmail || "",
        quantityIssueEmail: quantityIssueEmail || "",
        qualityIssueEmail: qualityIssueEmail || "",
        deliveryDelayIssueEmail: deliveryDelayIssueEmail || "",
      };
    }

    const newClient = new Client(clientData);
    await newClient.save({ session });

    // Add the new client to MyClient.clientId array
    await MyClient.findOneAndUpdate(
      { userId: userId.toString() },
      { $addToSet: { clientId: newClient._id } },
      { upsert: true, session }
    );

    // Add products in parallel
    if (Array.isArray(products) && products.length > 0) {
      await Promise.all(
        products.map((product: IInventory) =>
          addStockOnInventory(
            req.userId!,
            product,
            session,
            String(newClient._id)
          )
        )
      );
    }

    // Prepare email content
    const roleDescription =
      preference === "Both" ? "client and supplier" : preference.toLowerCase();
    let html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <p>Hello <strong>${clientName}</strong>,</p>
        <p>You have been successfully added as a ${roleDescription} for <strong>${user.companyName || "our company"}</strong>.</p>
        <p><strong>Client ID:</strong> ${clientId}</p>
        <p><strong>Company Reference Number:</strong> ${companyReferenceNumber || clientId}</p>
        <p><strong>Registered Name:</strong> ${registeredName}</p>
        <p><strong>Registered Address:</strong> ${registeredAddress || "Not provided"}</p>
        <p><strong>Notes:</strong> ${clientNotes || "None"}</p>
        <p><strong>Credit Limit Amount:</strong> $${creditLimitData.amount}</p>
        <p><strong>Credit Limit Period:</strong> ${
          creditLimitData.period
            ? `${creditLimitData.period} days`
            : "Not specified"
        }</p>
    `;

    if (isClient) {
      html += `<p><strong>Delivery Address:</strong> ${deliveryAddress || "Not provided"}</p>`;
    }
    if (isSupplier) {
      html += `
        <p><strong>Supplier Credit Limit Amount:</strong> $${supplierCreditLimitAmount || 0}</p>
        <p><strong>Supplier Credit Limit Days:</strong> ${supplierCreditLimitDays ? `${supplierCreditLimitDays} days` : "Not specified"}</p>
        <p><strong>Invoice Email:</strong> ${invoiceEmail || "Not provided"}</p>
        <p><strong>Return to Supplier Email:</strong> ${returnToSupplierEmail || "Not provided"}</p>
        <p><strong>Quantity Issue Email:</strong> ${quantityIssueEmail || "Not provided"}</p>
        <p><strong>Quality Issue Email:</strong> ${qualityIssueEmail || "Not provided"}</p>
        <p><strong>Delivery Delay Issue Email:</strong> ${deliveryDelayIssueEmail || "Not provided"}</p>
      `;
    }

    html += `
        <p>If you have any questions, please contact our support team.</p>
        <hr style="margin-top: 20px; border: none; border-top: 1px solid #eee;">
        <p style="font-size: 12px; color: #999;">© ${new Date().getFullYear()} Toprak Team. All rights reserved.</p>
      </div>
    `;

    const mailSent = await sendEmail({
      to: clientEmail,
      subject: `Welcome! You Have Been Added as a ${roleDescription.charAt(0).toUpperCase() + roleDescription.slice(1)}`,
      html,
    });

    if (!mailSent) {
      console.warn("createClient - Failed to send email to:", clientEmail);
    }

    await session.commitTransaction();
    session.endSession();

    responseHandler(
      res,
      201,
      "Client created successfully",
      "success",
      newClient
    );
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    console.error("createClient - Error:", {
      message: error.message,
      stack: error.stack,
      body: req.body,
      validationErrors: error.errors || null,
    });
    if (error instanceof BadRequestError) {
      responseHandler(res, 400, error.message, "error");
      return;
    }
    if (error.code === 11000 && error.keyPattern?.clientId) {
      responseHandler(res, 400, "Duplicate clientId detected", "error");
      return;
    }
    responseHandler(res, 500, "Internal server error", "error");
  }
};

export const addClientToUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { clientId, client: clientData } = req.body;
    const userId = req.userId;

    console.log("addClientToUser - Request body:", { clientId, clientData, userId });

    // Validate inputs
    if (!userId || !Types.ObjectId.isValid(userId)) {
      responseHandler(res, 400, "Invalid or missing userId", "error");
      return;
    }
    if (!clientId || !Types.ObjectId.isValid(clientId)) {
      responseHandler(res, 400, "Invalid or missing clientId; must be a valid ObjectId", "error");
      return;
    }

    // Validate client exists
    const existingClient = await Client.findById(clientId);
    if (!existingClient) {
      responseHandler(res, 404, "Client not found", "error");
      return;
    }

    // Validate clientData if provided
    let validClientEntries: { userId: Types.ObjectId; clientId: Types.ObjectId }[] = [];
    if (clientData && Array.isArray(clientData)) {
      validClientEntries = clientData
        .filter(
          (entry) =>
            Types.ObjectId.isValid(entry.userId) &&
            Types.ObjectId.isValid(entry.clientId)
        )
        .map((entry) => ({
          userId: new Types.ObjectId(entry.userId),
          clientId: new Types.ObjectId(entry.clientId),
        }));

      if (validClientEntries.length === 0 && clientData.length > 0) {
        responseHandler(res, 400, "No valid client entries in clientData", "error");
        return;
      }
    }

    // Update MyClient document
    const updateData: any = { $addToSet: { clientId: new Types.ObjectId(clientId) } };
    if (validClientEntries.length > 0) {
      updateData.$addToSet.client = { $each: validClientEntries };
    }

    const updatedMyClient = await MyClient.findOneAndUpdate(
      { userId: userId.toString() },
      updateData,
      { upsert: true, new: true }
    )
      .populate("clientId")
      .populate("client.clientId")
      .populate("client.userId");

    if (!updatedMyClient) {
      responseHandler(res, 500, "Failed to update MyClient document", "error");
      return;
    }

    responseHandler(
      res,
      200,
      "Client(s) added successfully",
      "success",
      updatedMyClient
    );
  } catch (error: any) {
    console.error("addClientToUser - Error:", {
      message: error.message,
      stack: error.stack,
      body: req.body,
      userId: req.userId,
    });
    responseHandler(res, 500, "Internal server error", "error");
  }
};

// export const addClientToUser = async (
//   req: Request,
//   res: Response
// ): Promise<void> => {
//   try {
//     const { clientId, client: clientData } = req.body;
//     const userId = req.userId;

//     console.log("addClientToUser - Request body:", req.body, req.userId);

//     // Basic validation
//     if (!userId || !clientId || !Array.isArray(clientData)) {
//       responseHandler(res, 400, "Missing required fields", "error");
//       return;
//     }

//     if (!Types.ObjectId.isValid(clientId)) {
//       responseHandler(res, 400, "Invalid clientId", "error");
//       return;
//     }

//     // Optional: validate that client exists
//     const existingClient = await Client.findById(clientId);
//     if (!existingClient) {
//       responseHandler(res, 404, "Client not found", "error");
//       return;
//     }

//     // Validate each item in clientData
//     const validClientEntries = clientData
//       .filter(
//         (entry) =>
//           Types.ObjectId.isValid(entry.userId) &&
//           Types.ObjectId.isValid(entry.clientId)
//       )
//       .map((entry) => ({
//         userId: new Types.ObjectId(entry.userId),
//         clientId: new Types.ObjectId(entry.clientId),
//       }));

//     if (validClientEntries.length === 0) {
//       responseHandler(res, 400, "No valid client entries", "error");
//       return;
//     }

//     // Update MyClient document
//     const updatedMyClient = await MyClient.findOneAndUpdate(
//       { userId: userId.toString() },
//       {
//         $addToSet: {
//           clientId: new Types.ObjectId(clientId), // Add to flat array
//           client: { $each: validClientEntries }, // Add to nested array
//         },
//       },
//       { upsert: true, new: true }
//     )
//       .populate("clientId")
//       .populate("client.clientId")
//       .populate("client.userId");

//     responseHandler(
//       res,
//       200,
//       "Client(s) added successfully",
//       "success",
//       updatedMyClient
//     );
//   } catch (error: any) {
//     console.error("addClientToUser - Error:", {
//       message: error.message,
//       stack: error.stack,
//     });
//     responseHandler(res, 500, "Internal server error", "error");
//   }
// };

// Define a type for the populated createdBy field
interface PopulatedCreatedBy {
  _id: string;
  firstName: string;
  lastName: string;
  companyName: string;
  companyReferenceNumber: string;
}

// Define a type for the populated client document
interface PopulatedClient extends Omit<IClient, "createdBy"> {
  createdBy: PopulatedCreatedBy | null;
}

export const getClientsForUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.userId;

    console.log("getClientsForUser - userId:", userId);

    if (!userId) {
      responseHandler(res, 400, "Missing userId", "error");
      return;
    }

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      console.warn("getClientsForUser - User not found:", userId);
      responseHandler(res, 400, "Invalid user", "error");
      return;
    }

    const myClientDoc = await MyClient.findOne({
      userId: userId.toString(),
    }).populate({
      path: "clientId",
      select:
        "userId clientId clientName clientEmail registeredName workanniversary registeredAddress deliveryAddress countryName clientNotes companyReferenceNumber creditLimit preference supplier relatedClientIds createdBy",
      populate: {
        path: "createdBy",
        select: "firstName lastName companyName companyReferenceNumber",
      },
    });

    if (
      !myClientDoc ||
      !myClientDoc.clientId ||
      (myClientDoc.clientId as any[]).length === 0
    ) {
      responseHandler(res, 200, "No clients found for this user", "success", {
        count: 0,
        clients: [],
      });
      return;
    }

    // Validate populated clients and map to plain object
    const clients = (myClientDoc.clientId as any[])
      .filter((client: any) => {
        if (!client.clientName || !client.clientId) {
          console.warn("getClientsForUser - Invalid client data:", client);
          return false;
        }
        return true;
      })
      .map((client: any) => ({
        _id: client._id.toString(),
        userId: client.userId?.toString() || "",
        clientId: client.clientId,
        clientName: client.clientName,
        clientEmail: client.clientEmail,
        registeredName: client.registeredName,
        workanniversary: client.workanniversary
          ? client.workanniversary.toISOString()
          : null,
        registeredAddress: client.registeredAddress || "",
        deliveryAddress: client.deliveryAddress || "",
        countryName: client.countryName || "",
        clientNotes: client.clientNotes || "",
        companyReferenceNumber: client.companyReferenceNumber || "",
        relatedClientIds: client.relatedClientIds
          ? client.relatedClientIds.map((id: any) => id.toString())
          : [],
        creditLimit: client.creditLimit
          ? {
              amount: client.creditLimit.amount || 0,
              period: client.creditLimit.period || 0,
            }
          : { amount: 0, period: 0 },
        preference: client.preference || "Client",
        supplier: client.supplier
          ? {
              creditLimitAmount: client.supplier.creditLimitAmount || 0,
              creditLimitDays: client.supplier.creditLimitDays || 0,
              invoiceEmail: client.supplier.invoiceEmail || "",
              returnToSupplierEmail:
                client.supplier.returnToSupplierEmail || "",
              quantityIssueEmail: client.supplier.quantityIssueEmail || "",
              qualityIssueEmail: client.supplier.qualityIssueEmail || "",
              deliveryDelayIssueEmail:
                client.supplier.deliveryDelayIssueEmail || "",
            }
          : undefined,
        createdBy: client.createdBy
          ? {
              _id: client.createdBy._id?.toString() || "",
              firstName: client.createdBy.firstName || "",
              lastName: client.createdBy.lastName || "",
              companyName: client.createdBy.companyName || "",
              companyReferenceNumber:
                client.createdBy.companyReferenceNumber || "",
            }
          : null,
        createdAt: client.createdAt
          ? client.createdAt.toISOString()
          : undefined,
        updatedAt: client.updatedAt
          ? client.updatedAt.toISOString()
          : undefined,
      }));

    const count = clients.length;

    responseHandler(res, 200, "Clients fetched successfully", "success", {
      count,
      clients,
    });
  } catch (error: any) {
    console.error("getClientsForUser - Error:", {
      message: error.message,
      stack: error.stack,
      userId: req.userId,
    });
    responseHandler(res, 500, "Internal server error", "error");
  }
};

export const getAllClients = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Validate userId
    if (!req.userId || !mongoose.Types.ObjectId.isValid(req.userId)) {
      responseHandler(res, 400, "Invalid or missing userId", "error");
      return;
    }

    const userId = new mongoose.Types.ObjectId(req.userId);

    // Aggregation pipeline
    const pipeline = [
      {
        $match: { createdBy: new mongoose.Types.ObjectId(req.userId) }, // Ensure userId is not null
      },
      {
        $lookup: {
          from: "myclients",
          let: { userId: userId },
          pipeline: [
            { $match: { $expr: { $eq: ["$userId", "$$userId"] } } },
            { $project: { clientId: 1 } },
          ],
          as: "myClient",
        },
      },
      {
        $unwind: {
          path: "$myClient",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $match: {
          $and: [
            { _id: { $nin: "$myClient.clientId" } }, // Exclude client IDs from MyClient
            { clientEmail: { $ne: req.userEmail } },
            { userId: { $ne: null } },
          ],
        },
      },
      {
        $lookup: {
          from: "users", // Adjust collection name
          localField: "createdBy",
          foreignField: "_id",
          as: "createdBy",
        },
      },
      {
        $unwind: {
          path: "$createdBy",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "inventories",
          localField: "_id",
          foreignField: "clientId",
          as: "products",
        },
      },
      {
        $project: {
          _id: { $toString: "$_id" },
          userId: { $toString: "$userId" },
          clientId: 1,
          clientName: 1,
          clientEmail: 1,
          registeredName: 1,
          workanniversary: {
            $cond: [
              { $ne: ["$workanniversary", null] },
              { $toString: "$workanniversary" },
              null,
            ],
          },
          registeredAddress: { $ifNull: ["$registeredAddress", ""] },
          deliveryAddress: { $ifNull: ["$deliveryAddress", ""] },
          countryName: { $ifNull: ["$countryName", ""] },
          clientNotes: { $ifNull: ["$clientNotes", ""] },
          companyReferenceNumber: { $ifNull: ["$companyReferenceNumber", ""] },
          relatedClientIds: {
            $map: {
              input: { $ifNull: ["$relatedClientIds", []] },
              as: "id",
              in: { $toString: "$$id" },
            },
          },
          creditLimit: {
            $cond: [
              { $ne: ["$creditLimit", null] },
              {
                amount: { $ifNull: ["$creditLimit.amount", 0] },
                period: { $ifNull: ["$creditLimit.period", 0] },
              },
              { amount: 0, period: 0 },
            ],
          },
          preference: { $ifNull: ["$preference", "Client"] },
          supplier: {
            $cond: [
              { $ne: ["$supplier", null] },
              {
                creditLimitAmount: {
                  $ifNull: ["$supplier.creditLimitAmount", 0],
                },
                creditLimitDays: { $ifNull: ["$supplier.creditLimitDays", 0] },
                invoiceEmail: { $ifNull: ["$supplier.invoiceEmail", ""] },
                returnToSupplierEmail: {
                  $ifNull: ["$supplier.returnToSupplierEmail", ""],
                },
                quantityIssueEmail: {
                  $ifNull: ["$supplier.quantityIssueEmail", ""],
                },
                qualityIssueEmail: {
                  $ifNull: ["$supplier.qualityIssueEmail", ""],
                },
                deliveryDelayIssueEmail: {
                  $ifNull: ["$supplier.deliveryDelayIssueEmail", ""],
                },
              },
              null,
            ],
          },
          createdBy: {
            $cond: [
              { $ne: ["$createdBy", null] },
              {
                _id: { $toString: "$createdBy._id" },
                firstName: { $ifNull: ["$createdBy.firstName", ""] },
                lastName: { $ifNull: ["$createdBy.lastName", ""] },
                companyName: { $ifNull: ["$createdBy.companyName", ""] },
                companyReferenceNumber: {
                  $ifNull: ["$createdBy.companyReferenceNumber", ""],
                },
              },
              null,
            ],
          },
          createdAt: {
            $cond: [
              { $ne: ["$createdAt", null] },
              { $toString: "$createdAt" },
              null,
            ],
          },
          updatedAt: {
            $cond: [
              { $ne: ["$updatedAt", null] },
              { $toString: "$updatedAt" },
              null,
            ],
          },
          products: {
            $map: {
              input: { $ifNull: ["$products", []] },
              as: "product",
              in: {
                _id: { $toString: "$$product._id" },
                adminProductId: { $toString: "$$product.adminProductId" },
                size: "$$product.size",
                color: { $ifNull: ["$$product.color", null] },
                vat: { $ifNull: ["$$product.vat", null] },
                sellBy: "$$product.sellBy",
                sellByQuantity: { $ifNull: ["$$product.sellByQuantity", null] },
                shelfLife: { $ifNull: ["$$product.shelfLife", null] },
                season: { $ifNull: ["$$product.season", []] },
                month: { $ifNull: ["$$product.month", []] },
                countryOfOrigin: { $ifNull: ["$$product.countryOfOrigin", ""] },
                variety: { $ifNull: ["$$product.variety", ""] },
              },
            },
          },
        },
      },
      {
        $match: {
          clientName: { $ne: null },
          clientId: { $ne: null },
        },
      },
    ];

    // Execute aggregation
    const clients = await Client.aggregate(pipeline);

    const count = clients.length;

    responseHandler(res, 200, "Clients fetched successfully", "success", {
      count,
      clients,
    });
  } catch (error: any) {
    console.error("getAllClients - Error:", {
      message: error.message,
      stack: error.stack,
      userId: req.userId,
    });
    responseHandler(res, 500, "Internal server error", "error");
  }
};

export const searchClients = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.userId;
    const searchTerm = req.query.search as string;

    if (!userId) {
      responseHandler(res, 400, "Missing userId", "error");
      return;
    }

    const myClientDoc = await MyClient.findOne({ userId: userId.toString() });
    const excludedClientIds = myClientDoc?.clientId || [];

    const searchRegex = new RegExp(searchTerm, "i"); // Case-insensitive search
    const clients = await Client.find({
      $and: [
        {
          $or: [
            { clientName: { $regex: searchRegex } },
            { registeredName: { $regex: searchRegex } },
            { companyReferenceNumber: { $regex: searchRegex } },
          ],
        },
        { _id: { $nin: excludedClientIds } },
        { clientEmail: { $ne: req.userEmail } },
        { userId: { $ne: null } },
      ],
    })
      .select(
        "userId clientId clientName clientEmail registeredName workanniversary registeredAddress deliveryAddress countryName clientNotes companyReferenceNumber creditLimit preference supplier relatedClientIds createdBy createdAt updatedAt"
      )
      .populate(
        "createdBy",
        "firstName lastName companyName companyReferenceNumber"
      );

    // Validate clients and map to plain object
    const validClients = clients
      .filter((client) => {
        if (!client.clientName || !client.clientId) {
          console.warn("searchClients - Invalid client data:", client);
          return false;
        }
        return true;
      })
      .map((client: any) => ({
        _id: client._id.toString(),
        userId: client.userId?.toString() || "",
        clientId: client.clientId,
        clientName: client.clientName,
        clientEmail: client.clientEmail,
        registeredName: client.registeredName,
        workanniversary: client.workanniversary
          ? client.workanniversary.toISOString()
          : null,
        registeredAddress: client.registeredAddress || "",
        deliveryAddress: client.deliveryAddress || "",
        countryName: client.countryName || "",
        clientNotes: client.clientNotes || "",
        companyReferenceNumber: client.companyReferenceNumber || "",
        relatedClientIds: client.relatedClientIds
          ? client.relatedClientIds.map((id: any) => id.toString())
          : [],
        creditLimit: client.creditLimit
          ? {
              amount: client.creditLimit.amount || 0,
              period: client.creditLimit.period || 0,
            }
          : { amount: 0, period: 0 },
        preference: client.preference || "Client",
        supplier: client.supplier
          ? {
              creditLimitAmount: client.supplier.creditLimitAmount || 0,
              creditLimitDays: client.supplier.creditLimitDays || 0,
              invoiceEmail: client.supplier.invoiceEmail || "",
              returnToSupplierEmail:
                client.supplier.returnToSupplierEmail || "",
              quantityIssueEmail: client.supplier.quantityIssueEmail || "",
              qualityIssueEmail: client.supplier.qualityIssueEmail || "",
              deliveryDelayIssueEmail:
                client.supplier.deliveryDelayIssueEmail || "",
            }
          : undefined,
        createdBy: client.createdBy
          ? {
              _id: client.createdBy._id?.toString() || "",
              firstName: client.createdBy.firstName || "",
              lastName: client.createdBy.lastName || "",
              companyName: client.createdBy.companyName || "",
              companyReferenceNumber:
                client.createdBy.companyReferenceNumber || "",
            }
          : null,
        createdAt: client.createdAt
          ? client.createdAt.toISOString()
          : undefined,
        updatedAt: client.updatedAt
          ? client.updatedAt.toISOString()
          : undefined,
      }));

    const count = validClients.length;

    responseHandler(res, 200, "Clients fetched successfully", "success", {
      count,
      validClients,
    });
  } catch (error: any) {
    console.error("searchClients - Error:", {
      message: error.message,
      stack: error.stack,
      userId: req.userId,
      searchTerm: req.query.search,
    });
    responseHandler(res, 500, "Internal server error", "error");
  }
};


export const getClientById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { clientId } = req.params;
    const client = await Client.findOne({ clientId })
      .select(
        "userId clientId clientName clientEmail registeredName workanniversary registeredAddress deliveryAddress countryName clientNotes companyReferenceNumber creditLimit preference supplier relatedClientIds createdBy createdAt updatedAt"
      )
      .populate(
        "createdBy",
        "firstName lastName companyName companyReferenceNumber"
      );

    if (!client || !client.clientName || !client.clientId) {
      console.warn("getClientById - Invalid client data:", client);
      responseHandler(res, 404, "Client not found or invalid data", "error");
      return;
    }

    // Map to plain object to match IClient interface
    const clientData = {
      _id: client._id.toString(),
      userId: client.userId ? client.userId.toString() : "",
      clientId: client.clientId,
      clientName: client.clientName,
      clientEmail: client.clientEmail,
      registeredName: client.registeredName,
      workanniversary: client.workanniversary
        ? client.workanniversary.toISOString()
        : null,
      registeredAddress: client.registeredAddress || "",
      deliveryAddress: client.deliveryAddress || "",
      countryName: client.countryName || "",
      clientNotes: client.clientNotes || "",
      companyReferenceNumber: client.companyReferenceNumber || "",
      relatedClientIds: client.relatedClientIds
        ? client.relatedClientIds.map((id: any) => id.toString())
        : [],
      creditLimit: client.creditLimit
        ? {
            amount: client.creditLimit.amount || 0,
            period: client.creditLimit.period || 0,
          }
        : { amount: 0, period: 0 },
      preference: client.preference || "Client",
      supplier: client.supplier
        ? {
            creditLimitAmount: client.supplier.creditLimitAmount || 0,
            creditLimitDays: client.supplier.creditLimitDays || 0,
            invoiceEmail: client.supplier.invoiceEmail || "",
            returnToSupplierEmail: client.supplier.returnToSupplierEmail || "",
            quantityIssueEmail: client.supplier.quantityIssueEmail || "",
            qualityIssueEmail: client.supplier.qualityIssueEmail || "",
            deliveryDelayIssueEmail:
              client.supplier.deliveryDelayIssueEmail || "",
          }
        : undefined,
      createdBy: (client as any).createdBy
        ? {
            _id: (client as any).createdBy._id?.toString() || "",
            firstName: (client as any).createdBy.firstName || "",
            lastName: (client as any).createdBy.lastName || "",
            companyName: (client as any).createdBy.companyName || "",
            companyReferenceNumber:
              (client as any).createdBy.companyReferenceNumber || "",
          }
        : null,
      createdAt: client.createdAt ? client.createdAt.toISOString() : undefined,
      updatedAt: client.updatedAt ? client.updatedAt.toISOString() : undefined,
    };

    responseHandler(
      res,
      200,
      "Client fetched successfully",
      "success",
      clientData
    );
  } catch (error: any) {
    console.error("getClientById - Error:", {
      message: error.message,
      stack: error.stack,
      params: req.params,
    });
    responseHandler(res, 500, "Internal server error", "error");
  }
};


export const updateClient = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { clientId } = req.params;
    const updatedClientData: Partial<IClient> = req.body;

    // Prevent updating clientId
    delete updatedClientData.clientId;

    const existingClient = await Client.findOne({ clientId });
    if (!existingClient) {
      responseHandler(res, 404, "Client not found", "error");
      return;
    }

    const finalPreference =
      updatedClientData.preference || existingClient.preference;

    // Validate workanniversary format
    if (updatedClientData.workanniversary) {
      updatedClientData.workanniversary = new Date(
        updatedClientData.workanniversary
      );
      if (isNaN(updatedClientData.workanniversary.getTime())) {
        responseHandler(
          res,
          400,
          "Invalid workanniversary date format",
          "error"
        );
        return;
      }
    }

    // Validate creditLimit if provided
    if (updatedClientData.creditLimit) {
      if (
        typeof updatedClientData.creditLimit.amount !== "number" ||
        isNaN(updatedClientData.creditLimit.amount) ||
        updatedClientData.creditLimit.amount < 0
      ) {
        responseHandler(
          res,
          400,
          "Invalid creditLimit.amount. Must be a valid non-negative number.",
          "error"
        );
        return;
      }
      if (
        updatedClientData.creditLimit.period !== undefined &&
        !["0", "1", "7", "14", "30", "60", "90"].includes(
          updatedClientData.creditLimit.period.toString()
        )
      ) {
        responseHandler(
          res,
          400,
          "Credit limit period must be one of: 0, 1, 7, 14, 30, 60, 90",
          "error"
        );
        return;
      }
      updatedClientData.creditLimit.period =
        updatedClientData.creditLimit.period ?? 0;
    }

    // Validate preference if provided
    if (
      updatedClientData.preference &&
      !["Client", "Supplier"].includes(updatedClientData.preference)
    ) {
      responseHandler(
        res,
        400,
        "Preference must be either 'Client' or 'Supplier'",
        "error"
      );
      return;
    }

    if (updatedClientData.supplier && finalPreference !== "Supplier") {
      responseHandler(
        res,
        400,
        "Supplier fields can only be set for Supplier preference",
        "error"
      );
      return;
    }

    if (updatedClientData.deliveryAddress && finalPreference !== "Client") {
      responseHandler(
        res,
        400,
        "Delivery address can only be set for Client preference",
        "error"
      );
      return;
    }

    // Unset irrelevant fields based on preference
    if (updatedClientData.preference) {
      if (updatedClientData.preference === "Client") {
        updatedClientData.supplier = undefined;
      } else if (updatedClientData.preference === "Supplier") {
        updatedClientData.deliveryAddress = undefined;
      }
    }

    // Validate supplier if provided
    if (updatedClientData.supplier) {
      const supplier = updatedClientData.supplier;

      if (supplier.creditLimitAmount !== undefined) {
        if (
          typeof supplier.creditLimitAmount !== "number" ||
          isNaN(supplier.creditLimitAmount) ||
          supplier.creditLimitAmount < 0
        ) {
          responseHandler(
            res,
            400,
            "Invalid supplier.creditLimitAmount. Must be a valid non-negative number.",
            "error"
          );
          return;
        }
      }

      if (supplier.creditLimitDays !== undefined) {
        if (
          !["0", "1", "7", "14", "30", "60", "90"].includes(
            supplier.creditLimitDays.toString()
          )
        ) {
          responseHandler(
            res,
            400,
            "Supplier credit limit days must be one of: 0, 1, 7, 14, 30, 60, 90",
            "error"
          );
          return;
        }
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const emailFields = [
        supplier.invoiceEmail,
        supplier.returnToSupplierEmail,
        supplier.quantityIssueEmail,
        supplier.qualityIssueEmail,
        supplier.deliveryDelayIssueEmail,
      ].filter((email) => email !== undefined && email !== "");
      const invalidEmails = emailFields.filter(
        (email) => !emailRegex.test(email.trim())
      );
      if (invalidEmails.length > 0) {
        responseHandler(
          res,
          400,
          "One or more supplier email fields have invalid format",
          "error"
        );
        return;
      }
    }

    // Find and update the client
    const client = await Client.findOneAndUpdate(
      { clientId },
      updatedClientData,
      { new: true, runValidators: true }
    ).populate(
      "createdBy",
      "firstName lastName companyName companyReferenceNumber"
    );

    console.log("updateClient - Updated client:", { clientId, client });

    if (!client || !client.clientName || !client.clientId) {
      console.warn("updateClient - Invalid client data:", client);
      responseHandler(res, 404, "Client not found or invalid data", "error");
      return;
    }

    // Construct response with all fields including new ones
    const clientData = {
      _id: client._id.toString(),
      userId: client.userId?.toString() || "",
      clientId: client.clientId,
      clientName: client.clientName,
      clientEmail: client.clientEmail,
      countryName: client.countryName || "",
      registeredName: client.registeredName,
      workanniversary: client.workanniversary
        ? client.workanniversary.toISOString()
        : null,
      registeredAddress: client.registeredAddress,
      deliveryAddress: client.deliveryAddress,
      clientNotes: client.clientNotes,
      companyReferenceNumber: client.companyReferenceNumber,
      relatedClientIds:
        client.relatedClientIds?.map((id) => id.toString()) || [],
      creditLimit: {
        amount: client.creditLimit?.amount || 0,
        period: client.creditLimit?.period || 0,
      },
      preference: client.preference,
      supplier: client.supplier
        ? {
            creditLimitAmount: client.supplier.creditLimitAmount || 0,
            creditLimitDays: client.supplier.creditLimitDays || 0,
            invoiceEmail: client.supplier.invoiceEmail || "",
            returnToSupplierEmail: client.supplier.returnToSupplierEmail || "",
            quantityIssueEmail: client.supplier.quantityIssueEmail || "",
            qualityIssueEmail: client.supplier.qualityIssueEmail || "",
            deliveryDelayIssueEmail:
              client.supplier.deliveryDelayIssueEmail || "",
          }
        : undefined,
      createdBy: client.createdBy
        ? {
            _id: client.createdBy._id.toString(),
            firstName: (client as any).createdBy.firstName || "",
            lastName: (client as any).createdBy.lastName || "",
            companyName: (client as any).createdBy.companyName || "",
            companyReferenceNumber:
              (client as any).createdBy.companyReferenceNumber || "",
          }
        : null,
    };

    responseHandler(
      res,
      200,
      "Client updated successfully",
      "success",
      clientData
    );
  } catch (error: any) {
    console.error("updateClient - Error:", {
      message: error.message,
      stack: error.stack,
      body: req.body,
      validationErrors: error.errors || null,
    });
    if (error.name === "ValidationError") {
      responseHandler(res, 400, `Validation error: ${error.message}`, "error");
      return;
    }
    responseHandler(res, 500, "Internal server error", "error");
  }
};

export const deleteClient = async (
  req: Request,
  res: Response
): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { userId } = req;
    const { clientId } = req.body;

    // Validate inputs
    if (!userId || !Types.ObjectId.isValid(userId)) {
      throw new Error("Invalid or missing userId");
    }
    if (
      !clientId ||
      typeof clientId !== "string" ||
      !clientId.startsWith("CLIENT-")
    ) {
      throw new Error(
        "Invalid or missing clientId; must be a string starting with 'CLIENT-'"
      );
    }

    // Find the client by clientId
    const client = await Client.findOne({ clientId }).session(session);
    if (!client) {
      throw new Error("Client not found");
    }

    const clientObjectId = client._id;

    // Delete associated inventory products
    const deleteInventoryResult = await Inventory.deleteMany({
      clientId: clientObjectId,
    }).session(session);

    // Delete the client from Client collection
    const deleteClientResult = await Client.deleteOne({
      _id: clientObjectId,
    }).session(session);

    if (deleteClientResult.deletedCount === 0) {
      throw new Error("Failed to delete client");
    }

    // Remove client from MyClient.clientId array
    const updateMyClientResult = await MyClient.findOneAndUpdate(
      { userId: userId.toString() },
      { $pull: { clientId: clientObjectId } },
      { new: true, session }
    );

    if (!updateMyClientResult) {
      throw new Error("User or MyClient document not found");
    }

    await session.commitTransaction();
    session.endSession();

    responseHandler(
      res,
      200,
      "Client and associated products removed successfully",
      "success",
      {
        deletedClientId: clientId,
        deletedProductCount: deleteInventoryResult.deletedCount,
        updatedMyClient: {
          userId: updateMyClientResult.userId,
          remainingClientIds: updateMyClientResult.clientId.map((id: any) =>
            id.toString()
          ),
          count: updateMyClientResult.clientId.length,
        },
      }
    );
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    console.error("deleteClient - Error:", {
      message: error.message,
      stack: error.stack,
      userId: req.userId,
      clientId: req.body.clientId,
    });
    responseHandler(
      res,
      error.message.includes("not found") ? 404 : 400,
      error.message,
      "error"
    );
  }
};

export const getProductByClientId = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userId } = req;
    const { clientId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    console.log(clientId);
    // Validate inputs
    if (!userId || !Types.ObjectId.isValid(userId)) {
      responseHandler(res, 400, "Invalid or missing userId", "error");
      return;
    }
    // if (!clientId || !Types.ObjectId.isValid(clientId as string)) {
    //   responseHandler(
    //     res,
    //     400,
    //     "Invalid or missing clientId; must be a valid ObjectId",
    //     "error"
    //   );
    //   return;
    // }

    // Convert clientId to ObjectId
    // const clientObjectId = new Types.ObjectId(clientId as string);

    // Verify client exists
    const client = await Client.findOne({clientId}).select("_id").lean();
    if (!client) {
      responseHandler(res, 404, "Client not found", "error");
      return;
    }

    // Aggregation pipeline
    const pipeline = [
      {
        $match: {
          clientId
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
        $project: {
          _id: { $toString: "$_id" },
          adminProductId: { $toString: "$adminProductId" },
          adminProductName: { $ifNull: ["$adminProduct.name", null] },
          size: 1,
          color: { $ifNull: ["$color", null] },
          vat: { $ifNull: ["$vat", null] },
          sellBy: 1,
          sellByQuantity: { $ifNull: ["$sellByQuantity", null] },
          shelfLife: { $ifNull: ["$shelfLife", null] },
          season: { $ifNull: ["$season", []] },
          month: { $ifNull: ["$month", []] },
          countryOfOrigin: { $ifNull: ["$countryOfOrigin", ""] },
          variety: { $ifNull: ["$variety", ""] },
          createdAt: {
            $cond: [
              { $ne: ["$createdAt", null] },
              { $toString: "$createdAt" },
              null,
            ],
          },
          updatedAt: {
            $cond: [
              { $ne: ["$updatedAt", null] },
              { $toString: "$updatedAt" },
              null,
            ],
          },
        },
      },
    ];

    const options = {
      page,
      limit,
      sort: { createdAt: -1 },
      customLabels: {
        docs: "products",
        totalDocs: "totalProducts",
      },
    };

    const result = await (Inventory as any).aggregatePaginate(
      pipeline,
      options
    );

    responseHandler(
      res,
      200,
      "Products fetched successfully",
      "success",
      result
    );
  } catch (error: any) {
    console.error("getProductByClientId - Error:", {
      message: error.message,
      stack: error.stack,
      userId: req.userId,
      clientId: req.query.clientId,
    });
    responseHandler(
      res,
      error.message.includes("not found") ? 404 : 500,
      error.message || "Internal server error",
      "error"
    );
  }
};
