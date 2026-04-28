import { useEffect, useRef } from "react";

import API, { getAuth } from "./api";

const DEFAULT_RECONNECT_MS = 1000;
const MAX_RECONNECT_MS = 10000;

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

export default function useRealtimeNotifications(onMessage, options = {}) {
  const { enabled = true } = options;
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let socket = null;
    let reconnectTimer = null;
    let reconnectDelay = DEFAULT_RECONNECT_MS;
    let disposed = false;

    const connect = () => {
      if (disposed) {
        return;
      }

      socket = new WebSocket(resolveWsUrl());

      socket.onopen = () => {
        reconnectDelay = DEFAULT_RECONNECT_MS;
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          onMessageRef.current?.(payload);
        } catch {
          // Ignore non-JSON payloads.
        }
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

    const bootstrap = async () => {
      try {
        await API.get("/ws-health");
        connect();
      } catch {
        // If the backend doesn't expose websocket support yet, stay silent.
      }
    };

    bootstrap();

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
  }, [enabled]);
}