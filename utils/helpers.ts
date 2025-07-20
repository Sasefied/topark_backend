import { Request } from "express";

const getStaticFilePath = (req: Request, fileName: string) => {
  return `${req.protocol}://${req.get("host")}/${fileName}`;
};

const getLocalPath = (fileName: string) => {
  return `uploads/${fileName}`;
};

export { getStaticFilePath, getLocalPath };
