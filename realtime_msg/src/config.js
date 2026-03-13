require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

module.exports = {
  PORT:        parseInt(process.env.RT_PORT || "6767"),
  HOST:        process.env.HOST             || "0.0.0.0",
  DH_URL:      process.env.DH_URL          || "http://127.0.0.1:8000",
  CORS_ORIGIN: process.env.CORS_ORIGIN     || "*",
  DATA_PATH:   "/data/data/com.termux/files/home/chatapp/DATA",
  SECRET: "",
};
