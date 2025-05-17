import { Request, Response } from "express";
import User from "../schemas/User";
import { responseHandler } from "../utils/responseHandler";
import Team from "../schemas/Team";

/**
 * @swagger
 * /api/admin/team-members:
 *   get:
 *     summary: Get members of the team created by the logged-in Admin
 *     description: >
 *       Retrieves all members of the team where the logged-in user is the Admin (creator).
 *       Only the members array is returned, not the entire team document.
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Team members fetched successfully
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
 *                   example: Team members fetched successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       user:
 *                         type: string
 *                         description: User ID reference
 *                         example: 682739b20bbd8ae918aa14fd
 *                       email:
 *                         type: string
 *                         description: Email of the team member
 *                         example: sreenu926@gmail.com
 *                       roles:
 *                         type: array
 *                         description: Roles assigned to the team member
 *                         items:
 *                           type: string
 *                           example: Admin
 *                       status:
 *                         type: string
 *                         enum: [pending, active, inactive]
 *                         example: active
 *                       _id:
 *                         type: string
 *                         description: Member entry ID in the team document
 *                         example: 682740518b71e6235ac34505
 *       401:
 *         description: Unauthorized - Bearer token missing or invalid
 *       404:
 *         description: No team found where you are the Admin (creator)
 *       500:
 *         description: Internal server error
 */

// 1. Fetch all Team members (users): GET  http://localhost:8000/api/admin/team-members
export const listTeamUsers = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return responseHandler(res, 401, "Unauthorized");
    }

    // ✅ Fetch only the team CREATED BY this user (Admin role by creation)
    const team = await Team.findOne({ createdBy: userId });

    if (!team) {
      return responseHandler(
        res,
        404,
        "No team found where you are the Admin (creator)"
      );
    }

    // ✅ Return the complete team document (not just members array)
    responseHandler(
      res,
      200,
      "Team fetched successfully",
      "success",
      team.members
    );
  } catch (error) {
    console.error("Error fetching team members:", error);
    responseHandler(res, 500, "Internal server error");
  }
};

/**
 * @swagger
 * /api/admin/team-members/{teamMemberId}:
 *   patch:
 *     summary: Edit a team member's details by Member Entry ID (not User ID)
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamMemberId
 *         schema:
 *           type: string
 *         required: true
 *         description: The ID of the team member entry in the team document
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *                 example: UpdatedFirstName
 *               lastName:
 *                 type: string
 *                 example: UpdatedLastName
 *               roles:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["Buyer", "Seller"]
 *     responses:
 *       200:
 *         description: Team member updated successfully
 *       400:
 *         description: Invalid input or bad request
 *       401:
 *         description: Unauthorized or team not found
 *       404:
 *         description: Team member not found in your team
 *       500:
 *         description: Internal server error
 */

//2. Edit user(team member) details PATCH /api/admin/team-members/:teamMemberId
export const updateTeamMember = async (req: Request, res: Response) => {
  try {
    const { teamMemberId } = req.params;
    const { firstName, lastName, roles } = req.body;

    const currentUser = await User.findById(req.userId);
    if (!currentUser) {
      return responseHandler(res, 401, "Unauthorized");
    }

    // ✅ Find the team where the logged-in user is the Admin (createdBy)
    const team = await Team.findOne({ createdBy: currentUser._id });
    if (!team) {
      return responseHandler(res, 404, "No team found where you are the Admin");
    }

    // ✅ Find the member by member _id
    const member = team.members?.find(
      (m) => m._id?.toString() === teamMemberId
    );

    if (!member) {
      return responseHandler(res, 404, "Team member not found in your team");
    }

    // ✅ Update roles if provided
    if (roles && Array.isArray(roles)) {
      member.roles = roles;
    }

    // ✅ Update linked User document if it exists
    if (member.user) {
      const userDoc = await User.findById(member.user);
      if (userDoc) {
        if (firstName) userDoc.firstName = firstName;
        if (lastName) userDoc.lastName = lastName;
        if (roles && Array.isArray(roles)) userDoc.roles = roles;
        await userDoc.save();
      }
    }

    // ✅ Save team updates
    await team.save();

    responseHandler(
      res,
      200,
      "Team member details updated successfully",
      "success",
      member
    );
  } catch (error) {
    console.error("Error updating team member:", error);
    responseHandler(res, 500, "Internal server error");
  }
};

/**
 * @swagger
 * /api/admin/team-members/{teamMemberId}/deactivate:
 *   patch:
 *     summary: Deactivate or suspend a team member by Member Entry ID (not User ID)
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamMemberId
 *         schema:
 *           type: string
 *         required: true
 *         description: The ID of the team member entry in the team document
 *     responses:
 *       200:
 *         description: User deactivated successfully
 *       400:
 *         description: Invalid input or bad request
 *       401:
 *         description: Unauthorized or team not found
 *       404:
 *         description: Team member not found in your team
 *       500:
 *         description: Internal server error
 */

// 3. Deactivate/suspend the user: PATCH /api/admin/team-members/:teamMemberId/deactivate
export const deactivateUser = async (req: Request, res: Response) => {
  try {
    const { teamMemberId } = req.params;

    const currentUser = await User.findById(req.userId);
    if (!currentUser) {
      return responseHandler(res, 401, "Unauthorized");
    }

    // ✅ Find the team where the logged-in user is the Admin (createdBy)
    const team = await Team.findOne({ createdBy: currentUser._id });
    if (!team) {
      return responseHandler(res, 404, "No team found where you are the Admin");
    }

    // ✅ Find the member by member _id
    const member = team.members?.find(
      (m) => m._id?.toString() === teamMemberId
    );

    if (!member) {
      return responseHandler(res, 404, "Team member not found in your team");
    }

    // ✅ Mark the member as "inactive"
    member.status = "inactive";
    await team.save();

    responseHandler(
      res,
      200,
      "User deactivated successfully",
      "success",
      member
    );
  } catch (error) {
    console.error("Error deactivating user:", error);
    responseHandler(res, 500, "Internal server error");
  }
};
