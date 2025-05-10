import express from "express";
import configureServer from "./server";
import config from "./config";

const app = express();
const PORT = config.PORT || 8000;

configureServer(app)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to configure the server:", err);
    process.exit(1);
  });
