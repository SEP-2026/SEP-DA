import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:8000",
});

const AUTH_KEY = "smart_parking_auth";

export const saveAuth = (payload) => {
  localStorage.setItem(AUTH_KEY, JSON.stringify(payload));
};

export const clearAuth = () => {
  localStorage.removeItem(AUTH_KEY);
};

export const getAuth = () => {
  const raw = localStorage.getItem(AUTH_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    clearAuth();
    return null;
  }
};

API.interceptors.request.use((config) => {
  const auth = getAuth();
  if (auth?.token) {
    config.headers.Authorization = `Bearer ${auth.token}`;
  }
  return config;
});

export default API;
