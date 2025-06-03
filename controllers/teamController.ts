import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import Team from "../schemas/Team";
import User from "../schemas/User";
import config from "../config";
import sendEmail from "../utils/mail";
import { responseHandler } from "../utils/responseHandler";
import jwt, { SignOptions } from "jsonwebtoken";
import mongoose from "mongoose";
import { totalmem } from "os";

type TeamRoles =
  | "Admin"
  | "Buyer"
  | "Seller"
  | "Cashier"
  | "Accountant"
  | "Operations";
interface TeamMemberInput {
  email: string;
  roles: TeamRoles[];
}

/**
 * @swagger
 * /api/team/onboarding/team-name:
 *   post:
 *     summary: Save team name and register the creator as Admin
 *     tags:
 *       - Team Onboarding
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - teamName
 *             properties:
 *               teamName:
 *                 type: string
 *                 example: Toprak Traders
 *     responses:
 *       201:
 *         description: Team name saved successfully with creator added as Admin
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
 *                   example: Team name saved successfully
 *       400:
 *         description: Team name is required
 *       500:
 *         description: Internal server error
 */

// STEP 1: Save Team Name
export const saveTeamName = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { teamName } = req.body;
  const userId = req.userId;

  if (!teamName) {
    responseHandler(res, 400, "Team name is required");
    return;
  }

  try {
    const existingTeam = await Team.findOne({ teamName });
    if (existingTeam) {
      responseHandler(
        res,
        400,
        "Team name already exists. Please choose another."
      );
      return;
    }

    const creatorUser = await User.findById(userId);
    if (!creatorUser) {
      responseHandler(res, 404, "User not found");
      return;
    }

    const team = new Team({
      teamName,
      createdBy: userId,
      members: [
        {
          user: userId,
          email: creatorUser.email,
          roles: ["Admin"],
          status: "active",
        },
      ],
    });

    await team.save();

    await User.findByIdAndUpdate(userId, { teamId: team._id }, { new: true });

    responseHandler(
      res,
      201,
      "Team name saved successfully. Proceed to set primary usage.",
      "success",
      team
    );
  } catch (error) {
    console.error("Error saving team name:", error);
    responseHandler(res, 500, "Internal server error");
  }
};

/**
 * @swagger
 * /api/team/onboarding/primary-usage:
 *   patch:
 *     summary: Update the primary usage of the team
 *     description: Allows the user to set the primary usage of the team (Buying, Selling, or Buying and Selling).
 *     tags:
 *       - Team Onboarding
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - primaryUsage
 *             properties:
 *               primaryUsage:
 *                 type: string
 *                 enum: [Buying, Selling, Buying and Selling]
 *                 example: Buying and Selling
 *     responses:
 *       200:
 *         description: Primary usage updated successfully
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
 *                   example: Primary usage updated successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: 663b0f1a4f1a2c001f3b0e5d
 *                     teamName:
 *                       type: string
 *                       example: Toprak Innovators
 *                     primaryUsage:
 *                       type: string
 *                       example: Buying and Selling
 *       400:
 *         description: Invalid or missing primary usage value
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Primary usage must be one of: Buying, Selling, or Buying and Selling"
 *       404:
 *         description: Team not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Team not found
 *       500:
 *         description: Internal server error
 */

// STEP 2: Update Primary Usage
export const updatePrimaryUsage = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { primaryUsage } = req.body;
  const userId = req.userId;

  const allowedValues = ["Buying", "Selling", "Buying and Selling"];
  if (!primaryUsage || !allowedValues.includes(primaryUsage)) {
    responseHandler(
      res,
      400,
      "Primary usage must be one of: Buying, Selling, or Buying and Selling"
    );
    return;
  }

  try {
    const team = await Team.findOneAndUpdate(
      { createdBy: userId },
      { primaryUsage },
      { new: true, runValidators: true }
    );

    if (!team) {
      responseHandler(res, 404, "Team not found");
      return;
    }

    responseHandler(
      res,
      200,
      "Primary usage set successfully. Proceed to add your team members.",
      "success",
      team
    );
  } catch (error) {
    console.error("Error updating primary usage:", error);
    responseHandler(res, 500, "Internal server error");
  }
};

/**
 * @swagger
 * /api/team/onboarding/team-members:
 *   post:
 *     summary: Add team members and send invitation emails
 *     description: >
 *       Adds one or more members to the team with specified roles and sends them email invitations to join the team.
 *       The creator is auto-added as Admin with active status if not already present.
 *     tags:
 *       - Team Onboarding
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - members
 *             properties:
 *               members:
 *                 type: array
 *                 description: List of members to add with email and role.
 *                 items:
 *                   type: object
 *                   required:
 *                     - email
 *                     - roles
 *                   properties:
 *                     email:
 *                       type: string
 *                       format: email
 *                       example: "member@example.com"
 *                     roles:
 *                       type: string
 *                       enum: [Admin, Buyer, Seller, Cashier, Accountant, Operations]
 *                       example: "Buyer"
 *     responses:
 *       200:
 *         description: Team members added and invitations sent successfully
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
 *                   example: Team members added and invitations sent
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     teamName:
 *                       type: string
 *                     members:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           email:
 *                             type: string
 *                           roles:
 *                             type: array
 *                             items:
 *                               type: string
 *                           status:
 *                             type: string
 *                             enum: [active, pending]
 *                             example: pending
 *       400:
 *         description: Invalid members data provided or user email missing from context
 *       404:
 *         description: Team not found for this user
 *       500:
 *         description: Internal server error
 */

// STEP 3: Add Team Members & Send Invite Email
export const addTeamMembers = async (req: Request, res: Response) => {
  const userId = req.userId;
  const { members } = req.body;

  const validRoles: TeamRoles[] = [
    "Admin",
    "Buyer",
    "Seller",
    "Cashier",
    "Accountant",
    "Operations",
  ];

  try {
    // Validate members payload
    if (!Array.isArray(members) || members.length === 0) {
      return responseHandler(res, 400, "Members list is required");
    }

    for (const member of members as TeamMemberInput[]) {
      if (
        !member.email ||
        !Array.isArray(member.roles) ||
        member.roles.length === 0
      ) {
        return responseHandler(
          res,
          400,
          "Each member must have an email and at least one role"
        );
      }
      for (const role of member.roles) {
        if (!validRoles.includes(role)) {
          return responseHandler(res, 400, `Invalid role: ${role}`);
        }
      }
    }

    // Find team based on user
    const team = await Team.findOne({ createdBy: userId });
    if (!team) {
      return responseHandler(res, 404, "Team not found for this user");
    }

    if (!req.userEmail) {
      return responseHandler(
        res,
        400,
        "User email is missing from request context"
      );
    }

    const teamId = team._id as mongoose.Types.ObjectId;

    for (const member of members) {
      const existingMember = team.members?.find(
        (m) => m.email === member.email
      );

      const existingUser = await User.findOne({ email: member.email });

      if (existingMember) {
        const currentRoles = existingMember.roles as string[];
        const newRoles = member.roles.filter(
          (role: string) => !currentRoles.includes(role)
        );
        existingMember.roles = [...currentRoles, ...newRoles];
      } else {
        const newMember: any = {
          email: member.email,
          roles: member.roles,
          status: "pending",
        };

        if (existingUser) {
          newMember.user = existingUser._id;
          if (
            !existingUser.teamId ||
            existingUser.teamId.toString() !== teamId.toString()
          ) {
            existingUser.teamId = teamId;
            await existingUser.save();
          }
        }

        team.members?.push(newMember);
      }
    }

    const updatedTeam = await team.save();

    for (const member of members as TeamMemberInput[]) {
      const token = jwt.sign(
        {
          email: member.email,
          roles: member.roles,
          teamId: team._id,
        },
        config.JWT_INVITE_SECRET,
        { expiresIn: config.JWT_INVITE_EXPIRES_IN } as SignOptions
      );

      const inviteLink = `${
        config.MY_APP_FRONTEND_URL
      }/invite/accept?token=${token}&email=${encodeURIComponent(member.email)}`;

      const rolesText = member.roles.join(", ");

      const html = `
        <p>Hello,</p>
        <p>You’ve been invited to join the team as a <strong>${rolesText}</strong>.</p>
        <p>Please click the button below to set your name and password:</p>
        <a href="${inviteLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;" target="_blank">
          Accept Invitation
        </a>
        <p style="margin-top: 10px;">This link will expire in <strong>${config.JWT_INVITE_EXPIRES_IN}</strong>.</p>
      `;

      await sendEmail({
        to: member.email,
        subject: `You're Invited to Join ${team.teamName} on TopRak`,
        html,
      });
    }

    responseHandler(
      res,
      200,
      "Team members added successfully. Invitations have been sent.",
      "success",
      updatedTeam
    );
  } catch (error: any) {
    console.error("Add Team Members Error:", error.message || error);
    responseHandler(res, 500, "Internal server error");
  }
};

/**
 * @swagger
 * /api/team/onboarding/invite/accept:
 *   post:
 *     summary: Accept team invitation and activate user account
 *     description: >
 *       Accepts a team invitation using the provided token, registers or updates the user account,
 *       and requires consent to the terms and conditions.
 *       On success, returns a JWT token and the user information.
 *     tags:
 *       - Team Onboarding
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - firstName
 *               - lastName
 *               - password
 *               - consentGiven
 *             properties:
 *               token:
 *                 type: string
 *                 description: Invitation token sent to the user’s email
 *               firstName:
 *                 type: string
 *                 example: John
 *               lastName:
 *                 type: string
 *                 example: Doe
 *               password:
 *                 type: string
 *                 format: password
 *                 example: StrongP_ssw0rd
 *               consentGiven:
 *                 type: boolean
 *                 description: Must be true to accept terms and conditions
 *                 example: true
 *     responses:
 *       200:
 *         description: Invitation accepted and user account activated or updated
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
 *                   example: Invitation accepted and account activated/updated
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                       description: JWT token for user authentication
 *                     user:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         firstName:
 *                           type: string
 *                         lastName:
 *                           type: string
 *                         email:
 *                           type: string
 *                         roles:
 *                           type: array
 *                           items:
 *                             type: [string]
 *                         teamId:
 *                           type: string
 *                         companyName:
 *                           type: string
 *                           example: Toprak Trading Co.
 *       400:
 *         description: Invalid input data or expired/invalid token
 *       500:
 *         description: Internal server error
 */

// 4. Accept the invitation came via email.
export const acceptInvitation = async (req: Request, res: Response) => {
  const { token, firstName, lastName, password, consentGiven } = req.body;

  if (!token || !firstName || !lastName || !password || !consentGiven) {
    return responseHandler(
      res,
      400,
      "All fields including consent are required"
    );
  }

  try {
    const decoded = jwt.verify(token, config.JWT_INVITE_SECRET) as {
      email: string;
      roles: string[];
      teamId: string;
    };

    // Fetch the team to get the team name as companyName
    const team = await Team.findById(decoded.teamId);
    if (!team) {
      return responseHandler(res, 400, "Team not found");
    }
    const companyName = team.teamName || "Unknown Company";

    let user = await User.findOne({ email: decoded.email });
    const hashedPassword = await bcrypt.hash(password, 10);

    if (!user) {
      user = new User({
        firstName,
        lastName,
        email: decoded.email,
        password: hashedPassword,
        roles: decoded.roles || [], 
        teamId: new mongoose.Types.ObjectId(decoded.teamId),
        companyName: companyName,
      });
      await user.save();
    } else {
      // Update existing user details
      user.firstName = firstName;
      user.lastName = lastName;
      user.password = hashedPassword;
      if (decoded.roles && Array.isArray(decoded.roles) && user) {
        // Add new roles that don't already exist
        decoded.roles.forEach((role) => {
          if (user && !user.roles.includes(role)) {
            user.roles.push(role);
          }
        });
      }
      if (user) {
        user.teamId = new mongoose.Types.ObjectId(decoded.teamId);
        user.companyName = companyName;
        await user.save();
      }
    }

    // Update team member status to "active"
    await Team.updateOne(
      { _id: decoded.teamId, "members.email": decoded.email },
      { $set: { "members.$.status": "active" } }
    );

    // Generate auth token for the user
    const authToken = jwt.sign(
      { id: user._id, email: user.email, teamId: user.teamId },
      config.JWT_SECRET,
      { expiresIn: "7d" }
    );

    responseHandler(
      res,
      200,
      "Invitation accepted and account activated/updated",
      "success",
      { token: authToken, user }
    );
  } catch (error) {
    return responseHandler(res, 400, "Invalid or expired invitation token");
  }
};

