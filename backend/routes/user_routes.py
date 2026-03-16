import os
import uuid
import shutil
from pathlib import Path
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Query
from database import db
from auth import get_current_user, user_to_response
from models import ProfileUpdate, LocationUpdate, OnlineStatusUpdate, CrewRequest
from typing import Optional
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

UPLOAD_DIR = Path("/app/backend/uploads")
PROFILE_DIR = UPLOAD_DIR / "profile_photos"
LOGO_DIR = UPLOAD_DIR / "logos"
PROFILE_DIR.mkdir(parents=True, exist_ok=True)
LOGO_DIR.mkdir(parents=True, exist_ok=True)


def calc_profile_completion(user: dict) -> dict:
    """Calculate profile completion percentage and missing fields."""
    checks = {
        "photo": bool(user.get("profile_photo") or user.get("logo")),
        "phone": bool(user.get("phone")),
        "address": bool(user.get("location") or user.get("address")),
        "skills": bool(user.get("skills") or user.get("trade")),
        "bio": bool(user.get("bio")),
    }
    completed = sum(1 for v in checks.values() if v)
    pct = int((completed / len(checks)) * 100)
    return {"percentage": pct, "checks": checks, "is_complete": pct == 100}


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return user_to_response(current_user)


@router.get("/profile-completion")
async def get_profile_completion(current_user: dict = Depends(get_current_user)):
    return calc_profile_completion(current_user)


@router.put("/online-status")
async def set_online_status(data: OnlineStatusUpdate, current_user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"is_online": data.is_online, "availability": data.is_online}}
    )
    return {"is_online": data.is_online}


@router.put("/profile")
async def update_profile(data: ProfileUpdate, current_user: dict = Depends(get_current_user)):
    update = {k: v for k, v in data.model_dump().items() if v is not None}

    # Geocode address if address field changed
    if data.address and data.address != current_user.get("address"):
        try:
            from utils.geocoding import geocode_address
            geo = await geocode_address(data.address)
            if geo and geo.get("lat"):
                update["location"] = {
                    "lat": geo["lat"], "lng": geo["lng"],
                    "city": geo.get("city", ""), "address": data.address
                }
                # Store GeoJSON format for 2dsphere index
                update["location_geo"] = {
                    "type": "Point",
                    "coordinates": [geo["lng"], geo["lat"]]  # GeoJSON: [lng, lat]
                }
        except Exception as e:
            logger.warning(f"Geocoding failed for address '{data.address}': {e}")

    if update:
        await db.users.update_one({"id": current_user["id"]}, {"$set": update})
    updated = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    return user_to_response(updated)


@router.get("/public/{user_id}")
async def get_public_profile(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get a user's public profile (for popup or profile page)."""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # Fetch recent ratings
    recent_ratings = await db.ratings.find(
        {"rated_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).limit(5).to_list(5)
    profile = user_to_response(user)
    profile["recent_ratings"] = recent_ratings
    return profile


@router.post("/location")
async def update_location(data: LocationUpdate, current_user: dict = Depends(get_current_user)):
    location = {"lat": data.lat, "lng": data.lng, "city": data.city or ""}
    # Also save GeoJSON format for 2dsphere index
    location_geo = {"type": "Point", "coordinates": [data.lng, data.lat]}
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"location": location, "location_geo": location_geo}}
    )
    # Update WS location
    try:
        from routes.ws_routes import manager
        manager.update_user_location(current_user["id"], data.lat, data.lng)
    except Exception:
        pass
    return {"message": "Location updated"}


@router.post("/upload-photo")
async def upload_photo(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"{current_user['id']}.{ext}"

    if current_user["role"] == "contractor":
        path = LOGO_DIR / filename
        field = "logo"
    else:
        path = PROFILE_DIR / filename
        field = "profile_photo"

    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    photo_url = f"/uploads/{field.replace('_', '_photos/' if field == 'profile_photo' else 's/')}{filename}"
    if current_user["role"] == "contractor":
        photo_url = f"/uploads/logos/{filename}"
    else:
        photo_url = f"/uploads/profile_photos/{filename}"

    await db.users.update_one({"id": current_user["id"]}, {"$set": {field: photo_url}})
    return {"url": photo_url}


@router.get("/crew")
async def search_crew(
    trade: Optional[str] = None,
    name: Optional[str] = None,
    address: Optional[str] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius: Optional[float] = 50,
    available_only: bool = True,
    current_user: dict = Depends(get_current_user)
):
    query = {"role": "crew", "is_active": True}
    if trade:
        query["$or"] = [
            {"trade": {"$regex": trade, "$options": "i"}},
            {"skills": {"$elemMatch": {"$regex": trade, "$options": "i"}}}
        ]
    if name:
        query["name"] = {"$regex": name, "$options": "i"}
    if available_only:
        query["$and"] = query.get("$and", []) + [{"$or": [{"availability": True}, {"is_online": True}]}]

    # Profile gate: only show crew with at least a phone or trade set (basic completion)
    query["$and"] = query.get("$and", []) + [
        {"$or": [
            {"phone": {"$exists": True, "$nin": [None, ""]}},
            {"trade": {"$exists": True, "$nin": [None, ""]}}
        ]}
    ]

    # Geocode address if provided and no lat/lng
    if address and not (lat and lng):
        try:
            from utils.geocoding import geocode_address
            geo = await geocode_address(address)
            lat, lng = geo.get("lat"), geo.get("lng")
        except Exception:
            pass

    # Use MongoDB 2dsphere geo query if lat/lng available
    if lat and lng:
        radius_meters = radius * 1609.34  # miles → meters
        query["location_geo"] = {
            "$geoWithin": {
                "$centerSphere": [[lng, lat], radius / 3958.8]  # radius in radians (earth radius ~3958.8 mi)
            }
        }

    crew = await db.users.find(query, {"_id": 0, "password_hash": 0}).to_list(100)

    # Fallback: if no location_geo data but lat/lng given, use haversine
    if lat and lng and not any(c.get("location_geo") for c in crew):
        from utils.geocoding import haversine_distance
        crew = [c for c in crew if c.get("location") and
                haversine_distance(lat, lng, c["location"]["lat"], c["location"]["lng"]) <= radius]

    # Contact masking: hide phone/email unless viewing own profile or job is active
    is_contractor = current_user["role"] == "contractor"
    accepted_crew_ids = set()
    if is_contractor:
        # Find contractor's accepted/in-progress jobs crew IDs
        active_jobs = await db.jobs.find(
            {"contractor_id": current_user["id"], "status": {"$in": ["fulfilled", "in_progress"]}},
            {"_id": 0, "crew_accepted": 1}
        ).to_list(50)
        for j in active_jobs:
            accepted_crew_ids.update(j.get("crew_accepted", []))

    for c in crew:
        if c["id"] not in accepted_crew_ids and c["id"] != current_user["id"]:
            # Mask phone: show only last 4 digits
            phone = c.get("phone")
            if phone:
                digits = ''.join(filter(str.isdigit, phone))
                c["phone"] = f"***-***-{digits[-4:]}" if len(digits) >= 4 else "***"
            # Always hide email
            c.pop("email", None)

        # Location masking for privacy (~1km precision)
        if c.get("location") and c.get("hide_location", True):
            c["location"] = {
                "lat": round(c["location"]["lat"], 2),
                "lng": round(c["location"]["lng"], 2),
                "city": c["location"].get("city", "")
            }
        # Remove GeoJSON internal field
        c.pop("location_geo", None)
        c.pop("password_hash", None)

    return crew


@router.get("/crew/{user_id}")
async def get_crew_member(user_id: str, current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": user_id, "role": "crew"}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Crew member not found")
    ratings = await db.ratings.find({"rated_id": user_id}, {"_id": 0}).to_list(50)
    return {**user_to_response(user), "recent_ratings": ratings[-5:]}


@router.post("/favorites/{user_id}")
async def add_favorite(user_id: str, current_user: dict = Depends(get_current_user)):
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if user_id not in current_user.get("favorite_crew", []):
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$push": {"favorite_crew": user_id}}
        )
    return {"message": "Added to favorites"}


@router.delete("/favorites/{user_id}")
async def remove_favorite(user_id: str, current_user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$pull": {"favorite_crew": user_id}}
    )
    return {"message": "Removed from favorites"}


@router.get("/favorites")
async def get_favorites(current_user: dict = Depends(get_current_user)):
    fav_ids = current_user.get("favorite_crew", [])
    users = await db.users.find({"id": {"$in": fav_ids}}, {"_id": 0, "password_hash": 0}).to_list(100)
    return users


@router.get("/referral/info")
async def referral_info(current_user: dict = Depends(get_current_user)):
    referrals = await db.referrals.find({"referrer_id": current_user["id"]}, {"_id": 0}).to_list(100)
    return {
        "referral_code": current_user["referral_code"],
        "points": current_user["points"],
        "total_referrals": len(referrals),
        "referrals": referrals
    }


@router.post("/redeem-points")
async def redeem_points(points: int, current_user: dict = Depends(get_current_user)):
    if current_user["points"] < points:
        raise HTTPException(status_code=400, detail="Insufficient points")
    if points < 500:
        raise HTTPException(status_code=400, detail="Minimum 500 points to redeem")

    days = points // 500  # 500 points = 1 day subscription
    from datetime import datetime, timezone, timedelta
    sub_end = current_user.get("subscription_end")
    if sub_end:
        try:
            base = datetime.fromisoformat(sub_end)
        except Exception:
            base = datetime.now(timezone.utc)
    else:
        base = datetime.now(timezone.utc)

    new_end = (base + timedelta(days=days)).isoformat()
    await db.users.update_one(
        {"id": current_user["id"]},
        {
            "$inc": {"points": -points},
            "$set": {"subscription_end": new_end, "subscription_status": "active"}
        }
    )
    return {"message": f"Redeemed {points} points for {days} days", "new_subscription_end": new_end}


@router.get("/trial-status")
async def trial_status(current_user: dict = Depends(get_current_user)):
    from datetime import datetime, timezone
    trial_end = current_user.get("trial_end_date")
    if not trial_end:
        return {"is_trial": False, "days_remaining": 0}
    try:
        end = datetime.fromisoformat(trial_end)
        remaining = (end - datetime.now(timezone.utc)).days
        return {
            "is_trial": current_user.get("subscription_status") == "trial",
            "days_remaining": max(0, remaining),
            "trial_end": trial_end
        }
    except Exception:
        return {"is_trial": False, "days_remaining": 0}


# ─── Crew Request System ──────────────────────────────────────────────────────

@router.post("/request/{crew_id}")
async def send_crew_request(crew_id: str, data: CrewRequest, current_user: dict = Depends(get_current_user)):
    """Contractor sends a direct request to a crew member."""
    if current_user["role"] != "contractor":
        raise HTTPException(status_code=403, detail="Only contractors can send crew requests")

    crew_member = await db.users.find_one({"id": crew_id, "role": "crew"}, {"_id": 0})
    if not crew_member:
        raise HTTPException(status_code=404, detail="Crew member not found")

    from datetime import datetime, timezone
    request_doc = {
        "id": str(uuid.uuid4()),
        "contractor_id": current_user["id"],
        "contractor_name": current_user["name"],
        "contractor_company": current_user.get("company_name", ""),
        "crew_id": crew_id,
        "crew_name": crew_member["name"],
        "message": data.message or "",
        "job_context": data.job_context,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.crew_requests.insert_one(request_doc)

    # Notify crew via WebSocket
    try:
        from routes.ws_routes import manager
        await manager.send_to_user(crew_id, {
            "type": "crew_request",
            "request_id": request_doc["id"],
            "contractor_name": current_user["name"],
            "contractor_company": current_user.get("company_name", ""),
            "message": data.message or "",
            "job_context": data.job_context,
        })
    except Exception:
        pass

    return {k: v for k, v in request_doc.items() if k != "_id"}


@router.get("/requests")
async def get_crew_requests(current_user: dict = Depends(get_current_user)):
    """Get pending crew requests for crew member, or sent requests for contractor."""
    if current_user["role"] == "crew":
        requests = await db.crew_requests.find(
            {"crew_id": current_user["id"]},
            {"_id": 0}
        ).sort("created_at", -1).to_list(50)
    else:
        requests = await db.crew_requests.find(
            {"contractor_id": current_user["id"]},
            {"_id": 0}
        ).sort("created_at", -1).to_list(50)
    return requests


@router.put("/requests/{request_id}/accept")
async def accept_crew_request(request_id: str, current_user: dict = Depends(get_current_user)):
    """Crew member accepts a contractor request."""
    if current_user["role"] != "crew":
        raise HTTPException(status_code=403, detail="Only crew can accept requests")

    req = await db.crew_requests.find_one({"id": request_id, "crew_id": current_user["id"]}, {"_id": 0})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Request already {req['status']}")

    await db.crew_requests.update_one({"id": request_id}, {"$set": {"status": "accepted"}})

    # Notify contractor via WebSocket
    try:
        from routes.ws_routes import manager
        await manager.send_to_user(req["contractor_id"], {
            "type": "crew_request_accepted",
            "request_id": request_id,
            "crew_name": current_user["name"],
            "crew_id": current_user["id"],
        })
    except Exception:
        pass

    return {"message": "Request accepted"}


@router.put("/requests/{request_id}/decline")
async def decline_crew_request(request_id: str, current_user: dict = Depends(get_current_user)):
    """Crew member declines a contractor request."""
    if current_user["role"] != "crew":
        raise HTTPException(status_code=403, detail="Only crew can decline requests")

    req = await db.crew_requests.find_one({"id": request_id, "crew_id": current_user["id"]}, {"_id": 0})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    await db.crew_requests.update_one({"id": request_id}, {"$set": {"status": "declined"}})

    # Notify contractor via WebSocket
    try:
        from routes.ws_routes import manager
        await manager.send_to_user(req["contractor_id"], {
            "type": "crew_request_declined",
            "request_id": request_id,
            "crew_name": current_user["name"],
        })
    except Exception:
        pass

    return {"message": "Request declined"}
