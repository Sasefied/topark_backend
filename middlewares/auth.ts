import { Request, Response, NextFunction } from "express";
import { UnauthorizedError } from "../utils/errors";
import tokenUtil from "../utils/token";

// Extend Express Request type to include userId
declare module "express-serve-static-core" {
  interface Request {
    userId?: string;
  }
}

const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers["authorization"];
  const authToken = authHeader?.split(" ")[1];

  if (!authToken) {
    throw new UnauthorizedError("Authentication token is required");
  }

  try {
    const decodedToken = tokenUtil.verifyToken(authToken);

    if (
      !decodedToken ||
      typeof decodedToken !== "object" ||
      !decodedToken.sub
    ) {
      throw new Error("Invalid authentication token");
    }

    req.userId = decodedToken.sub as string;
    next();
  } catch (error: any) {
    throw new UnauthorizedError(error.message);
  }
};

export default authMiddleware;
