from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, List
import json
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        self.connections: Dict[str, WebSocket] = {}
        self.user_locations: Dict[str, dict] = {}

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        self.connections[user_id] = websocket
        logger.info(f"WS connected: {user_id} (total: {len(self.connections)})")

    def disconnect(self, user_id: str):
        self.connections.pop(user_id, None)
        self.user_locations.pop(user_id, None)
        logger.info(f"WS disconnected: {user_id}")

    def update_user_location(self, user_id: str, lat: float, lng: float):
        self.user_locations[user_id] = {"lat": lat, "lng": lng}

    async def send_to_user(self, user_id: str, message: dict):
        ws = self.connections.get(user_id)
        if ws:
            try:
                await ws.send_text(json.dumps(message))
            except Exception as e:
                logger.warning(f"Failed to send to {user_id}: {e}")
                self.disconnect(user_id)

    async def broadcast_new_job(self, job: dict):
        """Broadcast new job to all connected crew members."""
        message = {"type": "new_job", "job": {k: v for k, v in job.items() if k != "_id"}}
        from database import db
        # Get all connected crew members and send
        for user_id, ws in list(self.connections.items()):
            try:
                user = await db.users.find_one({"id": user_id, "role": "crew"}, {"_id": 0})
                if user:
                    await ws.send_text(json.dumps(message))
            except Exception as e:
                logger.warning(f"Failed to broadcast to {user_id}: {e}")

    async def broadcast_all(self, message: dict):
        for user_id, ws in list(self.connections.items()):
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                self.disconnect(user_id)

    def get_online_users(self) -> List[str]:
        return list(self.connections.keys())

    def get_crew_locations(self) -> List[dict]:
        return [
            {"user_id": uid, **loc}
            for uid, loc in self.user_locations.items()
        ]


manager = ConnectionManager()


@router.websocket("/ws/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str):
    from auth import decode_token
    from database import db

    payload = decode_token(token)
    if not payload:
        await websocket.close(code=4001)
        return

    user_id = payload.get("sub")
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        await websocket.close(code=4001)
        return

    await manager.connect(user_id, websocket)

    try:
        # Send initial connection confirmation
        await websocket.send_text(json.dumps({
            "type": "connected",
            "user_id": user_id,
            "role": user["role"]
        }))

        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                msg_type = msg.get("type")

                if msg_type == "location_update":
                    lat = msg.get("lat")
                    lng = msg.get("lng")
                    if lat and lng:
                        manager.update_user_location(user_id, lat, lng)
                        await db.users.update_one(
                            {"id": user_id},
                            {"$set": {"location": {"lat": lat, "lng": lng, "city": msg.get("city", "")}}}
                        )
                elif msg_type == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))

            except json.JSONDecodeError:
                pass

    except WebSocketDisconnect:
        manager.disconnect(user_id)
    except Exception as e:
        logger.error(f"WS error for {user_id}: {e}")
        manager.disconnect(user_id)


@router.get("/ws/online-users")
async def get_online_users():
    return {
        "online_count": len(manager.connections),
        "user_ids": manager.get_online_users(),
        "crew_locations": manager.get_crew_locations()
    }
