import { Request, Response, NextFunction } from "express";
import { BaseError } from "../utils/errors";
import { removeUnusedMulterImageFilesOnError } from "../utils/helpers";

const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error(err);

  removeUnusedMulterImageFilesOnError(req);

  if (err instanceof BaseError) {
    res.status(err.statusCode).json({ message: err.message });
    return;
  }

  res.status(500).json({ message: "Internal Server Error" });
};

export default errorHandler;
