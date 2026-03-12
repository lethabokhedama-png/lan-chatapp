/**
 * HTTP client for DataHandling API.
 * All persistence goes through here — realtime server never touches DATA/ directly.
 */
const axios = require("axios");
const { DH_URL } = require("../config");

const client = axios.create({
  baseURL: DH_URL,
  timeout: 8000,
});

async function dhPost(path, body, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await client.post(path, body, { headers });
  return res.data;
}

async function dhGet(path, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await client.get(path, { headers });
  return res.data;
}

async function dhPatch(path, body, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await client.patch(path, body, { headers });
  return res.data;
}

async function dhDelete(path, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await client.delete(path, { headers });
  return res.data;
}

module.exports = { dhPost, dhGet, dhPatch, dhDelete };