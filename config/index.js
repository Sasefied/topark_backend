const dotEnv = require("dotenv")

dotEnv.config()

module.exports = {
  PORT: process.env.PORT || 8000,

  POSTGRES_USERNAME: process.env.POSTGRES_USERNAME,
  POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD,
  POSTGRES_HOST: process.env.POSTGRES_HOST,
  POSTGRES_PORT: process.env.POSTGRES_PORT,
  DATABASE_URL:
    process.env.DATABASE_URL ||
    `postgresql://${process.env.POSTGRES_USERNAME}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}`,
  DATABASE_NAME: process.env.DATABASE_NAME || process.env.USER_SERVICE_DB,
  MY_APP_FRONTEND_URL:process.env.MY_APP_FRONTEND_URL,
}
