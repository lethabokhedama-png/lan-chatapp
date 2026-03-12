// realtime_msg config — reads .env or environment variables
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

module.exports = {
  PORT:        parseInt(process.env.RT_PORT   || "6767"),
  HOST:        process.env.HOST               || "0.0.0.0",
  DH_URL:      process.env.DH_URL            || "http://localhost:8000",
  SECRET:      process.env.SECRET            || "lanchat-secret-change-me",
  CORS_ORIGIN: process.env.CORS_ORIGIN       || "*",
};