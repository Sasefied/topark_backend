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



// STEP 1: Save Team Name

export const saveTeamName = async (req: Request, res: Response): Promise<void> => {
  const { teamName } = req.body;
  const userId = req.userId;
  console.log("saveTeamName - Input:", { userId, teamName });

  if (!teamName || typeof teamName !== "string" || teamName.trim() === "") {
    console.log("saveTeamName - Error: Invalid team name");
    responseHandler(res, 400, "Team name is required and must be a non-empty string");
    return;
  }

  try {
    const existingTeam = await Team.findOne({ teamName });
    if (existingTeam) {
      console.log("saveTeamName - Error: Team name already exists", existingTeam);
      responseHandler(res, 400, "Team name already exists. Please choose another.");
      return;
    }

    const creatorUser = await User.findById(userId);
    if (!creatorUser) {
      console.log("saveTeamName - Error: User not found for ID", userId);
      responseHandler(res, 404, "User not found");
      return;
    }

    const team = new Team({
      teamName,
      createdBy: new mongoose.Types.ObjectId(userId),
      members: [
        {
          user: userId,
          email: creatorUser.email,
          roles: ["Admin"],
          status: "active",
        },
      ],
    });

    const savedTeam = await team.save();
    console.log("saveTeamName - Team saved:", JSON.stringify(savedTeam, null, 2));

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { teamId: savedTeam._id },
      { new: true }
    );
    console.log("saveTeamName - Updated user:", JSON.stringify(updatedUser, null, 2));

    if (!updatedUser) {
      console.log("saveTeamName - Error: Failed to update user with teamId");
      responseHandler(res, 500, "Failed to update user with teamId");
      return;
    }

    responseHandler(
      res,
      201,
      "Team name saved successfully. Proceed to set primary usage.",
      "success",
      savedTeam
    );
  } catch (error) {
    console.error("saveTeamName - Error:", error);
    responseHandler(res, 500, "Internal server error");
  }
};


// STEP 2: Update Primary Usage

export const updatePrimaryUsage = async (req: Request, res: Response): Promise<void> => {
  const { primaryUsage } = req.body;
  const userId = req.userId;
  console.log("User ID:", userId);
  console.log("Primary Usage:", primaryUsage);

  const allowedValues = ["Only Buying", "Buying and Selling"];
  if (!primaryUsage || !allowedValues.includes(primaryUsage)) {
    responseHandler(res, 400, "Primary usage must be one of: Only Buying, Buying and Selling");
    return;
  }

  try {
    const team = await Team.findOneAndUpdate(
      { createdBy: userId },
      { primaryUsage },
      { new: true, runValidators: true }
    );
    console.log("Found team:", team);

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


// 4. Accept the invitation came via email.
// export const acceptInvitation = async (req: Request, res: Response) => {
//   const { token, firstName, lastName, password, consentGiven } = req.body;

//   if (!token || !firstName || !lastName || !password || !consentGiven) {
//     return responseHandler(
//       res,
//       400,
//       "All fields including consent are required"
//     );
//   }

//   try {
//     const decoded = jwt.verify(token, config.JWT_INVITE_SECRET) as {
//       email: string;
//       roles: string[];
//       teamId: string;
//     };

//     // Fetch the team to get the team name as companyName
//     const team = await Team.findById(decoded.teamId);
//     if (!team) {
//       return responseHandler(res, 400, "Team not found");
//     }
//     const companyName = team.teamName || "Unknown Company";

//     let user = await User.findOne({ email: decoded.email });
//     const hashedPassword = await bcrypt.hash(password, 10);

//     if (!user) {
//       user = new User({
//         firstName,
//         lastName,
//         email: decoded.email,
//         password: hashedPassword,
//         roles: decoded.roles || [], 
//         teamId: new mongoose.Types.ObjectId(decoded.teamId),
//         companyName: companyName,
//       });
//       await user.save();
//     } else {
//       // Update existing user details
//       user.firstName = firstName;
//       user.lastName = lastName;
//       user.password = hashedPassword;
//       if (decoded.roles && Array.isArray(decoded.roles) && user) {
//         // Add new roles that don't already exist
//         decoded.roles.forEach((role) => {
//           if (user && !user.roles.includes(role)) {
//             user.roles.push(role);
//           }
//         });
//       }
//       if (user) {
//         user.teamId = new mongoose.Types.ObjectId(decoded.teamId);
//         user.companyName = companyName;
//         await user.save();
//       }
//     }

//     // Update team member status to "active"
//     await Team.updateOne(
//       { _id: decoded.teamId, "members.email": decoded.email },
//       { $set: { "members.$.status": "active" } }
//     );

//     // Generate auth token for the user
//     const authToken = jwt.sign(
//       { id: user._id, email: user.email, teamId: user.teamId },
//       config.JWT_SECRET,
//       { expiresIn: "7d" }
//     );

//     responseHandler(
//       res,
//       200,
//       "Invitation accepted and account activated/updated",
//       "success",
//       { token: authToken, user }
//     );
//   } catch (error) {
//     return responseHandler(res, 400, "Invalid or expired invitation token");
//   }
// };



export const acceptInvitation = async (req: Request, res: Response) => {
  const { token, firstName, lastName, password, consentGiven } = req.body;

  if (!token || !firstName || !lastName || !password || !consentGiven) {
    return responseHandler(res, 400, "All fields including consent are required");
  }

  try {
    console.log("AcceptInvitation - Input:", { token, firstName, lastName, consentGiven });

    // Verify JWT
    const decoded = jwt.verify(token, config.JWT_INVITE_SECRET) as {
      email: string;
      roles: string[];
      teamId: string;
    };
    console.log("AcceptInvitation - Decoded token:", decoded);

    // Fetch team
    const team = await Team.findById(decoded.teamId);
    if (!team) {
      console.log("AcceptInvitation - Team not found for ID:", decoded.teamId);
      return responseHandler(res, 400, "Team not found");
    }
    const companyName = team.teamName || "Unknown Company";
    console.log("AcceptInvitation - Team found:", { teamId: team._id, teamName: companyName });

    // Validate password
    const passwordStrengthRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordStrengthRegex.test(password)) {
      console.log("AcceptInvitation - Invalid password format");
      return responseHandler(
        res,
        400,
        "Password must include uppercase, lowercase, and a number, and be at least 8 characters long."
      );
    }

    // Hash password
    console.log("AcceptInvitation - Hashing password");
    const hashedPassword = await bcrypt.hash(password, 10);

    // Find or create user
    let user = await User.findOne({ email: decoded.email });
    console.log("AcceptInvitation - User lookup:", { email: decoded.email, userExists: !!user });

    if (!user) {
      console.log("AcceptInvitation - Creating new user");
      user = new User({
        firstName,
        lastName,
        email: decoded.email,
        password: hashedPassword,
        roles: decoded.roles || [],
        teamId: new mongoose.Types.ObjectId(decoded.teamId),
        companyName: companyName,
        consentGiven: true,
      });
      await user.save();
      console.log("AcceptInvitation - New user saved:", user._id);
    } else {
      console.log("AcceptInvitation - Updating existing user");
      user.firstName = firstName;
      user.lastName = lastName;
      user.password = hashedPassword;
      if (decoded.roles && Array.isArray(decoded.roles)) {
        decoded.roles.forEach((role) => {
          if (!user!.roles.includes(role)) {
            user!.roles.push(role);
          }
        });
      }
      user.teamId = new mongoose.Types.ObjectId(decoded.teamId);
      user.companyName = companyName;
      user.consentGiven = true;
      await user.save();
      console.log("AcceptInvitation - Existing user updated:", user._id);
    }

    // Update team member status
    console.log("AcceptInvitation - Updating team member status");
    const updateResult = await Team.updateOne(
      { _id: decoded.teamId, "members.email": decoded.email },
      { $set: { "members.$.status": "active" } }
    );
    console.log("AcceptInvitation - Team update result:", updateResult);

    if (updateResult.matchedCount === 0) {
      console.log("AcceptInvitation - No matching member found in team");
      return responseHandler(res, 400, "User not found in team members");
    }

    // Generate auth token
    console.log("AcceptInvitation - Generating auth token");
    const authToken = jwt.sign(
      { id: user._id, email: user.email, teamId: user.teamId, roles: user.roles },
      config.JWT_SECRET,
      { expiresIn: "7d" }
    );

    responseHandler(
      res,
      200,
      "Invitation accepted successfully",
      "success",
      { token: authToken, user: { id: user._id, email: user.email, roles: user.roles, teamId: user.teamId } }
    );
  } catch (error: any) {
    console.error("AcceptInvitation - Error:", error.message, error.stack);
    if (error.name === "ValidationError") {
      return responseHandler(res, 400, `Validation error: ${error.message}`);
    }
    if (error.name === "TokenExpiredError") {
      return responseHandler(res, 400, "Invitation token has expired");
    }
    if (error.name === "JsonWebTokenError") {
      return responseHandler(res, 400, "Invalid invitation token");
    }
    return responseHandler(res, 500, "Internal server error");
  }
};