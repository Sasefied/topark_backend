// utils/responseHandler.ts
import { Response } from "express";

export const responseHandler = (
  res: Response,
  statusCode: number,
  message: string,
  status: "success" | "fail" | "error" = "success",
  data?: any
): void => {
  res.status(statusCode).json({ status, message, ...(data && { data }) });
};
