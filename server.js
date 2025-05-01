const express = require("express");
require("express-async-errors");
const cors = require("cors");
const error = require("./middlewares/error");
const routes = require("./api/routes");
const { DB } = require("./database");
var bodyParser = require("body-parser");

const multer = require("multer");

const upload = multer();

module.exports = async (app) => {
  await DB.connect();
  
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(cors());
  app.use(routes);
  app.use(error);
  app.use(upload.array());
};
