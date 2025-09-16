import { Request, Response } from "express";
import Client, { IClient } from "../schemas/ClientDetails";
import User from "../schemas/User";
import MyClient from "../schemas/MyClient";
import { responseHandler } from "../utils/responseHandler";
import sendEmail from "../utils/mail";
import { Types } from "mongoose";

const excludeId = (doc: any) => {
  const { _id, ...rest } = doc.toObject();
  return rest;
};


export const createClient = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      clientId,
      userId, // Add userId to destructured fields
      clientName,
      workanniversary,
      clientEmail,
      registeredName,
      registeredAddress,
      deliveryAddress,
      clientNotes,
      creditLimit,
      creditLimitPeriod,
    } = req.body;

    if (!clientId || !clientName || !clientEmail?.trim() || !registeredName || !userId) {
      responseHandler(
        res,
        400,
        "Required fields: clientId, clientName, clientEmail, registeredName, userId",
        "error"
      );
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(clientEmail.trim())) {
      responseHandler(res, 400, "Invalid client email format", "error");
      return;
    }

    const clientIdRegex = /^[a-zA-Z0-9-]+$/;
    if (!clientIdRegex.test(clientId)) {
      responseHandler(
        res,
        400,
        "Invalid clientId format. Use alphanumeric characters and hyphens only.",
        "error"
      );
      return;
    }

    const existingClient = await Client.findOne({
      $or: [{ clientId }, { clientEmail }],
    });
    if (existingClient) {
      responseHandler(
        res,
        400,
        existingClient.clientId === clientId
          ? "Client ID already exists"
          : "Client email already exists",
        "error"
      );
      return;
    }

    const createdBy = req.userId;
    if (!createdBy) {
      responseHandler(res, 401, "Authentication required", "error");
      return;
    }

    const user = await User.findById(createdBy);
    if (!user) {
      responseHandler(res, 400, "Invalid user", "error");
      return;
    }

    // Validate userId matches createdBy
    if (userId !== createdBy) {
      responseHandler(res, 403, "User ID does not match authenticated user", "error");
      return;
    }

    const newClient = new Client({
      clientId,
      userId, // Use userId from request body
      clientName,
      workanniversary: workanniversary ? new Date(workanniversary) : null,
      clientEmail,
      registeredName,
      registeredAddress: registeredAddress || "",
      deliveryAddress: deliveryAddress || "",
      clientNotes: clientNotes || "",
      companyReferenceNumber: clientId,
      creditLimit: creditLimit || 0,
      creditLimitPeriod: creditLimitPeriod || "",
      createdBy, // Keep createdBy for backward compatibility
    });

    await newClient.save();

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <p>Hello <strong>${clientName}</strong>,</p>
        <p>You have been successfully added as a client for <strong>${
          user.companyName || "our company"
        }</strong>.</p>
        <p><strong>Client ID:</strong> ${clientId}</p>
        <p><strong>Company Reference Number:</strong> ${clientId}</p>
        <p><strong>Registered Name:</strong> ${registeredName}</p>
        <p><strong>Registered Address:</strong> ${
          registeredAddress || "Not provided"
        }</p>
        <p><strong>Delivery Address:</strong> ${
          deliveryAddress || "Not provided"
        }</p>
        <p><strong>Notes:</strong> ${clientNotes || "None"}</p>
        <p><strong>Credit Limit:</strong> ${creditLimit || 0}</p>
        <p><strong>Credit Limit Period:</strong> ${
          creditLimitPeriod || "Not specified"
        }</p>
        <p>If you have any questions, please contact our support team.</p>
        <hr style="margin-top: 20px; border: none; border-top: 1px solid #eee;">
        <p style="font-size: 12px; color: #999;">© ${new Date().getFullYear()} Toprak Team. All rights reserved.</p>
      </div>
    `;

    const mailSent = await sendEmail({
      to: clientEmail,
      subject: "Welcome! You Have Been Added as a Client",
      html,
    });

    if (!mailSent) {
      console.warn("createClient - Failed to send email to:", clientEmail);
    }

    responseHandler(
      res,
      201,
      "Client created successfully",
      "success",
      newClient
    );
  } catch (error: any) {
    console.error("createClient - Error:", {
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

export const addClientToUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { clientId, client: clientData } = req.body;
    const userId = req.userId;

    console.log("addClientToUser - Request body:", req.body);

    // Basic validation
    if (!userId || !clientId || !Array.isArray(clientData)) {
      responseHandler(res, 400, "Missing required fields", "error");
      return;
    }

    if (!Types.ObjectId.isValid(clientId)) {
      responseHandler(res, 400, "Invalid clientId", "error");
      return;
    }

    // Optional: validate that client exists
    const existingClient = await Client.findById(clientId);
    if (!existingClient) {
      responseHandler(res, 404, "Client not found", "error");
      return;
    }

    // Validate each item in clientData
    const validClientEntries = clientData
      .filter(
        (entry) =>
          Types.ObjectId.isValid(entry.userId) &&
          Types.ObjectId.isValid(entry.clientId)
      )
      .map((entry) => ({
        userId: new Types.ObjectId(entry.userId),
        clientId: new Types.ObjectId(entry.clientId),
      }));

    if (validClientEntries.length === 0) {
      responseHandler(res, 400, "No valid client entries", "error");
      return;
    }

    // Update MyClient document
    const updatedMyClient = await MyClient.findOneAndUpdate(
      { userId: userId.toString() },
      {
        $addToSet: {
          clientId: new Types.ObjectId(clientId), // Add to flat array
          client: { $each: validClientEntries }, // Add to nested array
        },
      },
      { upsert: true, new: true }
    )
      .populate("clientId")
      .populate("client.clientId")
      .populate("client.userId");

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
    });
    responseHandler(res, 500, "Internal server error", "error");
  }
};

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
        "clientId userId clientName clientEmail registeredName workanniversary registeredAddress deliveryAddress clientNotes companyReferenceNumber createdBy",
    });

    if (
      !myClientDoc ||
      !myClientDoc.clientId ||
      myClientDoc.clientId.length === 0
    ) {
      responseHandler(res, 200, "No clients found for this user", "success", {
        count: 0,
        clients: [],
      });
      return;
    }

    // Validate populated clients
    const clients = myClientDoc.clientId.filter((client: any) => {
      if (!client.clientName || !client.clientId) {
        console.warn("getClientsForUser - Invalid client data:", client);
        return false;
      }
      return true;
    }) as unknown as IClient[];

    const count = clients.length;

    responseHandler(res, 200, "Clients fetched successfully", "success", {
      count,
      clients,
    });
  } catch (error: any) {
    responseHandler(res, 500, "Internal server error", "error");
  }
};

export const getAllClients = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      responseHandler(res, 400, "Missing userId", "error");
      return;
    }

    const myClientDoc = await MyClient.findOne({ userId: userId.toString() });
    const excludedClientIds = myClientDoc?.clientId || [];

    const clients = await Client.find({
      _id: { $nin: excludedClientIds },
      clientEmail: { $ne: req.userEmail },
    });

    // Validate clients
    const validClients = clients.filter((client) => {
      if (!client.clientName || !client.clientId) {
        console.warn("getAllClients - Invalid client data:", client);
        return false;
      }
      return true;
    });

    const count = validClients.length;

    responseHandler(res, 200, "Clients fetched successfully", "success", {
      count,
      clients: validClients,
    });
  } catch (error: any) {
    responseHandler(res, 500, "Internal server error", "error");
  }
};

export const getClientById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { clientId } = req.params;
    const client = await Client.findOne({ clientId }).populate(
      "createdBy",
      "firstName lastName companyName companyReferenceNumber"
    );
    if (!client || !client.clientName || !client.clientId) {
      console.warn("getClientById - Invalid client data:", client);
      responseHandler(res, 404, "Client not found or invalid data", "error");
      return;
    }
    responseHandler(
      res,
      200,
      "Client fetched successfully",
      "success",
      excludeId(client)
    );
  } catch (error: any) {
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

    delete updatedClientData.clientId;

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

    // Construct response with createdBy fallback
    const clientData = {
      _id: client._id.toString(),
      clientId: client.clientId,
      clientName: client.clientName,
      clientEmail: client.clientEmail,
      registeredName: client.registeredName,
      workanniversary: client.workanniversary
        ? client.workanniversary.toISOString()
        : null,
      registeredAddress: client.registeredAddress,
      deliveryAddress: client.deliveryAddress,
      clientNotes: client.clientNotes,
      companyReferenceNumber: client.companyReferenceNumber,
      relatedClientIds: client.relatedClientIds.map((id) => id.toString()),
      createdBy: client.createdBy
        ? {
            _id: client.createdBy._id.toString(),
            firstName: client.createdBy.firstName || "",
            lastName: client.createdBy.lastName || "",
            companyName: client.createdBy.companyName || "",
            companyReferenceNumber:
              client.createdBy.companyReferenceNumber || "",
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
    responseHandler(
      res,
      500,
      error.message || "Internal server error",
      "error"
    );
  }
};
export const deleteClient = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.userId;
    const { clientId } = req.body;

    if (!userId || !clientId) {
      responseHandler(res, 400, "Missing userId or clientId", "error");
      return;
    }

    if (!Types.ObjectId.isValid(clientId)) {
      responseHandler(res, 400, "Invalid clientId format", "error");
      return;
    }

    const updateResult = await MyClient.findOneAndUpdate(
      { userId: userId.toString() },
      { $pull: { clientId: new Types.ObjectId(clientId) } },
      { new: true }
    ).populate("clientId");

    if (!updateResult) {
      responseHandler(res, 404, "User or client not found", "error");
      return;
    }

    responseHandler(res, 200, "Client removed successfully", "success", {
      updatedClients: updateResult.clientId,
      count: updateResult.clientId.length,
    });
  } catch (error: any) {
    responseHandler(res, 500, "Internal server error", "error");
  }
};
