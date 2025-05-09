import express, { Express } from "express";
import "express-async-errors";
import cors from "cors";
import errorHandler from "./middlewares/error";
import routes from "./api/index"; // Ensure this is a .ts file
import { DB } from "./database/db";
import multer from "multer";
import { setupSwaggerDocs } from "./swagger";

const upload = multer();

const configureServer = async (app: Express): Promise<void> => {
  await DB.connect();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cors());
  app.use(upload.array("files"));

  app.use("/api", routes);
  app.use(errorHandler);

  setupSwaggerDocs(app);
};

export default configureServer;
