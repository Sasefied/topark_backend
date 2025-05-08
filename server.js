// const express = require("express");
// require("express-async-errors");
// const cors = require("cors");
// const error = require("./middlewares/error");
// const routes = require("./api");
// const { DB } = require("./database");
// var bodyParser = require("body-parser");

// const multer = require("multer");

// const upload = multer();

// module.exports = async (app) => {
//   await DB.connect();

//   app.use(express.json());
//   app.use(express.urlencoded({ extended: true }));
//   app.use(bodyParser.urlencoded({ extended: false }));
//   app.use(cors());
//   app.use(routes);
//   app.use(error);
//   app.use(upload.array());
// };

const express = require("express");
require("express-async-errors");
const cors = require("cors");
const errorHandler = require("./middlewares/error");
const routes = require("./api");
const { DB } = require("./database");
const multer = require("multer");

const upload = multer();

module.exports = async (app) => {
  // Connect to MongoDB
  await DB.connect();

  // Built-in body parsers (no need for 'body-parser')
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Handle CORS
  app.use(cors());

  // File uploads
  app.use(upload.array());

  // Main API routes
  app.use("/api", routes);

  // Global error handler
  app.use(errorHandler);
};
