import { Request, Response } from "express";
import User from "../schemas/User";
import { responseHandler } from "../utils/responseHandler";
import Team from "../schemas/Team";

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

//4. deleteMember
export const deleteMember = async (req: Request, res: Response) => {
  try {
    const { teamMemberId } = req.params;
    const userId = req.userId;
    if (!userId) {
      return responseHandler(res, 401, "Unauthorized");
    }
    const team = await Team.findOne({ createdBy: userId });
    if (!team) {
      return responseHandler(res, 404, "No team found where you are the Admin");
    }

    const memberIndex = team.members?.findIndex(
      (member) => member._id?.toString() === teamMemberId
    );

    if (memberIndex === undefined || memberIndex === -1) {
      return responseHandler(res, 404, "Team member not found in your team");
    }

    team.members?.splice(memberIndex, 1);
    await team.save();

    responseHandler(
      res,
      200,
      "Team member deleted successfully",
      "success",
      {}
    );
  } catch (error) {
    console.error("Error deleting team member:", error);
    responseHandler(res, 500, "Internal server error");
  }
};