// const dotEnv = require("dotenv")

// dotEnv.config()

// module.exports = {
//   PORT: process.env.PORT || 8000,

//   POSTGRES_USERNAME: process.env.POSTGRES_USERNAME,
//   POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD,
//   POSTGRES_HOST: process.env.POSTGRES_HOST,
//   POSTGRES_PORT: process.env.POSTGRES_PORT,
//   DATABASE_URL:
//     process.env.DATABASE_URL ||
//     `postgresql://${process.env.POSTGRES_USERNAME}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}`,
//   DATABASE_NAME: process.env.DATABASE_NAME || process.env.USER_SERVICE_DB,
//   MY_APP_FRONTEND_URL:process.env.MY_APP_FRONTEND_URL,
// }

const dotenv = require("dotenv");

dotenv.config();

module.exports = {
  PORT: process.env.PORT || 8000,

  MONGO_URI: process.env.MONGO_URI,
  MONGO_DB_NAME: process.env.MONGO_DB_NAME || "toprak",

  JWT_SECRET: process.env.JWT_SECRET || "supersecretkey",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",

  MY_APP_FRONTEND_URL:
    process.env.MY_APP_FRONTEND_URL || "http://localhost:3000",
};
