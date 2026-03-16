import uuid
from datetime import datetime, timezone
from database import db
import logging

logger = logging.getLogger(__name__)


def now_str():
    return datetime.now(timezone.utc).isoformat()


async def create_notification(user_id: str, notif_type: str, title: str, body: str, data: dict = None):
    """Create an in-app notification and send via WebSocket if connected."""
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": notif_type,
        "title": title,
        "body": body,
        "data": data or {},
        "is_read": False,
        "created_at": now_str()
    }
    await db.notifications.insert_one(doc)
    safe = {k: v for k, v in doc.items() if k != "_id"}

    try:
        from routes.ws_routes import manager
        await manager.send_to_user(user_id, {"type": "notification", "notification": safe})
    except Exception:
        pass

    return safe
