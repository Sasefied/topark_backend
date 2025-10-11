import { Request, Response } from "express";
import Client, { IClient } from "../schemas/ClientDetails";
import User, { IUser } from "../schemas/User";
import MyClient from "../schemas/MyClient";
import { responseHandler } from "../utils/responseHandler";
import sendEmail from "../utils/mail";
import { ClientSession, ObjectId, Types } from "mongoose";
import mongoose from "mongoose";
import Inventory, { IInventory } from "../schemas/Inventory";
import { AdminProduct } from "../schemas/AdminProduct";
import { BadRequestError } from "../utils/errors";
import Team from "../schemas/Team";

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
  clientId?: String,
  teamId?: String
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
        teamId,
        size,
        color: color || null,
        vat,
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

// Function to get the next clientId
const getNextClientId = async (session: ClientSession): Promise<string> => {
  // Find the highest existing clientId in the clients collection
  const lastClient = await Client.findOne()
    .sort({ clientId: -1 })
    .session(session)
    .lean();
  let maxSequence = 0;
  if (
    lastClient &&
    lastClient.clientId &&
    lastClient.clientId.startsWith("CLIENT-")
  ) {
    const lastNumber = parseInt(lastClient.clientId.replace("CLIENT-", ""), 10);
    if (!isNaN(lastNumber)) {
      maxSequence = lastNumber;
    }
  }

  const nextSequence = maxSequence + 1;

  return `CLIENT-${String(nextSequence).padStart(3, "0")}`;
};

export const createClient = async (
  req: Request,
  res: Response
): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { teamId } = req.query;
    const {
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
    const userId = new Types.ObjectId(req.userId);

    // Validate required fields
    if (
      !clientName ||
      !clientEmail?.trim() ||
      !registeredName ||
      !userId ||
      !preference ||
      !teamId
    ) {
      throw new BadRequestError(
        "Required fields: clientName, clientEmail, registeredName, userId, preference, teamId"
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

    const user = await User.findById(userId).session(session);
    if (!user) {
      throw new BadRequestError("Invalid user");
    }

    const existingUser = await User.findOne({ email: clientEmail }).session(
      session
    );
    if (existingUser) {
      throw new BadRequestError("Client email already exists");
    }

    const [offlineUser]: IUser[] = await User.create(
      [
        {
          firstName: clientName,
          lastName: "-",
          email: clientEmail,
          password: Math.random().toString(36).substring(2).toLocaleUpperCase(),
          companyName: registeredName,
          companyEmail: clientEmail,
          companyReferenceNumber: Math.random()
            .toString(36)
            .substring(2)
            .toLocaleUpperCase(),
          isOfflineUser: true,
          roles: ["Buyer"],
        },
      ],
      { session }
    );

    console.log(`offline user created: ${offlineUser}`);

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
      userId: new Types.ObjectId(offlineUser._id),
      clientName,
      workanniversary: workanniversary ? new Date(workanniversary) : null,
      clientEmail,
      registeredName,
      registeredAddress: registeredAddress || "",
      countryName: countryName || "",
      clientNotes: clientNotes || "",
      companyReferenceNumber: companyReferenceNumber || clientId,
      createdBy: userId,
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
      {
        $addToSet: {
          clientId: newClient._id,
          client: { userId: offlineUser._id, clientId: newClient._id },
        },
      },
      { upsert: true, session }
    );

    // Add products in parallel
    if (Array.isArray(products) && products.length > 0) {
      await Promise.all(
        products.map((product: IInventory) =>
          addStockOnInventory(
            offlineUser._id,
            product,
            session,
            String(newClient._id),
            String(teamId)
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

    console.log("addClientToUser - Request body:", {
      clientId,
      clientData,
      userId,
    });

    // Validate inputs
    if (!userId || !Types.ObjectId.isValid(userId)) {
      responseHandler(res, 400, "Invalid or missing userId", "error");
      return;
    }
    if (!clientId || !Types.ObjectId.isValid(clientId)) {
      responseHandler(
        res,
        400,
        "Invalid or missing clientId; must be a valid ObjectId",
        "error"
      );
      return;
    }

    // Validate client exists
    const existingClient = await Client.findById(clientId);
    if (!existingClient) {
      responseHandler(res, 404, "Client not found", "error");
      return;
    }

    // Validate clientData if provided
    let validClientEntries: {
      userId: Types.ObjectId;
      clientId: Types.ObjectId;
    }[] = [];
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
        responseHandler(
          res,
          400,
          "No valid client entries in clientData",
          "error"
        );
        return;
      }
    }

    // Update MyClient document
    const updateData: any = {
      $addToSet: { clientId: new Types.ObjectId(clientId) },
    };
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

    if (!userId || !Types.ObjectId.isValid(userId)) {
      responseHandler(res, 400, "Missing or invalid userId", "error");
      return;
    }

    // Fetch the logged-in user
    const user = await User.findById(userId);
    if (!user) {
      responseHandler(res, 404, "User not found", "error");
      return;
    }

    // Find the team where this user is a member
    const team = await Team.findOne({ "members.email": user.email });
    if (!team) {
      responseHandler(res, 404, "Team not found for this user", "error");
      return;
    }

    // Get current member info
    const memberInfo = team.members?.find((m) => m.email === user.email);
    if (!memberInfo) {
      responseHandler(res, 400, "User not found in team members", "error");
      return;
    }

    // Determine if user is admin
    const isAdmin = memberInfo.roles.includes("Admin");

    // Define variable with correct type
    let targetUserId: Types.ObjectId;

    if (isAdmin) {
      // If Admin → show their own clients
      targetUserId = new Types.ObjectId(user._id);
      // console.log(Admin user (${user.email}) - showing own clients);
    } else {
      // If not Admin → find team admin
      const adminMember = team.members?.find((m) => m.roles.includes("Admin"));
      if (!adminMember) {
        responseHandler(res, 404, "Team admin not found", "error");
        return;
      }

      const adminUser = await User.findOne({ email: adminMember.email });
      if (!adminUser) {
        responseHandler(res, 404, "Admin user not found in system", "error");
        return;
      }

      targetUserId = new Types.ObjectId(adminUser._id);
      console.log(
        `Team member (${user.email}) - showing admin (${adminUser.email}) clients`
      );
    }

    // Fetch all clients created by the target user (admin or self)
    const pipeline = [
      { $match: { userId: targetUserId.toString() } },
      {
        $lookup: {
          from: "clients",
          localField: "clientId",
          foreignField: "_id",
          as: "clients",
        },
      },
      { $unwind: { path: "$clients", preserveNullAndEmptyArrays: false } },
      {
        $lookup: {
          from: "users",
          localField: "clients.createdBy",
          foreignField: "_id",
          as: "clients.createdBy",
        },
      },
      {
        $unwind: {
          path: "$clients.createdBy",
          preserveNullAndEmptyArrays: true,
        },
      },
      { $replaceRoot: { newRoot: "$clients" } },
      {
        $project: {
          _id: 1,
          userId: 1,
          clientId: 1,
          clientName: 1,
          clientEmail: 1,
          registeredName: 1,
          workanniversary: 1,
          registeredAddress: 1,
          deliveryAddress: 1,
          countryName: 1,
          clientNotes: 1,
          companyReferenceNumber: 1,
          relatedClientIds: 1,
          creditLimit: 1,
          preference: 1,
          supplier: 1,
          createdBy: 1,
          createdAt: 1,
          updatedAt: 1,
          isOfflineUser: 1,
        },
      },
      { $sort: { createdAt: -1 } },
    ];

    const clients: any[] = await (MyClient as any).aggregate(pipeline);

    console.log("Client", clients);

    // Map for cleaner response
    const mappedClients = clients.map((client) => ({
      _id: client._id?.toString(),
      userId: client.userId?.toString() || "",
      clientId: client.clientId,
      clientName: client.clientName,
      clientEmail: client.clientEmail,
      registeredName: client.registeredName,
      workanniversary: client.workanniversary
        ? new Date(client.workanniversary).toISOString()
        : null,
      registeredAddress: client.registeredAddress || "",
      deliveryAddress: client.deliveryAddress || "",
      countryName: client.countryName || "",
      clientNotes: client.clientNotes || "",
      companyReferenceNumber: client.companyReferenceNumber || "",
      relatedClientIds:
        client.relatedClientIds?.map((id: any) => id.toString()) || [],
      creditLimit: client.creditLimit || { amount: 0, period: 0 },
      preference: client.preference || "Client",
      supplier: client.supplier || undefined,
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
      createdAt: client.createdAt?.toISOString(),
      updatedAt: client.updatedAt?.toISOString(),
      isOfflineUser: client.createdBy.isOfflineUser,
    }));

    responseHandler(res, 200, "Clients fetched successfully", "success", {
      isAdmin,
      count: mappedClients.length,
      clients: mappedClients,
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
    console.log("MyClient document:", myClientDoc);
    const excludedClientIds = myClientDoc?.clientId || [];
    const excludedClientUserIds = (myClientDoc?.client
      ?.map((c) => c.userId)
      .filter((id) => id) ?? []) as unknown as Types.ObjectId[];

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

    console.log("Found clients:", clients);

    const users = await User.find({
      $and: [
        {
          $or: [
            { firstName: { $regex: searchRegex } },
            { lastName: { $regex: searchRegex } },
            { companyName: { $regex: searchRegex } },
            { companyReferenceNumber: { $regex: searchRegex } },
          ],
        },
        { email: { $ne: req.userEmail } }, // exclude self
        { _id: { $nin: excludedClientUserIds } }, // exclude already added clients
      ],
    }).select(
      "firstName lastName companyName email companyReferenceNumber createdAt updatedAt"
    );

    // Validate clients and map to plain object
    const validClientsArray = clients
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

    const validUsers = users.map((user: any) => ({
      _id: user._id.toString(),
      type: "user",
      userId: user._id.toString(),
      clientName: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
      clientEmail: user.email,
      registeredName: user.companyName || "",
      companyReferenceNumber: user.companyReferenceNumber || "",
      createdAt: user.createdAt?.toISOString(),
      updatedAt: user.updatedAt?.toISOString(),
    }));

    const validClients = [...validClientsArray, ...validUsers];
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

    console.log("updateClient - Request params and body:", {
      clientId,
      updatedClientData,
    });

    // Validate clientId
    if (
      !clientId ||
      typeof clientId !== "string" ||
      !clientId.startsWith("CLIENT-")
    ) {
      responseHandler(
        res,
        400,
        "Invalid or missing clientId; must be a string starting with 'CLIENT-'",
        "error"
      );
      return;
    }

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
        !VALID_CREDIT_PERIODS.includes(
          Number(updatedClientData.creditLimit.period)
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
      !["Client", "Supplier", "Both"].includes(updatedClientData.preference)
    ) {
      responseHandler(
        res,
        400,
        "Preference must be 'Client', 'Supplier', or 'Both'",
        "error"
      );
      return;
    }

    if (
      updatedClientData.supplier &&
      finalPreference !== "Supplier" &&
      finalPreference !== "Both"
    ) {
      responseHandler(
        res,
        400,
        "Supplier fields can only be set for Supplier or Both preference",
        "error"
      );
      return;
    }

    if (
      updatedClientData.deliveryAddress &&
      finalPreference !== "Client" &&
      finalPreference !== "Both"
    ) {
      responseHandler(
        res,
        400,
        "Delivery address can only be set for Client or Both preference",
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
        if (!VALID_CREDIT_PERIODS.includes(Number(supplier.creditLimitDays))) {
          responseHandler(
            res,
            400,
            "Supplier credit limit days must be one of: 0, 1, 7, 14, 30, 60, 90",
            "error"
          );
          return;
        }
      }

      const emailFields = [
        supplier.invoiceEmail,
        supplier.returnToSupplierEmail,
        supplier.quantityIssueEmail,
        supplier.qualityIssueEmail,
        supplier.deliveryDelayIssueEmail,
      ].filter((email) => email !== undefined && email !== "");
      const invalidEmails = emailFields.filter(
        (email) => !EMAIL_REGEX.test(email.trim())
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
      createdAt: client.createdAt ? client.createdAt.toISOString() : undefined,
      updatedAt: client.updatedAt ? client.updatedAt.toISOString() : undefined,
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
      params: req.params,
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

    console.log("Received userId:", userId, "clientId:", clientId);

    // Validate inputs
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error("Invalid or missing userId");
    }
    if (!clientId || typeof clientId !== "string") {
      throw new Error("Invalid or missing clientId");
    }

    // Find the client
    const client = await Client.findOne({ clientId }).session(session);
    console.log("Client query result:", client);
    if (!client) {
      throw new Error(`Client with ID ${clientId} not found`);
    }

    // Check if the authenticated user is the creator or has the client in MyClient
    const isCreator = client.createdBy?.toString() === userId;
    const myClient = await MyClient.findOne({
      userId: userId.toString(),
      clientId: client._id,
    }).session(session);
    if (!isCreator && !myClient) {
      throw new Error(`Client with ID ${clientId} does not belong to the user`);
    }

    const clientObjectId = client._id;

    // Delete associated inventory products
    const inventoryResult = await Inventory.deleteMany({
      clientId: clientObjectId,
    }).session(session);
    console.log("Deleted inventory products:", inventoryResult);

    // Delete the client
    const deleteClientResult = await Client.deleteOne({
      _id: clientObjectId,
    }).session(session);
    console.log("Delete client result:", deleteClientResult);
    if (deleteClientResult.deletedCount === 0) {
      throw new Error("Failed to delete client");
    }

    // Update MyClient to remove the client
    const updateMyClientResult = await MyClient.findOneAndUpdate(
      { userId: userId.toString() },
      {
        $pull: {
          clientId: clientObjectId,
          client: {
            userId: client.userId,
            clientId: clientObjectId,
          },
        },
      },
      { new: true, session }
    );
    console.log("Update MyClient result:", updateMyClientResult);

    // Delete the offline user associated with the client
    const offlineUser = await User.findById(client.userId).session(session);
    if (offlineUser && offlineUser.isOfflineUser) {
      const deleteUserResult = await User.deleteOne({
        _id: client.userId,
      }).session(session);
      console.log("Deleted offline user:", deleteUserResult);
    }

    await session.commitTransaction();
    session.endSession();
    responseHandler(
      res,
      200,
      "Client and associated data removed successfully",
      "success"
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
    const { clientId } = req.params; // This is the string clientId (e.g., CLIENT-001)
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    // Validate inputs
    if (!userId || !Types.ObjectId.isValid(userId)) {
      responseHandler(res, 400, "Invalid or missing userId", "error");
      return;
    }
    if (
      !clientId ||
      typeof clientId !== "string" ||
      !clientId.startsWith("CLIENT-")
    ) {
      responseHandler(
        res,
        400,
        "Invalid or missing clientId; must be a string starting with 'CLIENT-'",
        "error"
      );
      return;
    }

    // Find the client by clientId to get the ObjectId
    const client = await Client.findOne({ clientId }).select("_id").lean();
    if (!client) {
      responseHandler(res, 404, "Client not found", "error");
      return;
    }

    const clientObjectId = client._id; // Get the ObjectId of the client

    // Aggregation pipeline
    const pipeline = [
      {
        $match: {
          clientId: new Types.ObjectId(clientObjectId), // Match the ObjectId
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
          adminProductName: { $ifNull: ["$adminProduct.productName", null] },
          productCode: { $ifNull: ["$adminProduct.productCode", null] },
          alias: { $ifNull: ["$adminProduct.productAlias", null] },
          productType: { $ifNull: ["$adminProduct.productType", null] },
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
      clientId: req.params.clientId,
    });
    responseHandler(
      res,
      error.message.includes("not found") ? 404 : 500,
      error.message || "Internal server error",
      "error"
    );
  }
};
