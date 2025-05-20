// Imports and Configurations
import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt, { Secret, SignOptions } from "jsonwebtoken";
import User, { IUser } from "../schemas/User";
import config from "../config";
import { responseHandler } from "../utils/responseHandler";
import crypto from "crypto";
import sendEmail from "../utils/mail";

// JWT Secret and Expiration Configuration
const JWT_SECRET: Secret = config.JWT_SECRET || "default-secret";
const JWT_EXPIRES_IN: string | number = config.JWT_EXPIRES_IN || "7d";

/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     summary: Register a new user
 *     description: Creates a new user with first name, last name, company name, email, password, and consent.
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - lastName
 *               - companyName
 *               - email
 *               - password
 *               - consentGiven
 *             properties:
 *               firstName:
 *                 type: string
 *                 example: John
 *               lastName:
 *                 type: string
 *                 example: Doe
 *               companyName:
 *                 type: string
 *                 example: Toprak Trading Co.
 *               email:
 *                 type: string
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 example: Password123
 *               consentGiven:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: User already exists or missing required fields
 *       500:
 *         description: Internal server error
 */

// 1. Signup Controller
export const signup = async (req: Request, res: Response): Promise<void> => {
  const { firstName, lastName, companyName, email, password, consentGiven } =
    req.body;

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

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const user = new User({
      firstName,
      lastName,
      companyName,
      email,
      password: hashedPassword,
      consentGiven: !!consentGiven,
    });

    // Save user to database
    await user.save();

    responseHandler(res, 201, "User registered successfully");
  } catch (error) {
    console.error("Signup Error:", error);
    responseHandler(res, 500, "Internal server error");
  }
};

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: User Login
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 example: testuser@example.com
 *               password:
 *                 type: string
 *                 example: Password123
 *     responses:
 *       200:
 *         description: Login successful, returns JWT token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 user:
 *                   type: object
 *                   properties:
 *                     firstName:
 *                       type: string
 *                     lastName:
 *                       type: string
 *                     email:
 *                       type: string
 *       401:
 *         description: Invalid credentials
 */

// 2.login Controller: Controller for user login and JWT token issuance
export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  try {
    // Fetch user by email
    const userDoc = await User.findOne({ email });

    if (!userDoc) {
      responseHandler(res, 401, "Invalid credentials");
      return;
    }

    const user = userDoc.toObject() as IUser;

    // Validate password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      responseHandler(res, 401, "Invalid credentials");
      return;
    }

    // Create JWT payload
    const payload = {
      iss: "ToprakApp",
      sub: user._id.toString(),
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    };

    // Sign JWT token
    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    } as SignOptions);

    // Respond with token and user details
    res.status(200).json({
      token,
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    responseHandler(res, 500, "Internal server error");
  }
};

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Request password reset email
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 example: testuser@example.com
 *     responses:
 *       200:
 *         description: Reset password email sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Reset password email sent
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: error
 *                 message:
 *                   type: string
 *                   example: User not found
 *       500:
 *         description: Server error
 */

// 3.Forgot Password Controller: Controller to initiate password reset process by sending an email with reset link
export const forgotPassword = async (
  req: Request,
  res: Response
): Promise<void> => {
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

/**
 * @swagger
 * /api/auth/reset-password/{token}:
 *   post:
 *     summary: Reset password using the token received in the email
 *     tags:
 *       - Auth
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Reset password token received via email link
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newPassword
 *             properties:
 *               newPassword:
 *                 type: string
 *                 example: newSecurePassword123
 *     responses:
 *       200:
 *         description: Password has been reset successfully, and confirmation email has been sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Password has been reset successfully
 *       400:
 *         description: Invalid or expired reset token or missing required data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: error
 *                 message:
 *                   type: string
 *                   example: Invalid or expired reset token
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: error
 *                 message:
 *                   type: string
 *                   example: Internal server error
 */

// 4. Reset Password Controller: Controller to reset password using the token received in the email
export const resetPassword = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { newPassword } = req.body;
  const token = req.params.token;

  if (!token || !newPassword) {
    responseHandler(res, 400, "Token and new password are required");
    return;
  }

  // if (newPassword.length < 8) {
  //   responseHandler(res, 400, "Password must be at least 8 characters");
  //   return;
  // }

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

    user.password = await bcrypt.hash(newPassword, 10);
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
