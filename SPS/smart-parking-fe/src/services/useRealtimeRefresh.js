import { useEffect, useRef } from "react";

import API, { getAuth } from "./api";

const DEFAULT_RECONNECT_MS = 1000;
const MAX_RECONNECT_MS = 10000;
const DEFAULT_MIN_REFRESH_INTERVAL_MS = 1500;

function resolveWsUrl() {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL || API.defaults.baseURL || window.location.origin;
  const url = new URL(configuredBaseUrl, window.location.origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/ws/updates";
  const token = getAuth()?.token;
  if (token) {
    url.searchParams.set("token", token);
  }
  return url.toString();
}

export default function useRealtimeRefresh(callback, options = {}) {
  const { enabled = true, minRefreshIntervalMs = DEFAULT_MIN_REFRESH_INTERVAL_MS } = options;
  const callbackRef = useRef(callback);
  const lastRefreshRef = useRef(0);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let socket = null;
    let reconnectTimer = null;
    let reconnectDelay = DEFAULT_RECONNECT_MS;
    let disposed = false;

    const triggerRefresh = () => {
      const now = Date.now();
      if (now - lastRefreshRef.current < minRefreshIntervalMs) {
        return;
      }
      lastRefreshRef.current = now;
      Promise.resolve(callbackRef.current?.()).catch(() => null);
    };

    const connect = () => {
      if (disposed) {
        return;
      }

      socket = new WebSocket(resolveWsUrl());

      socket.onopen = () => {
        reconnectDelay = DEFAULT_RECONNECT_MS;
      };

      socket.onmessage = () => {
        triggerRefresh();
      };

      socket.onclose = () => {
        if (disposed) {
          return;
        }
        reconnectTimer = window.setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_MS);
      };

      socket.onerror = () => {
        try {
          socket?.close();
        } catch {
          // Ignore close errors.
        }
      };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
      }
      try {
        socket?.close();
      } catch {
        // Ignore close errors.
      }
    };
  }, [enabled, minRefreshIntervalMs]);
}
