// Imports and Configurations
import { NextFunction, Request, Response } from "express";
import jwt, { Secret, SignOptions } from "jsonwebtoken";
import User, { IUser } from "../schemas/User";
import config from "../config";
import { responseHandler } from "../utils/responseHandler";
import Client from "../schemas/ClientDetails";
import crypto from "crypto";
import sendEmail from "../utils/mail";
import Team from "../schemas/Team";
import asyncHandler from "express-async-handler";
import { BadRequestError, NotFoundError } from "../utils/errors";
import mongoose from "mongoose";

// JWT Secret and Expiration Configuration
const JWT_SECRET: Secret = config.JWT_SECRET || "default-secret";
const JWT_EXPIRES_IN: string | number = config.JWT_EXPIRES_IN || "7d";

// 1. Signup Controller
const signup = async (req: Request, res: Response): Promise<void> => {
  const {
    firstName,
    lastName,
    companyName,
    companyReferenceNumber,
    email,
    companyEmail,
    password,
    consentGiven,
  } = req.body;

  try {
    // Validate consent
    if (!consentGiven) {
      responseHandler(res, 400, "Consent is required to create an account");
      return;
    }

    // Validate company name
    if (!companyName) {
      responseHandler(
        res,
        400,
        "Company name is required to create an account"
      );
      return;
    }
    // Validate company reference number
    if (!companyReferenceNumber) {
      responseHandler(
        res,
        400,
        "Company Reference Number is required to create an account"
      );
      return;
    }
    const existingcompanyReferenceNumber = await User.findOne({
      companyReferenceNumber,
    });
    if (existingcompanyReferenceNumber) {
      responseHandler(res, 400, "Comapny Reference Number already exists");
      return;
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      responseHandler(res, 400, "User already exists");
      return;
    }

    const passwordStrengthRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordStrengthRegex.test(password)) {
      responseHandler(
        res,
        400,
        "Password must include uppercase, lowercase, and a number, and be at least 8 characters long."
      );
      return;
    }

    // Create new user
    const user = new User({
      firstName,
      lastName,
      companyName,
      companyEmail,
      companyReferenceNumber,
      email,
      password,
      consentGiven: !!consentGiven,
      roles: ["Admin"],
    });

    // Save user to database
    await user.save();

    const newClient = new Client({
      clientId: companyReferenceNumber,
      clientName: `${firstName} ${lastName}`.trim(),
      registeredName: companyName,
      clientEmail: email,
    });

    await newClient.save();

    responseHandler(res, 201, "User registered successfully");
  } catch (error) {
    console.error("Signup Error:", error);
    responseHandler(res, 500, "Internal server error");
  }
};

const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  console.log("login - Request:", { email });

  if (!email || !password) {
    responseHandler(res, 400, "Email and password are required", "error");
    return;
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    responseHandler(res, 400, "Invalid email format", "error");
    return;
  }

  try {
    const userDoc = await User.findOne({ email });
    if (!userDoc) {
      console.log("login - User not found for email:", email);
      responseHandler(res, 401, "Invalid credentials", "error");
      return;
    }

    const user = userDoc.toObject() as IUser;
    const isMatch = user.isPasswordCorrect(password);
    if (!isMatch) {
      console.log("login - Password mismatch for email:", email);
      responseHandler(res, 401, "Invalid credentials", "error");
      return;
    }

    // Block inactive users
    if (user.status === "inactive") {
      console.log("login - Inactive user:", { userId: user._id, email });
      responseHandler(
        res,
        403,
        "Account is inactive. Contact your Admin.",
        "error"
      );
      return;
    }

    let team = await Team.findOne({ createdBy: user._id });
    if (!team && user.roles.includes("Admin")) {
      console.log("login - Creating team for admin:", {
        userId: user._id,
        email,
      });
      team = new Team({
        teamName: `${user.companyName || "Default"} Team`,
        createdBy: user._id,
        members: [
          {
            user: user._id,
            email: user.email,
            roles: ["Admin"],
            status: "active",
          },
        ],
      });
      await team.save();
      await User.findByIdAndUpdate(
        user._id,
        { teamId: team._id },
        { new: true }
      );
      console.log("login - Team created:", {
        teamId: team._id,
        teamName: team.teamName,
      });
    }

    const payload = {
      iss: "ToprakApp",
      sub: user._id.toString(),
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      roles: user.roles,
      teamId: team ? String(team._id) : null,
    };

    const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key"; // Fallback for development
    const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h";

    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    } as SignOptions);

    console.log("login - Generated token for user:", {
      userId: user._id.toString(),
      email: user.email,
      roles: user.roles,
      teamId: team ? String(team._id) : null,
    });

    res.status(200).json({
      status: "success",
      data: {
        token,
        user: {
          id: user._id.toString(), // Added id for authStore
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          roles: user.roles,
          teamId: team ? String(team._id) : null, // Added teamId for authStore
        },
        team: team
          ? {
              id: team._id,
              teamName: team.teamName,
              primaryUsage: team.primaryUsage || null,
            }
          : null,
      },
    });
  } catch (error: any) {
    console.error("login - Error:", {
      message: error.message,
      stack: error.stack,
      email,
    });
    responseHandler(res, 500, "Internal server error", "error");
  }
};
// export const login = async (req: Request, res: Response): Promise<void> => {
//   const { email, password } = req.body;

//   if (!email || !password) {
//     responseHandler(res, 400, "Email and password are required");
//     return;
//   }

//   // Validate email format
//   const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//   if (!emailRegex.test(email)) {
//     responseHandler(res, 400, "Invalid email format");
//     return;
//   }

//   try {
//     const userDoc = await User.findOne({ email });
//     if (!userDoc) {
//       responseHandler(res, 401, "Invalid credentials");
//       return;
//     }

//     const user = userDoc.toObject() as IUser;
//     const isMatch = await bcrypt.compare(password, user.password);
//     if (!isMatch) {
//       responseHandler(res, 401, "Invalid credentials");
//       return;
//     }

//     let team = await Team.findOne({ createdBy: user._id });
//     if (!team && user.roles.includes("Admin")) {
//       team = new Team({
//         teamName: `${user.companyName} Team`,
//         createdBy: user._id,
//         members: [
//           {
//             user: user._id,
//             email: user.email,
//             roles: ["Admin"],
//             status: "active",
//           },
//         ],
//       });
//       await team.save();
//       await User.findByIdAndUpdate(
//         user._id,
//         { teamId: team._id },
//         { new: true }
//       );
//     }

//     const payload = {
//       iss: "ToprakApp",
//       sub: user._id.toString(),
//       firstName: user.firstName,
//       lastName: user.lastName,
//       email: user.email,
//       roles: user.roles,
//       teamId: team ? String(team._id) : null,
//     };

//     const token = jwt.sign(payload, JWT_SECRET, {
//       expiresIn: JWT_EXPIRES_IN,
//     } as SignOptions);

//     res.status(200).json({
//       status: "success",
//       data: {
//         token,
//         user: {
//           firstName: user.firstName,
//           lastName: user.lastName,
//           email: user.email,
//           roles: user.roles,
//         },
//         team: team
//           ? {
//               id: team._id,
//               teamName: team.teamName,
//               primaryUsage: team.primaryUsage || null,
//             }
//           : null,
//       },
//     });
//   } catch (error) {
//     console.error("Login Error:", error);
//     responseHandler(res, 500, "Internal server error");
//   }
// };

// 3.Forgot Password Controller: Controller to initiate password reset process by sending an email with reset link
const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;
  if (!email) return responseHandler(res, 400, "Email is required");

  try {
    const user = await User.findOne({ email });
    if (!user) {
      responseHandler(res, 404, "User not found");
      return;
    }

    // Generate secure random token
    const resetToken = crypto.randomBytes(32).toString("hex");
    console.log("RESET TOKEN:", resetToken);

    // Hash the token for storage
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // Store hased token and expiry in user document
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    // Construct frontend reset URL
    console.log("Frontend URL:", config.MY_APP_FRONTEND_URL);
    const resetURL = `${config.MY_APP_FRONTEND_URL}/reset-password/${resetToken}`;

    // Email consent
    const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <p>Hello <strong>${user.firstName}</strong>,</p>
      <p>We received a request to reset your password. Please click the button below to set a new password:</p>
      <a
        href="${resetURL}"
        style="
          background-color: #28a745;
          color: white;
          padding: 10px 20px;
          text-decoration: none;
          border-radius: 5px;
          display: inline-block;
          font-weight: bold;
        "
        target="_blank"
      >
        Reset Password
      </a>
      <p style="margin-top: 10px;">This link will expire in <strong>1 hour</strong>.</p>
      <p>If you did not request this, you can safely ignore this email.</p>
      <hr style="margin-top: 20px; border: none; border-top: 1px solid #eee;">
      <p style="font-size: 12px; color: #999;">&copy; ${new Date().getFullYear()} Toprak Team. All rights reserved.</p>
    </div>
  `;

    console.log("RESET URL:", resetURL);
    console.log("ENV URL:", config.MY_APP_FRONTEND_URL);

    // Send an email
    const mailSent = await sendEmail({
      to: user.email,
      subject: "Password Reset",
      html,
    });

    if (mailSent) {
      responseHandler(res, 200, "Reset password email sent");
    } else {
      responseHandler(res, 500, "Error sending email");
    }
  } catch (error) {
    console.error("ForgotPassword Error:", { email });
    responseHandler(res, 500, "Internal server error");
  }
};

// 4. Reset Password Controller: Controller to reset password using the token received in the email
const resetPassword = async (req: Request, res: Response): Promise<void> => {
  const { newPassword } = req.body;
  const token = req.params.token;

  if (!token || !newPassword) {
    responseHandler(res, 400, "Token and new password are required");
    return;
  }

  const passwordStrengthRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  if (!passwordStrengthRegex.test(newPassword)) {
    responseHandler(
      res,
      400,
      "Password must include uppercase, lowercase, and a number, and be at least 8 characters long."
    );
    return;
  }

  try {
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      responseHandler(res, 400, "Invalid or expired reset token");
      return;
    }

    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    // Send confirmation email
    const userName = `${user.firstName} ${user.lastName}`.trim() || "User";
    const html = `
    <div style="font-family: Arial, sans-serif; font-size: 16px; color: #333;">
      <p>Dear <strong>${userName}</strong>,</p>

      <p>We are writing to confirm that your password has been <strong>successfully reset</strong>.</p>

      <p>If you did <strong>not</strong> request this change, please contact our support team <strong>immediately</strong> to secure your account.</p>

      <p>Thank you for choosing <strong>Toprak SCM Ltd.</strong>. We are committed to ensuring the safety and security of your account.</p>

      <p>Kind regards,<br/>
      The <strong>Toprak SCM Ltd.</strong> Team</p>
    </div>
  `;

    // Send an email
    const mailSent = await sendEmail({
      to: user.email,
      subject: "Password Reset Confirmation",
      html,
    });

    responseHandler(res, 200, "Password has been reset successfully");
  } catch (error: any) {
    console.error("Reset Password Error:", error.message || error);
    responseHandler(res, 500, "Internal server error");
  }
};

/**
 * Get user profile
 *
 * @async
 * @param  {Request} req - Express request object
 * @param  {Response} res - Express response object
 * @route   GET /api/v1/auth/profile
 * @access  Private
 * @returns {Promise<void>}
 */
const getUserProfile = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.userId;
    const user = await User.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(userId) } },
      {
        $lookup: {
          from: "teams",
          localField: "_id",
          foreignField: "createdBy",
          as: "teams",
        },
      },
      {
        $unwind: {
          path: "$teams",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 1,
          email: 1,
          firstName: 1,
          lastName: 1,
          teams: {
            _id: 1,
            teamName: 1,
            primaryUsage: 1,
          },
        },
      },
    ]);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    responseHandler(
      res,
      200,
      "User profile fetched successfully",
      "success",
      user
    );
  }
);

/**
 * Update user profile
 *
 * @async
 * @param  {Request} req - Express request object
 * @param  {Response} res - Express response object
 * @route   PUT /api/v1/auth/profile
 * @access  Private
 * @returns {Promise<void>}
 */
const updateUserProfile = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.userId;
    const {
      firstName,
      lastName,
      email,
      oldPassword,
      newPassword,
      primaryUsage,
    } = req.body;

    const session = await mongoose.startSession();
    await session.startTransaction();
    try {
      const user = await User.findById(userId).session(session);
      if (!user) {
        throw new NotFoundError("User not found");
      }

      if (oldPassword) {
        const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
        if (!isPasswordCorrect) {
          throw new BadRequestError("Invalid old password");
        }
        user.password = newPassword;
      }

      user.firstName = firstName;
      user.lastName = lastName;
      user.email = email;

      await user.save({ session });

      await Team.findOneAndUpdate(
        { createdBy: user._id },
        { primaryUsage }
      ).session(session);

      await session.commitTransaction();
      responseHandler(
        res,
        200,
        "User profile updated successfully",
        "success",
        {
          firstName,
          lastName,
          email,
        }
      );
    } catch (error) {
      await session.abortTransaction();
      next(error);
    } finally {
      await session.endSession();
    }
  }
);

/**
 * Delete user profile
 *
 * @async
 * @param  {Request} req - Express request object
 * @param  {Response} res - Express response object
 * @route   DELETE /api/v1/auth/profile
 * @access  Private
 */
const deleteUserProfile = asyncHandler(async (req: Request, res: Response) => {
  await User.findByIdAndDelete(req.userId);

  responseHandler(res, 200, "User profile deleted successfully");
});

export {
  login,
  signup,
  forgotPassword,
  resetPassword,
  getUserProfile,
  updateUserProfile,
  deleteUserProfile,
};
