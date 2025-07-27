// middleware/jwtAuth.ts
import { RequestHandler } from "express";
import jwt from "jsonwebtoken";

interface JwtPayload {
  sub: string;
  orgId: string;
  iat: number;
  exp: number;
  email: string;
}

// by declaring this as a RequestHandler, Express knows the correct types
export const jwtAuth: RequestHandler = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res
      .status(401)
      .json({ message: "Missing or invalid Authorization header" });
    return; // <— return void
  }

  const token = authHeader.split(" ")[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    req.user = {
      id: payload.sub,
      orgId: payload.orgId,
      email: payload.email,
    };
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid or expired token" });
    return; // <— return void
  }
};
