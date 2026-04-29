import { useEffect, useRef } from "react";

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

    return () => {
      onMessageRef.current = onMessage;
    };
  }, [enabled]);
}