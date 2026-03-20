import { getToken } from "./api";

const BASE = () => import.meta.env.VITE_API_URL || "";
let _flags = {};
let _loaded = false;

export async function loadFlags() {
  try {
    const res = await fetch(BASE() + "/api/dev/flags", {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const data = await res.json();
    _flags = data.global || data || {};
    _loaded = true;
  } catch (_) {}
}

export function getFlag(key, defaultVal = true) {
  if (!_loaded) return defaultVal;
  const v = _flags[key];
  return v === undefined ? defaultVal : v;
}

export function getAllFlags() { return _flags; }
