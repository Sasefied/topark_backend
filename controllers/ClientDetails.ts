import { Request, Response } from "express";
import Client, { IClient } from "../schemas/ClientDetails";
import User from "../schemas/User";
import { responseHandler } from "../utils/responseHandler";
import sendEmail from "../utils/mail";
import { Types } from "mongoose";

const excludeId = (doc: any) => {
  const { _id, ...rest } = doc.toObject();
  return rest;
};

export const createClient = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      clientId,
      clientName,
      workanniversary,
      clientEmail,
      registeredName,
      registeredAddress,
      deliveryAddress,
      clientNotes,
    } = req.body;

    if (!clientId || !clientName || !clientEmail || !registeredName) {
      responseHandler(
        res,
        400,
        "Required fields: clientId, clientName, clientEmail, registeredName",
        "error"
      );
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(clientEmail)) {
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
      console.log("createClient - User not found for createdBy:", createdBy);
      responseHandler(res, 400, "Invalid user", "error");
      return;
    }

    const newClient: Partial<IClient> = {
      clientId,
      clientName,
      workanniversary: workanniversary ? new Date(workanniversary) : null,
      clientEmail,
      registeredName,
      registeredAddress: registeredAddress || "",
      deliveryAddress: deliveryAddress || "",
      clientNotes: clientNotes || "",
      createdBy: new Types.ObjectId(user._id),
      companyReferenceNumber: clientId, // Store clientId as companyReferenceNumber for consistency
    };

    const client = new Client(newClient);
    await client.save();

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

    responseHandler(res, 201, "Client created successfully", "success", client);
  } catch (error: any) {
    responseHandler(res, 500, "Internal server error", "error");
  }
};

export const getUsersForClientList = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Fetch all clientIds (companyReferenceNumber) from the Client collection
    const existingClients = await Client.find({}, { clientId: 1 });

    // Filter users whose companyReferenceNumber is not in clientIds
    const existingClientIds = existingClients.map((client) => client.clientId);

    const users = await User.find(
      { companyReferenceNumber: { $nin: existingClientIds } },
      {
        _id: 1,
        firstName: 1,
        lastName: 1,
        email: 1,
        companyName: 1,
        companyReferenceNumber: 1,
      }
    );

    responseHandler(res, 200, "Users fetched successfully", "success", users);
  } catch (error: any) {
    console.error("Fetch Users Error:", {
      message: error.message,
      stack: error.stack,
    });
    responseHandler(res, 500, "Internal server error", "error");
  }
};

export const getAllClients = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const clients = await Client.find().populate(
      "createdBy",
      "firstName lastName companyName companyReferenceNumber"
    );
    responseHandler(
      res,
      200,
      "Clients fetched successfully",
      "success",
      clients
    );
  } catch (error) {
    responseHandler(res, 500, "Internal server error");
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
    if (!client) {
      responseHandler(res, 404, "Client not found");
      return;
    }
    responseHandler(
      res,
      200,
      "Client fetched successfully",
      "success",
      excludeId(client)
    );
  } catch (error) {
    responseHandler(res, 500, "Internal server error");
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
    delete updatedClientData.createdBy;

    const client = await Client.findOneAndUpdate(
      { clientId },
      updatedClientData,
      { new: true, runValidators: true }
    ).populate("createdBy", "firstName lastName companyName");

    if (!client) {
      responseHandler(res, 404, "Client not found");
      return;
    }
    responseHandler(res, 200, "Client updated successfully", "success", client);
  } catch (error) {
    responseHandler(res, 500, "Internal server error");
  }
};

export const deleteClient = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { clientId } = req.params;
    const client = await Client.findOneAndDelete({ clientId });
    if (!client) {
      responseHandler(res, 404, "Client not found");
      return;
    }
    responseHandler(res, 204, "Client deleted successfully");
  } catch (error) {
    responseHandler(res, 500, "Internal server error");
  }
};
