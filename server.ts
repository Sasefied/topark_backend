import express, { Express } from "express";
import "express-async-errors";
import cors from "cors";
import errorHandler from "./middlewares/error";
import routes from "./api/router"; // Ensure this is a .ts file
import { DB } from "./database/db";
import { setupSwaggerDocs } from "./swagger";
import orgRoutes from "./routes/orgRoutes";
import { jwtAuth } from "./middlewares/jwtAuth";
import adminUserRoutes from "./routes/TeamMemberRoutes";
import hpp from "hpp";
import RabbitMQ from "./rabbitmq/RabbitMQ";
import Event from "./rabbitmq/Event";
import EventHandler from "./rabbitmq/EventHandler";
import RPC from "./rabbitmq/RPC";
import RPCHandler from "./rabbitmq/RPCHandler";

const configureServer = async (app: Express): Promise<void> => {
  await DB.connect();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(hpp());
  app.use(cors());

  app.use("/api", routes);
  app.use(errorHandler);
  app.use("/api/admin", adminUserRoutes);

  // All /api/org routes require a valid JWT
  app.use("/api/org", jwtAuth, orgRoutes);

   // RabbitMQ connection
  RabbitMQ.connect();

  // RabbitMQ RPC listener
  RPC.respond(RPCHandler);

  // RabbitMQ event listener
  Event.subscriber(process.env.SERVICE_QUEUE!, EventHandler);

  setupSwaggerDocs(app);
};

export default configureServer;
