import asyncio
from datetime import datetime, timezone
from typing import Any

from fastapi import WebSocket


class RealtimeHub:
    """Simple in-memory WebSocket hub for change notifications."""

    def __init__(self) -> None:
        self._clients: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._clients.add(websocket)

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            self._clients.discard(websocket)

    async def broadcast(self, payload: dict[str, Any]) -> None:
        async with self._lock:
            clients = list(self._clients)

        if not clients:
            return

        dead_clients: list[WebSocket] = []
        for websocket in clients:
            try:
                await websocket.send_json(payload)
            except Exception:
                dead_clients.append(websocket)

        if dead_clients:
            async with self._lock:
                for websocket in dead_clients:
                    self._clients.discard(websocket)

    async def notify_change(self, method: str, path: str, status_code: int) -> None:
        await self.broadcast(
            {
                "type": "data_changed",
                "method": method,
                "path": path,
                "status_code": status_code,
                "ts": datetime.now(timezone.utc).isoformat(),
            }
        )


realtime_hub = RealtimeHub()
