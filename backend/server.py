from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
import uuid
from auth import hash_password
from database import db
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

app = FastAPI(title="TheDayLaborers API", version="1.0.0", redirect_slashes=False)

api_router = APIRouter(prefix="/api")

# Import routers
from routes.auth_routes import router as auth_router
from routes.job_routes import router as job_router
from routes.user_routes import router as user_router
from routes.admin_routes import router as admin_router
from routes.payment_routes import router as payment_router
from routes.ws_routes import router as ws_router

# Register routes
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(job_router, prefix="/jobs", tags=["jobs"])
api_router.include_router(user_router, prefix="/users", tags=["users"])
api_router.include_router(admin_router, prefix="/admin", tags=["admin"])
api_router.include_router(payment_router, prefix="/payments", tags=["payments"])

# Public settings (no auth) - social links for sharing
from fastapi import APIRouter as _AR
from database import db as _db
_pub = _AR()

@_pub.get("/settings/public")
async def public_settings():
    settings = await _db.settings.find_one({}, {"_id": 0})
    defaults = {
        "social_linkedin_enabled": True, "social_twitter_enabled": True,
        "social_facebook_enabled": True, "social_native_share_enabled": True
    }
    if not settings:
        return defaults
    result = {k: v for k, v in settings.items() if k.startswith("social_")}
    return {**defaults, **result}

api_router.include_router(_pub)

# WebSocket router (no /api prefix for WS path, but accessible via /api/ws)
api_router.include_router(ws_router)

@api_router.get("/")
async def root():
    return {"message": "TheDayLaborers API", "status": "operational", "version": "1.0.0"}

app.include_router(api_router)

# Static files for uploads
uploads_dir = ROOT_DIR / "uploads"
uploads_dir.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def hide_old_completed_jobs():
    """Cron job: hide completed jobs older than 12 hours."""
    try:
        settings = await db.settings.find_one({}, {"_id": 0})
        hours = settings.get("job_visibility_hours", 12) if settings else 12
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
        result = await db.jobs.update_many(
            {"status": "completed", "completed_at": {"$lt": cutoff}, "is_hidden": {"$ne": True}},
            {"$set": {"is_hidden": True}}
        )
        if result.modified_count > 0:
            logger.info(f"Cron: hid {result.modified_count} completed jobs older than {hours}h")
    except Exception as e:
        logger.error(f"Cron job error: {e}")


@app.on_event("startup")
async def startup_event():
    # Create indexes
    try:
        await db.users.create_index("email", unique=True)
        await db.users.create_index("referral_code", sparse=True)
        await db.jobs.create_index("status")
        await db.jobs.create_index("contractor_id")
        await db.jobs.create_index("created_at")
        await db.jobs.create_index([("completed_at", 1), ("status", 1)])
        logger.info("Database indexes created")
    except Exception as e:
        logger.warning(f"Index creation: {e}")

    # Create default admin if not exists
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@thedaylaborers.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin@123")
    existing_admin = await db.users.find_one({"role": "admin"})
    if not existing_admin:
        import random, string
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
        now = datetime.now(timezone.utc).isoformat()
        admin_doc = {
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "role": "admin",
            "name": "Platform Admin",
            "phone": None,
            "is_active": True,
            "is_verified": True,
            "created_at": now,
            "trial_start_date": now,
            "trial_end_date": (datetime.now(timezone.utc) + timedelta(days=3650)).isoformat(),
            "subscription_status": "active",
            "subscription_plan": "monthly",
            "subscription_end": (datetime.now(timezone.utc) + timedelta(days=3650)).isoformat(),
            "points": 0,
            "referral_code": code,
            "referred_by": None,
            "bio": "", "trade": "", "skills": [], "profile_photo": None,
            "availability": True, "is_online": True, "location": None,
            "rating": 0.0, "rating_count": 0, "jobs_completed": 0,
            "company_name": "", "logo": None, "hide_location": False, "favorite_crew": []
        }
        await db.users.insert_one(admin_doc)
        logger.info(f"Default admin created: {admin_email}")

    # Init default settings
    existing_settings = await db.settings.find_one({})
    if not existing_settings:
        await db.settings.insert_one({
            "daily_price": 4.99,
            "weekly_price": 24.99,
            "monthly_price": 79.99,
            "annual_price": 699.99,
            "trial_days": 30,
            "job_visibility_hours": 12
        })
        logger.info("Default settings created")
    else:
        # Add annual_price if missing
        if not existing_settings.get("annual_price"):
            await db.settings.update_one({}, {"$set": {"annual_price": 699.99}})

    # Start cron scheduler
    scheduler.add_job(hide_old_completed_jobs, "interval", hours=1, id="hide_jobs_cron", replace_existing=True)
    scheduler.start()
    logger.info("Scheduler started: hide_jobs_cron every hour")

    logger.info("TheDayLaborers API started successfully")


@app.on_event("shutdown")
async def shutdown_db_client():
    scheduler.shutdown(wait=False)
    from database import client
    client.close()
