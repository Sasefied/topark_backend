import { Request, Response } from "express";
import User from "../schemas/User";
import { responseHandler } from "../utils/responseHandler";
import Team from "../schemas/Team";

export const updateTeamMember = async (req: Request, res: Response) => {
  try {
    const { teamMemberId } = req.params;
    const { firstName, lastName, roles, teamId, teamName, status } = req.body;

    console.log("updateTeamMember - Request:", {
      teamMemberId,
      firstName,
      lastName,
      roles,
      teamId,
      teamName,
      status,
    });

    const currentUser = await User.findById(req.userId);
    if (!currentUser) {
      console.log("updateTeamMember - Error: Unauthorized, userId missing");
      return responseHandler(res, 401, "Unauthorized");
    }

    if (!teamId) {
      console.log("updateTeamMember - Error: Team ID is required");
      return responseHandler(res, 400, "Team ID is required");
    }

    // Validate roles
    const validRoles = [
      "Admin",
      "Buyer",
      "Seller",
      "Cashier",
      "Accountant",
      "Operations",
      "StockMan",
    ];
    if (roles && Array.isArray(roles)) {
      const invalidRoles = roles.filter((role) => !validRoles.includes(role));
      if (invalidRoles.length > 0) {
        console.log("updateTeamMember - Error: Invalid roles", invalidRoles);
        return responseHandler(
          res,
          400,
          `Invalid roles: ${invalidRoles.join(", ")}`
        );
      }
    }

    // Validate and normalize status
    const validStatuses = ["active", "inactive", "pending"];
    const normalizedStatus = status ? status.toLowerCase() : undefined;
    if (normalizedStatus && !validStatuses.includes(normalizedStatus)) {
      console.log("updateTeamMember - Error: Invalid status", status);
      return responseHandler(
        res,
        400,
        `Invalid status: ${status}. Must be one of ${validStatuses.join(", ")}`
      );
    }

    const team = await Team.findOne({
      _id: teamId,
      createdBy: currentUser._id,
    });
    if (!team) {
      console.log(
        "updateTeamMember - Error: No team found for teamId:",
        teamId
      );
      return responseHandler(
        res,
        404,
        "No team found with the provided teamId"
      );
    }

    // Optionally validate or update teamName
    if (teamName && teamName !== team.teamName) {
      const sanitizedTeamName = teamName.trim();
      if (sanitizedTeamName.length < 2) {
        console.log("updateTeamMember - Error: Invalid team name");
        return responseHandler(
          res,
          400,
          "Team name must be at least 2 characters long"
        );
      }
      const existingTeam = await Team.findOne({
        teamName: sanitizedTeamName,
        createdBy: currentUser._id,
        _id: { $ne: teamId },
      });
      if (existingTeam) {
        console.log(
          "updateTeamMember - Error: Team name already exists",
          sanitizedTeamName
        );
        return responseHandler(
          res,
          400,
          `Team name "${sanitizedTeamName}" already exists`
        );
      }
      team.teamName = sanitizedTeamName;
    }

    const member = team.members?.find(
      (m) => m._id?.toString() === teamMemberId
    );
    if (!member) {
      console.log(
        "updateTeamMember - Error: Team member not found for ID:",
        teamMemberId
      );
      return responseHandler(
        res,
        404,
        "Team member not found in the specified team"
      );
    }

    // Update member details
    if (roles && Array.isArray(roles)) {
      member.roles = roles;
    }
    if (normalizedStatus) {
      member.status = normalizedStatus;
    }
    // Update name in the Team member (optional, depending on schema)
    if (firstName || lastName) {
      member.name = `${firstName || ""} ${lastName || ""}`.trim(); // Store combined name in Team member
    }

    // Update linked User document if it exists
    if (member.user) {
      const userDoc = await User.findById(member.user);
      if (userDoc) {
        if (firstName) userDoc.firstName = firstName;
        if (lastName) userDoc.lastName = lastName;
        if (roles && Array.isArray(roles)) userDoc.roles = roles;
        if (normalizedStatus) userDoc.status = normalizedStatus; // Update status in User if applicable
        await userDoc.save();
      }
    }

    await team.save();

    console.log("updateTeamMember - Success:", {
      teamMemberId,
      teamId,
      roles,
      status: member.status,
      name: member.name,
      teamName: team.teamName,
    });
    responseHandler(
      res,
      200,
      "Team member details updated successfully",
      "success",
      {
        _id: member._id?.toString(),
        email: member.email,
        name: member.name, // Include name in response
        roles: member.roles,
        status: member.status,
        teamId: team.id.toString(),
        teamName: team.teamName,
      }
    );
  } catch (error) {
    console.error("updateTeamMember - Error:", error);
    const errorMessage =
      error instanceof Error && error.name === "ValidationError"
        ? `Validation error: ${error.message}`
        : "Internal server error";
    responseHandler(res, 500, errorMessage);
  }
};
export const deactivateUser = async (req: Request, res: Response) => {
  try {
    const { teamMemberId } = req.params;
    const { teamId } = req.body;

    console.log("deactivateUser - Request:", { teamMemberId, teamId });

    const currentUser = await User.findById(req.userId);
    if (!currentUser) {
      console.log("deactivateUser - Error: Unauthorized, userId missing");
      return responseHandler(res, 401, "Unauthorized");
    }

    if (!teamId) {
      console.log("deactivateUser - Error: Team ID is required");
      return responseHandler(res, 400, "Team ID is required");
    }

    const team = await Team.findOne({
      _id: teamId,
      createdBy: currentUser._id,
    });
    if (!team) {
      console.log("deactivateUser - Error: No team found for teamId:", teamId);
      return responseHandler(
        res,
        404,
        "No team found with the provided teamId"
      );
    }

    const member = team.members?.find(
      (m) => m._id?.toString() === teamMemberId
    );
    if (!member) {
      console.log(
        "deactivateUser - Error: Team member not found for ID:",
        teamMemberId
      );
      return responseHandler(
        res,
        404,
        "Team member not found in the specified team"
      );
    }

    member.status = "pending";
    await team.save();

    console.log("deactivateUser - Success:", {
      teamMemberId,
      teamId,
      status: member.status,
    });
    responseHandler(res, 200, "User deactivated successfully", "success", {
      _id: member._id?.toString(),
      email: member.email,
      roles: member.roles,
      status: member.status,
      teamId: team.id.toString(),
      teamName: team.teamName,
    });
  } catch (error) {
    console.error("deactivateUser - Error:", error);
    responseHandler(res, 500, "Internal server error");
  }
};
export const deleteMember = async (req: Request, res: Response) => {
  try {
    const { teamMemberId } = req.params;
    const { teamId } = req.body; // Accept teamId from request body
    const userId = req.userId;
    console.log("deleteMember - Request:", { userId, teamMemberId, teamId });

    if (!userId) {
      console.log("deleteMember - Error: Unauthorized, userId missing");
      return responseHandler(res, 401, "Unauthorized");
    }

    if (!teamId) {
      console.log("deleteMember - Error: teamId missing");
      return responseHandler(res, 400, "Team ID is required");
    }

    const team = await Team.findOne({ _id: teamId, createdBy: userId });
    if (!team) {
      console.log(
        "deleteMember - Error: No team found for userId:",
        userId,
        "and teamId:",
        teamId
      );
      return responseHandler(
        res,
        404,
        "No team found with the provided teamId or you are not authorized"
      );
    }
    console.log("deleteMember - Team found:", {
      teamId: team.id.toString(),
      teamName: team.teamName,
    });

    const memberIndex = team.members?.findIndex(
      (member) => member._id?.toString() === teamMemberId
    );
    console.log("deleteMember - Member search:", { teamMemberId, memberIndex });

    if (memberIndex === undefined || memberIndex === -1) {
      return responseHandler(
        res,
        404,
        `Team member not found in team (ID: ${teamMemberId})`
      );
    }

    team.members?.splice(memberIndex, 1);
    await team.save();

    console.log("deleteMember - Success: Member deleted", {
      teamMemberId,
      teamId,
    });
    responseHandler(
      res,
      200,
      "Team member deleted successfully",
      "success",
      {}
    );
  } catch (error: any) {
    console.error("deleteMember - Error:", error.message || error);
    const errorMessage =
      error.name === "ValidationError"
        ? `Validation error: ${error.message}`
        : "Internal server error";
    responseHandler(res, 500, errorMessage);
  }
};
export const searchTeamNames = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.userId;
    const { query } = req.query;

    if (!userId) {
      console.log("searchTeamNames - Error: Unauthorized, userId missing");
      responseHandler(res, 401, "Unauthorized");
      return;
    }

    const matchQuery: any = { createdBy: userId };
    if (query && typeof query === "string" && query.trim() !== "") {
      matchQuery.teamName = { $regex: query, $options: "i" };
    }

    console.log("searchTeamNames - Query:", { userId, query, matchQuery });

    const teams = await Team.find(matchQuery)
      .select("_id teamName")
      .lean()
      .exec();

    const formattedTeams = teams.map((team) => ({
      id: team._id.toString(),
      name: team.teamName, // teamName is now a string
    }));

    console.log("searchTeamNames - Found teams:", formattedTeams);

    responseHandler(
      res,
      200,
      "Team names fetched successfully",
      "success",
      formattedTeams
    );
  } catch (error) {
    console.error("searchTeamNames - Error:", error);
    responseHandler(res, 500, "Internal server error");
  }
};

export const listAllTeamMembers = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      console.log("listAllTeamMembers - Error: Unauthorized, userId missing");
      responseHandler(res, 401, "Unauthorized");
      return;
    }

    console.log("listAllTeamMembers - Querying teams for userId:", userId);

    const teams = await Team.find({ createdBy: userId })
      .select("teamName members")
      .lean()
      .exec();

    if (!teams || teams.length === 0) {
      console.log("listAllTeamMembers - No teams found for userId:", userId);
      responseHandler(res, 404, "No teams found where you are the Admin");
      return;
    }

    const allMembers = teams.flatMap((team) =>
      (team.members || []).map((member) => ({
        teamId: team._id.toString(),
        teamName: team.teamName, 
        email: member.email,
        roles: member.roles,
        status: member.status,
        memberId: member._id?.toString(),
      }))
    );

    console.log("listAllTeamMembers - Found members:", allMembers);

    responseHandler(
      res,
      200,
      "All team members fetched successfully",
      "success",
      allMembers
    );
  } catch (error) {
    console.error("listAllTeamMembers - Error:", error);
    responseHandler(res, 500, "Internal server error");
  }
};


