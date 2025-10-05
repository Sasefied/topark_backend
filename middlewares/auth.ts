import { Request, Response, NextFunction } from "express";
import { UnauthorizedError } from "../utils/errors";
import tokenUtil from "../utils/token";
import User from "../schemas/User";
import mongoose from "mongoose";
import asyncHandler from "express-async-handler";

// Extend Express Request type to include userEmail and orgId
declare module "express-serve-static-core" {
  interface Request {
    userId?: string;
    userEmail?: string;
    userOrgId?: string;
    userRoles?: string[];
    userTeamId?: mongoose.Types.ObjectId;
  }
}

const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers["authorization"];
  console.log("authMiddleware - Authorization Header Received:", authHeader);

  const authToken = authHeader?.split(" ")[1];

  if (!authToken) {
    console.log(
      "authMiddleware - No Bearer token found in Authorization header."
    );
    throw new UnauthorizedError("Authentication token is required");
  }

  try {
    const decodedToken = tokenUtil.verifyToken(authToken);

    if (
      !decodedToken ||
      typeof decodedToken !== "object" ||
      !decodedToken.sub
    ) {
      throw new UnauthorizedError("Invalid authentication token");
    }

    const user = await User.findById(decodedToken.sub);
    if (!user) {
      throw new UnauthorizedError("User not found");
    }

    // Block inactive users
    if (user.status === "inactive") {
      console.log("authMiddleware - Inactive user:", decodedToken.sub);
      res
        .status(403)
        .json({ message: "Account is inactive. Contact your Admin." });
      return;
    }

    // Attach user details to request
    req.userId = user._id.toString();
    req.userEmail = user.email;
    req.userOrgId = user.teamId?.toString();
    req.userRoles = user.roles || [];
    req.userTeamId = user.teamId;
    console.log("authMiddleware - Authenticated user:", {
      userId: req.userId,
      userEmail: req.userEmail,
      userOrgId: req.userOrgId,
      userRoles: req.userRoles,
      userTeamId: req.userTeamId,
    });

    next();
  } catch (error: any) {
    console.error("authMiddleware - Authentication error:", {
      message: error.message,
      token: authToken,
    });
    throw new UnauthorizedError(error.message);
  }
};

export const verifyPermission = (roles: string[] = []) =>
  asyncHandler(async (req, res, next) => {
    if (!req.userId || !req.userRoles) {
      throw new UnauthorizedError("Authentication required");
    }
    if (req.userRoles.some((role) => roles.includes(role))) {
      next();
    } else {
      throw new UnauthorizedError("Insufficient permissions");
    }
  });

export default authMiddleware;
