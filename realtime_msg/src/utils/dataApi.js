const axios  = require("axios");
const https  = require("https");
const cfg    = require("../config");

const api = axios.create({
  baseURL: cfg.DH_URL,
  timeout: 8000,
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
});

async function dhGet(path, token) {
  const r = await api.get(path, { headers: { Authorization: `Bearer ${token}` } });
  return r.data;
}

async function dhPost(path, body, token) {
  const r = await api.post(path, body, { headers: { Authorization: `Bearer ${token}` } });
  return r.data;
}

async function dhPatch(path, body, token) {
  const r = await api.patch(path, body, { headers: { Authorization: `Bearer ${token}` } });
  return r.data;
}

async function dhDelete(path, token) {
  const r = await api.delete(path, { headers: { Authorization: `Bearer ${token}` } });
  return r.data;
}

module.exports = { dhGet, dhPost, dhPatch, dhDelete };
