require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const path = require("path");

module.exports = {
  PORT:        parseInt(process.env.RT_PORT || "6767"),
  HOST:        process.env.HOST             || "0.0.0.0",
  DH_URL:      process.env.DH_URL          || "http://localhost:8000",
  CORS_ORIGIN: process.env.CORS_ORIGIN     || "*",
  DATA_PATH:   process.env.DATA_PATH       || path.join(__dirname, "../../../DATA"),
  SECRET: "",
};
