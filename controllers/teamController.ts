import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import Team from "../schemas/Team";
import User from "../schemas/User";
import config from "../config";
import sendEmail from "../utils/mail";
import { responseHandler } from "../utils/responseHandler";
import { SignOptions } from "jsonwebtoken";

/**
 * @swagger
 * /api/team/onboarding/team-name:
 *   post:
 *     summary: Save Team Name During Onboarding
 *     description: Allows an authenticated user to save their team name as part of the onboarding process.
 *     tags:
 *       - Team Onboarding
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: Authorization
 *         required: true
 *         description: Bearer token for authorization.
 *         schema:
 *           type: string
 *           example: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
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
 *                 description: The name of the team to be created.
 *                 example: Toprak Innovators
 *     responses:
 *       201:
 *         description: Team name saved successfully.
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
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: 663b0f1a4f1a2c001f3b0e5d
 *                     teamName:
 *                       type: string
 *                       example: Toprak Innovators
 *                     createdBy:
 *                       type: string
 *                       example: 663b0f1a4f1a2c001f3b0e5c
 *       400:
 *         description: Team name is required.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Team name is required
 *       401:
 *         description: Unauthorized - Missing or invalid bearer token.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Unauthorized
 *       500:
 *         description: Internal server error.
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
    const team = new Team({ teamName, createdBy: userId });
    await team.save();

    responseHandler(res, 201, "Team name saved successfully", "success", team);
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
 *     description: Allows the user to set the primary usage of the team (Buying, Selling, or both).
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
 *                     teamName:
 *                       type: string
 *                     primaryUsage:
 *                       type: string
 *       400:
 *         description: Invalid or missing primary usage value
 *       404:
 *         description: Team not found
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
      "Primary usage updated successfully",
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
 *     description: Adds one or more members to the team with specified roles and sends them email invitations to join the team.
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
 *                 items:
 *                   type: object
 *                   required:
 *                     - email
 *                     - role
 *                   properties:
 *                     email:
 *                       type: string
 *                       format: email
 *                       example: "member@example.com"
 *                     role:
 *                       type: string
 *                       enum: [Trader, Seller, Supplier, Operations, Cashier, Sales, Accountant, Admin]
 *                       example: "Trader"
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
 *                             example: pending
 *       400:
 *         description: Invalid members data provided
 *       404:
 *         description: Team not found for this user
 *       500:
 *         description: Internal server error
 */

// STEP 3: Add Team Members & Send Invite Email
export const addTeamMembers = async (req: Request, res: Response) => {
  const userId = req.userId;
  const { members } = req.body;

  try {
    if (!Array.isArray(members) || members.length === 0) {
      return responseHandler(res, 400, "Members list is required");
    }

    for (const member of members) {
      if (!member.email || !member.role) {
        return responseHandler(
          res,
          400,
          "Each member must have an email and role"
        );
      }
    }

    const team = await Team.findOne({ createdBy: userId });
    if (!team) {
      return responseHandler(res, 404, "Team not found for this user");
    }

    for (const member of members) {
      const existingMember = team.members?.find(
        (m) => m.email === member.email
      );

      if (existingMember) {
        // Merge new role if not already present
        if (!existingMember.roles.includes(member.role)) {
          existingMember.roles.push(member.role);
        }
      } else {
        // Add new member
        team.members?.push({
          email: member.email,
          roles: [member.role],
          status: "pending",
        });
      }
    }

    const updatedTeam = await team.save();

    // Send invitation emails
    for (const member of members) {
      const token = jwt.sign(
        {
          email: member.email,
          role: member.role,
          teamId: team._id,
        },
        config.JWT_INVITE_SECRET,
        {
          expiresIn: config.JWT_INVITE_EXPIRES_IN,
        } as SignOptions
      );

      const inviteLink = `${
        config.MY_APP_FRONTEND_URL
      }/invite/accept?token=${token}&email=${encodeURIComponent(member.email)}`;

      const html = `
        <p>Hello,</p>
        <p>You’ve been invited to join the team as a <strong>${member.role}</strong>.</p>
        <p>Please click the button below to set your name and password:</p>
        <a
          href="${inviteLink}"
          style="
            background-color: #007bff;
            color: white;
            padding: 10px 20px;
            text-decoration: none;
            border-radius: 5px;
            display: inline-block;
            font-weight: bold;
          "
          target="_blank"
        >
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
      "Team members added and invitations sent",
      "success",
      updatedTeam
    );
  } catch (error) {
    console.error("Add Team Members Error:", error);
    responseHandler(res, 500, "Internal server error");
  }
};

/**
 * @swagger
 * /api/team/onboarding/invite/accept:
 *   post:
 *     summary: Accept Team Invitation and Register or Activate User
 *     description: |
 *       Accepts an invitation sent via email, validates the token, and either:
 *       - Registers a new user if they do not exist.
 *       - Activates their team membership if they already have an account.
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
 *             properties:
 *               token:
 *                 type: string
 *                 description: JWT invitation token received via email.
 *                 example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *               firstName:
 *                 type: string
 *                 description: First name of the user (required even for existing users to confirm identity).
 *                 example: John
 *               lastName:
 *                 type: string
 *                 description: Last name of the user (required even for existing users to confirm identity).
 *                 example: Doe
 *               password:
 *                 type: string
 *                 description: Password for the account (required even for existing users to confirm identity).
 *                 example: StrongPassword123!
 *     responses:
 *       200:
 *         description: Invitation accepted and account activated or updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Invitation accepted and account activated/updated
 *       400:
 *         description: Invalid or expired invitation token or missing required fields.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Invalid or expired invitation token
 */

// STEP 4: Accept Invitation and Register
export const acceptInvitation = async (req: Request, res: Response) => {
  const { token, firstName, lastName, password } = req.body;

  if (!token || !firstName || !lastName || !password) {
    return responseHandler(res, 400, "All fields are required");
  }

  try {
    const decoded = jwt.verify(token, config.JWT_INVITE_SECRET) as {
      email: string;
      role: string;
      teamId: string;
    };

    let user = await User.findOne({ email: decoded.email });

    if (!user) {
      const hashedPassword = await bcrypt.hash(password, 10);
      user = new User({
        firstName,
        lastName,
        email: decoded.email,
        password: hashedPassword,
        role: decoded.role, // Consider merging roles if user already exists
      });

      await user.save();
    }

    // Update team member status to "active"
    await Team.updateOne(
      { _id: decoded.teamId, "members.email": decoded.email },
      { $set: { "members.$.status": "active" } }
    );

    responseHandler(
      res,
      200,
      "Invitation accepted and account activated/updated"
    );
  } catch (error) {
    console.error("Accept Invitation Error:", error);
    responseHandler(res, 400, "Invalid or expired invitation token");
  }
};
