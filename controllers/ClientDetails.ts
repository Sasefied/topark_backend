import { Request, Response } from "express";
import Client, { IClient } from "../schemas/ClientDetails";
import User from "../schemas/User";
import MyClient from "../schemas/MyClient";
import { responseHandler } from "../utils/responseHandler";
import sendEmail from "../utils/mail";
import { Types } from "mongoose";
import mongoose from "mongoose";

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
    } = req.body;

    console.log("Request body:", req.body);

    // Validate required fields
    if (
      !clientId ||
      !clientName ||
      !clientEmail?.trim() ||
      !registeredName ||
      !userId ||
      !preference
    ) {
      responseHandler(
        res,
        400,
        "Required fields: clientId, clientName, clientEmail, registeredName, userId, preference",
        "error"
      );
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(clientEmail.trim())) {
      responseHandler(res, 400, "Invalid client email format", "error");
      return;
    }

    // Validate clientId format
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

    // Validate preference
    if (!["Client", "Supplier"].includes(preference)) {
      responseHandler(
        res,
        400,
        "Preference must be either 'Client' or 'Supplier'",
        "error"
      );
      return;
    }

    // Validate preference-specific fields
    if (preference === "Client" && !deliveryAddress?.trim()) {
      responseHandler(
        res,
        400,
        "Delivery address is required for Client preference",
        "error"
      );
      return;
    }

    if (preference === "Supplier") {
      const supplierEmailFields = [
        invoiceEmail,
        returnToSupplierEmail,
        quantityIssueEmail,
        qualityIssueEmail,
        deliveryDelayIssueEmail,
      ];
      const invalidEmails = supplierEmailFields.filter(
        (email) => email && !emailRegex.test(email.trim())
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

      if (supplierCreditLimitAmount !== undefined) {
        if (
          typeof supplierCreditLimitAmount !== "number" ||
          isNaN(supplierCreditLimitAmount) ||
          supplierCreditLimitAmount < 0
        ) {
          responseHandler(
            res,
            400,
            "Invalid supplierCreditLimitAmount. Must be a valid non-negative number.",
            "error"
          );
          return;
        }
      }

      if (supplierCreditLimitDays !== undefined) {
        if (
          !["0", "1", "7", "14", "30", "60", "90"].includes(
            supplierCreditLimitDays.toString()
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
    }

    // Validate creditLimit if provided
    if (creditLimit) {
      if (
        typeof creditLimit.amount !== "number" ||
        isNaN(creditLimit.amount) ||
        creditLimit.amount < 0
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
        creditLimit.period &&
        !["0", "1", "7", "14", "30", "60", "90"].includes(
          creditLimit.period.toString()
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
    }

    // Check for existing client
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

    // Verify authenticated user
    const createdBy = new mongoose.Types.ObjectId(req.userId);
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
    // if (userId !== createdBy) {
    //   responseHandler(
    //     res,
    //     403,
    //     "User ID does not match authenticated user",
    //     "error"
    //   );
    //   return;
    // }

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
    if (preference === "Client") {
      clientData.deliveryAddress = deliveryAddress || "";
      clientData.supplier = undefined; // Explicitly unset for Client
    } else if (preference === "Supplier") {
      clientData.deliveryAddress = undefined; // Explicitly unset for Supplier
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
    await newClient.save();

    // Prepare email content
    let html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <p>Hello <strong>${clientName}</strong>,</p>
        <p>You have been successfully added as a ${
          preference === "Client" ? "client" : "supplier"
        } for <strong>${user.companyName || "our company"}</strong>.</p>
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

    if (preference === "Client") {
      html += `
        <p><strong>Delivery Address:</strong> ${deliveryAddress || "Not provided"}</p>
      `;
    } else if (preference === "Supplier") {
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
      subject: `Welcome! You Have Been Added as a ${preference === "Client" ? "Client" : "Supplier"}`,
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

// export const createClient = async (req: Request, res: Response): Promise<void> => {
//   try {
//     const {
//       clientId,
//       userId,
//       clientName,
//       workanniversary,
//       clientEmail,
//       registeredName,
//       registeredAddress,
//       deliveryAddress,
//       clientNotes,
//       companyReferenceNumber,
//       creditLimit,
//     } = req.body;

//     console.log("Request body:", req.body);

//     // Validate required fields
//     if (!clientId || !clientName || !clientEmail?.trim() || !registeredName || !userId) {
//       responseHandler(
//         res,
//         400,
//         "Required fields: clientId, clientName, clientEmail, registeredName, userId",
//         "error"
//       );
//       return;
//     }

//     // Validate email format
//     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//     if (!emailRegex.test(clientEmail.trim())) {
//       responseHandler(res, 400, "Invalid client email format", "error");
//       return;
//     }

//     // Validate clientId format
//     const clientIdRegex = /^[a-zA-Z0-9-]+$/;
//     if (!clientIdRegex.test(clientId)) {
//       responseHandler(
//         res,
//         400,
//         "Invalid clientId format. Use alphanumeric characters and hyphens only.",
//         "error"
//       );
//       return;
//     }

//     // Validate creditLimit if provided
//     if (creditLimit) {
//       // Ensure amount is a valid number
//       if (typeof creditLimit.amount !== 'number' || isNaN(creditLimit.amount)) {
//         responseHandler(res, 400, "Invalid creditLimit.amount. Must be a valid number.", "error");
//         return;
//       }
//       // Validate period if provided
//       if (creditLimit.period && !['1', '7', '14', '30', '60', '90'].includes(creditLimit.period)) {
//         responseHandler(
//           res,
//           400,
//           "Credit limit period must be one of: 1, 7, 14, 30, 60, 90",
//           "error"
//         );
//         return;
//       }
//     }

//     // Check for existing client
//     const existingClient = await Client.findOne({
//       $or: [{ clientId }, { clientEmail }],
//     });
//     if (existingClient) {
//       responseHandler(
//         res,
//         400,
//         existingClient.clientId === clientId
//           ? "Client ID already exists"
//           : "Client email already exists",
//         "error"
//       );
//       return;
//     }

//     // Verify authenticated user
//     const createdBy = req.userId;
//     if (!createdBy) {
//       responseHandler(res, 401, "Authentication required", "error");
//       return;
//     }

//     const user = await User.findById(createdBy);
//     if (!user) {
//       responseHandler(res, 400, "Invalid user", "error");
//       return;
//     }

//     // Validate userId matches createdBy
//     if (userId !== createdBy) {
//       responseHandler(res, 403, "User ID does not match authenticated user", "error");
//       return;
//     }

//     // Construct the creditLimit object
//     const creditLimitData = creditLimit
//       ? {
//           amount: creditLimit.amount,
//           period: creditLimit.period || undefined, // Set to undefined if not provided
//         }
//       : { amount: 0 }; // Default if creditLimit is not provided

//     const newClient = new Client({
//       clientId,
//       userId,
//       clientName,
//       workanniversary: workanniversary ? new Date(workanniversary) : null,
//       clientEmail,
//       registeredName,
//       registeredAddress: registeredAddress || "",
//       deliveryAddress: deliveryAddress || "",
//       clientNotes: clientNotes || "",
//       companyReferenceNumber: companyReferenceNumber || clientId,
//       creditLimit,
//     });

//     await newClient.save();

//     // Prepare email content
//     const html = `
//       <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
//         <p>Hello <strong>${clientName}</strong>,</p>
//         <p>You have been successfully added as a client for <strong>${
//           user.companyName || "our company"
//         }</strong>.</p>
//         <p><strong>Client ID:</strong> ${clientId}</p>
//         <p><strong>Company Reference Number:</strong> ${companyReferenceNumber || clientId}</p>
//         <p><strong>Registered Name:</strong> ${registeredName}</p>
//         <p><strong>Registered Address:</strong> ${
//           registeredAddress || "Not provided"
//         }</p>
//         <p><strong>Delivery Address:</strong> ${
//           deliveryAddress || "Not provided"
//         }</p>
//         <p><strong>Notes:</strong> ${clientNotes || "None"}</p>
//          <p><strong>Credit Limit Period:</strong> ${
//           creditLimit.period || "Not specified"
//         }</p>
//         <p>If you have any questions, please contact our support team.</p>
//         <hr style="margin-top: 20px; border: none; border-top: 1px solid #eee;">
//         <p style="font-size: 12px; color: #999;">© ${new Date().getFullYear()} Toprak Team. All rights reserved.</p>
//       </div>
//     `;

//     const mailSent = await sendEmail({
//       to: clientEmail,
//       subject: "Welcome! You Have Been Added as a Client",
//       html,
//     });

//     if (!mailSent) {
//       console.warn("createClient - Failed to send email to:", clientEmail);
//     }

//     responseHandler(
//       res,
//       201,
//       "Client created successfully",
//       "success",
//       newClient
//     );
//   } catch (error: any) {
//     console.error("createClient - Error:", {
//       message: error.message,
//       stack: error.stack,
//       body: req.body,
//       validationErrors: error.errors || null,
//     });
//     if (error.name === "ValidationError") {
//       responseHandler(res, 400, `Validation error: ${error.message}`, "error");
//       return;
//     }
//     responseHandler(res, 500, "Internal server error", "error");
//   }
// };
export const addClientToUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { clientId, client: clientData } = req.body;
    const userId = req.userId;

    console.log("addClientToUser - Request body:", req.body, req.userId);

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

// export const getClientsForUser = async (
//   req: Request,
//   res: Response
// ): Promise<void> => {
//   try {
//     const userId = req.userId;

//     console.log("getClientsForUser - userId:", userId);

//     if (!userId) {
//       responseHandler(res, 400, "Missing userId", "error");
//       return;
//     }

//     // Verify user exists
//     const user = await User.findById(userId);
//     if (!user) {
//       console.warn("getClientsForUser - User not found:", userId);
//       responseHandler(res, 400, "Invalid user", "error");
//       return;
//     }

//     const myClientDoc = await MyClient.findOne({
//       userId: userId.toString(),
//     }).populate({
//       path: "clientId",
//       select:
//         "clientId userId clientName clientEmail registeredName workanniversary registeredAddress deliveryAddress clientNotes creditLimit companyReferenceNumber createdBy",
//     });

//     if (
//       !myClientDoc ||
//       !myClientDoc.clientId ||
//       myClientDoc.clientId.length === 0
//     ) {
//       responseHandler(res, 200, "No clients found for this user", "success", {
//         count: 0,
//         clients: [],
//       });
//       return;
//     }

//     // Validate populated clients and include creditLimit
//     const clients = myClientDoc.clientId
//       .filter((client: any) => {
//         if (!client.clientName || !client.clientId) {
//           console.warn("getClientsForUser - Invalid client data:", client);
//           return false;
//         }
//         return true;
//       })
//       .map((client: any) => ({
//         _id: client._id.toString(),
//         userId: client.userId,
//         clientId: client.clientId,
//         clientName: client.clientName,
//         clientEmail: client.clientEmail,
//         registeredName: client.registeredName,
//         workanniversary: client.workanniversary
//           ? client.workanniversary.toISOString()
//           : null,
//         registeredAddress: client.registeredAddress,
//         deliveryAddress: client.deliveryAddress,
//         clientNotes: client.clientNotes,
//         companyReferenceNumber: client.companyReferenceNumber,
//         creditLimit: client.creditLimit
//           ? {
//               amount: client.creditLimit.amount || 0,
//               period: client.creditLimit.period || null,
//             }
//           : { amount: 0, period: null },
//         createdBy: client.createdBy
//           ? {
//               _id: client.createdBy._id.toString(),
//               firstName: client.createdBy.firstName || "",
//               lastName: client.createdBy.lastName || "",
//               companyName: client.createdBy.companyName || "",
//               companyReferenceNumber:
//                 client.createdBy.companyReferenceNumber || "",
//             }
//           : null,
//       })) as IClient[];

//     const count = clients.length;

//     responseHandler(res, 200, "Clients fetched successfully", "success", {
//       count,
//       clients,
//     });
//   } catch (error: any) {
//     console.error("getClientsForUser - Error:", error);
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
      userId: { $ne: null },
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
          console.warn("getAllClients - Invalid client data:", client);
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

// export const getClientById = async (
//   req: Request,
//   res: Response
// ): Promise<void> => {
//   try {
//     const { clientId } = req.params;
//     const client = await Client.findOne({ clientId }).populate(
//       "createdBy",
//       "firstName lastName companyName companyReferenceNumber"
//     );
//     if (!client || !client.clientName || !client.clientId) {
//       console.warn("getClientById - Invalid client data:", client);
//       responseHandler(res, 404, "Client not found or invalid data", "error");
//       return;
//     }
//     // Ensure creditLimit is included in the response
//     const clientData = {
//       _id: client._id.toString(),
//       userId: client.userId ? client.userId.toString() : null,
//       clientId: client.clientId,
//       clientName: client.clientName,
//       clientEmail: client.clientEmail,
//       registeredName: client.registeredName,
//       workanniversary: client.workanniversary
//         ? client.workanniversary.toISOString()
//         : null,
//       registeredAddress: client.registeredAddress,
//       deliveryAddress: client.deliveryAddress,
//       clientNotes: client.clientNotes,
//       companyReferenceNumber: client.companyReferenceNumber,
//       relatedClientIds: client.relatedClientIds.map((id) => id.toString()),
//       creditLimit: {
//         amount: client.creditLimit?.amount || 0,
//         period: client.creditLimit?.period || null,
//       },
//       createdBy: client.createdBy
//         ? {
//             _id: client.createdBy._id.toString(),
//             firstName: client.createdBy.firstName || "",
//             lastName: client.createdBy.lastName || "",
//             companyName: client.createdBy.companyName || "",
//             companyReferenceNumber:
//               client.createdBy.companyReferenceNumber || "",
//           }
//         : null,
//     };
//     responseHandler(
//       res,
//       200,
//       "Client fetched successfully",
//       "success",
//       clientData
//     );
//   } catch (error: any) {
//     console.error("getClientById - Error:", error);
//     responseHandler(res, 500, "Internal server error", "error");
//   }
// };

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

// export const updateClient = async (
//   req: Request,
//   res: Response
// ): Promise<void> => {
//   try {
//     const { clientId } = req.params;
//     const updatedClientData: Partial<IClient> = req.body;

//     // Prevent updating clientId
//     delete updatedClientData.clientId;

//     // Validate workanniversary format
//     if (updatedClientData.workanniversary) {
//       updatedClientData.workanniversary = new Date(updatedClientData.workanniversary);
//       if (isNaN(updatedClientData.workanniversary.getTime())) {
//         responseHandler(res, 400, "Invalid workanniversary date format", "error");
//         return;
//       }
//     }

//     // Validate creditLimit if provided
//     if (updatedClientData.creditLimit) {
//       if (typeof updatedClientData.creditLimit.amount !== "number" || isNaN(updatedClientData.creditLimit.amount)) {
//         responseHandler(res, 400, "Invalid creditLimit.amount. Must be a valid number.", "error");
//         return;
//       }
//       if (
//         updatedClientData.creditLimit.period &&
//         !["1", "7", "14", "30", "60", "90"].includes(updatedClientData.creditLimit.period.toString())
//       ) {
//         responseHandler(res, 400, "Credit limit period must be one of: 1, 7, 14, 30, 60, 90", "error");
//         return;
//       }
//       updatedClientData.creditLimit.period = updatedClientData.creditLimit.period || 0;
//     }

//     // Validate preference if provided
//     if (updatedClientData.preference && !["Client", "Supplier"].includes(updatedClientData.preference)) {
//       responseHandler(res, 400, "Preference must be either 'Client' or 'Supplier'", "error");
//       return;
//     }

//     // Validate supplierEmails if preference is Supplier
//     if (updatedClientData.preference === "Supplier" && updatedClientData.supplierEmails) {
//       const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//       const supplierEmails = updatedClientData.supplierEmails;
//       const emailFields = [
//         supplierEmails.invoiceEmail,
//         supplierEmails.returnToSupplierEmail,
//         supplierEmails.qualityIssueEmail,
//         supplierEmails.quantityIssueEmail,
//         supplierEmails.deliveryDelayEmail,
//       ].filter(Boolean); // Filter out undefined or empty strings
//       const invalidEmails = emailFields.filter((email) => email && !emailRegex.test(email.trim()));
//       if (invalidEmails.length > 0) {
//         responseHandler(res, 400, "One or more supplier email fields have invalid format", "error");
//         return;
//       }
//     }

//     // Find and update the client
//     const client = await Client.findOneAndUpdate(
//       { clientId },
//       updatedClientData,
//       { new: true, runValidators: true }
//     ).populate("createdBy", "firstName lastName companyName companyReferenceNumber");

//     console.log("updateClient - Updated client:", { clientId, client });

//     if (!client || !client.clientName || !client.clientId) {
//       console.warn("updateClient - Invalid client data:", client);
//       responseHandler(res, 404, "Client not found or invalid data", "error");
//       return;
//     }

//     // Construct response with all fields including new ones
//     const clientData = {
//       _id: client._id.toString(),
//       userId: client.userId?.toString() || "",
//       clientId: client.clientId,
//       clientName: client.clientName,
//       clientEmail: client.clientEmail,
//       countryName: client.countryName || "",
//       registeredName: client.registeredName,
//       workanniversary: client.workanniversary ? client.workanniversary.toISOString() : null,
//       registeredAddress: client.registeredAddress,
//       deliveryAddress: client.deliveryAddress,
//       clientNotes: client.clientNotes,
//       companyReferenceNumber: client.companyReferenceNumber,
//       relatedClientIds: client.relatedClientIds?.map((id) => id.toString()) || [],
//       creditLimit: {
//         amount: client.creditLimit?.amount || 0,
//         period: client.creditLimit?.period || null,
//       },
//       preference: client.preference,
//       supplierEmails: client.supplierEmails || {
//         invoiceEmail: "",
//         issueReportingEmail: "",
//         returnToSupplierEmail: "",
//         qualityIssueEmail: "",
//         quantityIssueEmail: "",
//         deliveryDelayEmail: "",
//       },
//       createdBy: client.createdBy
//         ? {
//             _id: client.createdBy._id.toString(),
//             firstName: client.createdBy.firstName || "",
//             lastName: client.createdBy.lastName || "",
//             companyName: client.createdBy.companyName || "",
//             companyReferenceNumber: client.createdBy.companyReferenceNumber || "",
//           }
//         : null,
//     };

//     responseHandler(res, 200, "Client updated successfully", "success", clientData);
//   } catch (error: any) {
//     console.error("updateClient - Error:", {
//       message: error.message,
//       stack: error.stack,
//       body: req.body,
//       validationErrors: error.errors || null,
//     });
//     if (error.name === "ValidationError") {
//       responseHandler(res, 400, `Validation error: ${error.message}`, "error");
//       return;
//     }
//     responseHandler(res, 500, "Internal server error", "error");
//   }
// };

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
