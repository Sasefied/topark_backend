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

    // Fetch requesting user for context
    const requestingUser = await User.findById(userId)
      .select("email roles teamId")
      .lean()
      .exec();
    if (!requestingUser) {
      console.log("listAllTeamMembers - Requesting user not found", { userId });
      responseHandler(res, 401, "Unauthorized");
      return;
    }

    // Admin (team creator) path: return all members across created teams
    const adminTeams = await Team.find({ createdBy: userId })
      .select("teamName members createdBy")
      .lean()
      .exec();

    if (adminTeams.length > 0) {
      const allMembers: any[] = [];
      adminTeams.forEach((team: any) => {
        (team.members || []).forEach((member: any) => {
          allMembers.push({
            teamId: team._id.toString(),
            teamName: team.teamName,
            email: member.email,
            roles: member.roles,
            status: member.status,
            memberId: member._id?.toString(),
          });
        });
      });
      console.log("listAllTeamMembers - Admin view member count:", allMembers.length);
      responseHandler(
        res,
        200,
        "All team members fetched successfully",
        "success",
        allMembers
      );
      return;
    }

    // Non-admin path: must have a teamId membership
    if (!requestingUser.teamId) {
      console.log("listAllTeamMembers - Non-admin user without teamId");
      responseHandler(res, 404, "No team membership found");
      return;
    }

    const team = await Team.findById(requestingUser.teamId)
      .select("teamName members createdBy")
      .lean()
      .exec();
    if (!team) {
      console.log("listAllTeamMembers - Team not found for teamId", { teamId: requestingUser.teamId?.toString() });
      responseHandler(res, 404, "Team not found");
      return;
    }

    const reqEmailLower = (requestingUser.email || "").toLowerCase();

    // Find self member entry
    let selfMember: any = (team.members || []).find((m: any) => (m.email || "").toLowerCase() === reqEmailLower || (m.user && m.user.toString() === userId));
    if (!selfMember) {
      selfMember = {
        _id: requestingUser._id,
        email: requestingUser.email,
        roles: requestingUser.roles || [],
        status: "pending",
      };
    }

    // Find admin in members
    let adminMember: any = (team.members || []).find(
      (m: any) => Array.isArray(m.roles) && m.roles.some((r: string) => r.toLowerCase() === "admin")
    );

    // If admin not in list, synthesize from creator
    if (!adminMember) {
      const creatorUser = await User.findById(team.createdBy)
        .select("email roles")
        .lean()
        .exec();
      if (creatorUser) {
        let creatorRoles: string[] = Array.isArray(creatorUser.roles) ? [...creatorUser.roles] : [];
        if (!creatorRoles.some((r) => r.toLowerCase() === "admin")) {
          creatorRoles.push("Admin");
        }
        adminMember = {
          _id: team.createdBy,
          email: creatorUser.email,
          roles: creatorRoles,
          status: "active",
        };
      }
    }

    const limited: any[] = [];
    if (adminMember) {
      limited.push({
        teamId: team._id.toString(),
        teamName: team.teamName,
        email: adminMember.email,
        roles: adminMember.roles,
        status: adminMember.status,
        memberId: adminMember._id?.toString(),
      });
    }
    const adminEmailLower = adminMember?.email?.toLowerCase();
    const selfIsAdmin = adminEmailLower && adminEmailLower === reqEmailLower;
    if (!selfIsAdmin) {
      limited.push({
        teamId: team._id.toString(),
        teamName: team.teamName,
        email: selfMember.email,
        roles: selfMember.roles,
        status: selfMember.status,
        memberId: selfMember._id?.toString(),
      });
    }

    // Sort: admin first, then self
    limited.sort((a: any, b: any) => {
      const aIsAdmin = Array.isArray(a.roles) && a.roles.map((r: string) => r.toLowerCase()).indexOf("admin") !== -1;
      const bIsAdmin = Array.isArray(b.roles) && b.roles.map((r: string) => r.toLowerCase()).indexOf("admin") !== -1;
      if (aIsAdmin && !bIsAdmin) return -1;
      if (!aIsAdmin && bIsAdmin) return 1;
      if (a.email === requestingUser.email) return 1; // keep admin first
      if (b.email === requestingUser.email) return -1;
      return a.email.localeCompare(b.email);
    });

    console.log("listAllTeamMembers - Non-admin filtered view:", limited.map(m => ({ email: m.email, roles: m.roles, status: m.status })));
    responseHandler(
      res,
      200,
      "Team members fetched successfully",
      "success",
      limited
    );
  } catch (error) {
    console.error("listAllTeamMembers - Error:", error);
    responseHandler(res, 500, "Internal server error");
  }
};


