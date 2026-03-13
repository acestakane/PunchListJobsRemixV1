import os
import uuid
import shutil
from pathlib import Path
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Query
from database import db
from auth import get_current_user, user_to_response
from models import ProfileUpdate, LocationUpdate
from typing import Optional
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

UPLOAD_DIR = Path("/app/backend/uploads")
PROFILE_DIR = UPLOAD_DIR / "profile_photos"
LOGO_DIR = UPLOAD_DIR / "logos"
PROFILE_DIR.mkdir(parents=True, exist_ok=True)
LOGO_DIR.mkdir(parents=True, exist_ok=True)


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return user_to_response(current_user)


@router.put("/profile")
async def update_profile(data: ProfileUpdate, current_user: dict = Depends(get_current_user)):
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if update:
        await db.users.update_one({"id": current_user["id"]}, {"$set": update})
    updated = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    return user_to_response(updated)


@router.post("/location")
async def update_location(data: LocationUpdate, current_user: dict = Depends(get_current_user)):
    location = {"lat": data.lat, "lng": data.lng, "city": data.city or ""}
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"location": location}}
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
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius: Optional[float] = 50,
    available_only: bool = True,
    current_user: dict = Depends(get_current_user)
):
    query = {"role": "crew", "is_active": True}
    if trade:
        query["trade"] = {"$regex": trade, "$options": "i"}
    if name:
        query["name"] = {"$regex": name, "$options": "i"}
    if available_only:
        query["availability"] = True

    crew = await db.users.find(query, {"_id": 0, "password_hash": 0}).to_list(100)

    if lat and lng:
        from utils.geocoding import haversine_distance
        crew = [c for c in crew if c.get("location") and
                haversine_distance(lat, lng, c["location"]["lat"], c["location"]["lng"]) <= radius]

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
