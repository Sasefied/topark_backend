// import express, { Express } from "express";
// import "express-async-errors";
// import cors from "cors";
// import errorHandler from "./middlewares/error";
// import routes from "./api/router"; // Ensure this is a .ts file
// import { DB } from "./database/db";
// // import multer from "multer";
// import { setupSwaggerDocs } from "./swagger";
// import orgRoutes from "./routes/orgRoutes";
// import { jwtAuth } from "./middlewares/jwtAuth";
// import adminUserRoutes from "./routes/TeamMemberRoutes";
// import hpp from "hpp";

// // const upload = multer();

// const configureServer = async (app: Express): Promise<void> => {
//   await DB.connect();

//   app.use(express.json());
//   app.use(express.urlencoded({ extended: true }));
//   app.use(hpp());
//   app.use(cors());
//   // app.use(upload.array("files"));

//   app.use("/api", routes);
//   app.use(errorHandler);
//   app.use("/api/admin", adminUserRoutes);

//   // All /api/org routes require a valid JWT
//   app.use("/api/org", jwtAuth, orgRoutes);

//   setupSwaggerDocs(app);
// };

// export default configureServer;




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

  setupSwaggerDocs(app);
};

export default configureServer;