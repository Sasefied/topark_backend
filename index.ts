import express from "express";
import configureServer from "./server";
import config from "./config";


const app = express();

configureServer(app)
  .then(() => {
    app.listen(config.PORT, () => {
      console.log(`🟢 Server is running on port ${config.PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to configure the server:", err);
    process.exit(1);
  });
