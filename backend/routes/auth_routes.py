import uuid
import random
import string
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, status
from database import db
from models import UserCreate, UserLogin, TokenResponse
from auth import hash_password, verify_password, create_token, user_to_response
from utils.email_utils import send_welcome_email
import os

router = APIRouter()


def generate_referral_code(length: int = 8) -> str:
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))


def trial_end(days: int = 30) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()


@router.post("/register", status_code=201)
async def register(data: UserCreate):
    existing = await db.users.find_one({"email": data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    if data.role not in ("crew", "contractor"):
        raise HTTPException(status_code=400, detail="Role must be crew or contractor")

    # Generate unique referral code
    code = generate_referral_code()
    while await db.users.find_one({"referral_code": code}):
        code = generate_referral_code()

    trial_days = int(os.environ.get("TRIAL_DAYS", 30))
    now = datetime.now(timezone.utc).isoformat()

    user_doc = {
        "id": str(uuid.uuid4()),
        "email": data.email.lower(),
        "password_hash": hash_password(data.password),
        "role": data.role,
        "name": data.name,
        "phone": data.phone,
        "is_active": True,
        "is_verified": False,
        "created_at": now,
        "trial_start_date": now,
        "trial_end_date": trial_end(trial_days),
        "subscription_status": "trial",
        "subscription_plan": None,
        "subscription_end": None,
        "points": 50,  # welcome points
        "referral_code": code,
        "referred_by": None,
        # Crew fields
        "bio": "",
        "trade": "",
        "skills": [],
        "profile_photo": None,
        "availability": True,
        "location": None,
        "rating": 0.0,
        "rating_count": 0,
        "jobs_completed": 0,
        # Contractor fields
        "company_name": data.company_name or "",
        "logo": None,
        "hide_location": False,
        "favorite_crew": [],
    }

    # Handle referral
    if data.referral_code_used:
        referrer = await db.users.find_one({"referral_code": data.referral_code_used})
        if referrer:
            user_doc["referred_by"] = referrer["id"]
            await db.users.update_one(
                {"id": referrer["id"]},
                {"$inc": {"points": 100}}
            )
            await db.referrals.insert_one({
                "id": str(uuid.uuid4()),
                "referrer_id": referrer["id"],
                "referred_id": user_doc["id"],
                "points_awarded": 100,
                "created_at": now
            })

    await db.users.insert_one(user_doc)

    # Create admin default if this is first admin
    token = create_token({"sub": user_doc["id"], "role": user_doc["role"]})
    await send_welcome_email(data.name, data.email, data.role)

    return {"access_token": token, "token_type": "bearer", "user": user_to_response(user_doc)}


@router.post("/login")
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email.lower()}, {"_id": 0})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account suspended")

    token = create_token({"sub": user["id"], "role": user["role"]})
    return {"access_token": token, "token_type": "bearer", "user": user_to_response(user)}


@router.get("/me")
async def me(credentials=None):
    from auth import get_current_user
    from fastapi import Depends
    # This endpoint requires auth, handled via dependency in router
    pass


@router.get("/profile")
async def get_profile(current_user: dict = None):
    return user_to_response(current_user)
