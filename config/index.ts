import dotenv from "dotenv";
dotenv.config();

const config = {
  // parse the string from process.env.PORT, or fall back to 8000
  PORT: parseInt(process.env.PORT || "8000", 10),
  MONGO_URI: process.env.MONGO_URI,
  MONGO_DB_NAME: process.env.MONGO_DB_NAME || "toprak",

  // JWT settings
  JWT_SECRET: process.env.JWT_SECRET || "supersecretkey",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",

  // Invite token settings
  JWT_INVITE_SECRET: process.env.JWT_INVITE_SECRET || "some_invite_secret",
  JWT_INVITE_EXPIRES_IN: process.env.JWT_INVITE_EXPIRES_IN || "1d",

  // Frontend link base
  MY_APP_FRONTEND_URL:
    process.env.MY_APP_FRONTEND_URL || "http://localhost:5173",

  // SMTP settings for email sending
  SMTP_HOST: process.env.SMTP_HOST || "",
  SMTP_PORT: parseInt(process.env.SMTP_PORT || "587"),
  SMTP_USER: process.env.SMTP_USER || "",
  SMTP_PASSWORD: process.env.SMTP_PASSWORD || "",
};

export default config;
