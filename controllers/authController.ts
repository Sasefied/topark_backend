import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt, { Secret, SignOptions } from "jsonwebtoken";
import User, { IUser } from "../schemas/User";
import config from "../config";
import { responseHandler } from "../utils/responseHandler";
import crypto from "crypto";
import sendEmail from "../utils/mail";

const JWT_SECRET: Secret = config.JWT_SECRET || "default-secret";
const JWT_EXPIRES_IN: string | number = config.JWT_EXPIRES_IN || "7d";

/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     summary: Register a new user
 *     description: Creates a new user with first name, last name, email, password, and consent.
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
 *               - email
 *               - password
 *             properties:
 *               firstName:
 *                 type: string
 *                 example: John
 *               lastName:
 *                 type: string
 *                 example: Doe
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
 *         description: User already exists
 *       500:
 *         description: Internal server error
 */

// 1.signup Controller
export const signup = async (req: Request, res: Response): Promise<void> => {
  const { firstName, lastName, email, password, consentGiven } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      responseHandler(res, 400, "User already exists");
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      consentGiven: !!consentGiven,
    });

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

// 2.login Controller
export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  try {
    const userDoc = await User.findOne({ email });

    if (!userDoc) {
      responseHandler(res, 401, "Invalid credentials");
      return;
    }

    const user = userDoc.toObject() as IUser;

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      responseHandler(res, 401, "Invalid credentials");
      return;
    }

    const payload = {
      iss: "ToprakApp",
      sub: user._id.toString(),
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    };

    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    } as SignOptions);

    res.json({
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

// 3.Forgot Password Controller
export const forgotPassword = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      responseHandler(res, 404, "User not found");
      return;
    }

    // Generate secure token
    const resetToken = crypto.randomBytes(32).toString("hex");
    console.log("RESET TOKEN:", resetToken);
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await user.save();

    const resetURL = `${config.MY_APP_FRONTEND_URL}/reset-password/${resetToken}`;

    const html = `
      <p>Hello ${user.firstName},</p>
      <p>You requested a password reset. Click the link below to set a new password:</p>
      <a href="${resetURL}">${resetURL}</a>
      <p>If you didn’t request this, you can safely ignore this email.</p>
    `;

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
    console.error("Forgot Password Error:", error);
    responseHandler(res, 500, "Internal server error");
  }
};

/**
 * @swagger
 * /api/auth/reset-password/token:
 *   post:
 *     summary: Reset password using token
 *     tags:
 *       - Auth
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Reset password token from email link
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
 *         description: Password reset successful
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
 *         description: Invalid or expired reset token
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
 *         description: Server error
 */

// 4.Reset Password Controller
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

    responseHandler(res, 200, "Password has been reset successfully");
  } catch (error) {
    console.error("Reset Password Error:", error);
    responseHandler(res, 500, "Internal server error");
  }
};
