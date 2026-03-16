from fastapi import APIRouter, HTTPException, Depends, Query
from database import db
from auth import get_current_user
from models import AdminUserUpdate, TermsUpdate, SettingsUpdate
from typing import Optional
import uuid
import logging
from datetime import datetime, timezone

router = APIRouter()
logger = logging.getLogger(__name__)


async def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


@router.get("/analytics")
async def get_analytics(admin: dict = Depends(require_admin)):
    total_users = await db.users.count_documents({"role": {"$ne": "admin"}})
    crew_count = await db.users.count_documents({"role": "crew"})
    contractor_count = await db.users.count_documents({"role": "contractor"})
    active_jobs = await db.jobs.count_documents({"status": {"$in": ["open", "fulfilled", "in_progress"]}})
    completed_jobs = await db.jobs.count_documents({"status": "completed"})
    total_jobs = await db.jobs.count_documents({})
    active_subs = await db.users.count_documents({"subscription_status": "active"})
    trial_subs = await db.users.count_documents({"subscription_status": "trial"})
    expired_subs = await db.users.count_documents({"subscription_status": "expired"})

    # Revenue from payments
    payments = await db.payment_transactions.find(
        {"payment_status": "paid"},
        {"_id": 0, "amount": 1, "plan": 1, "payment_method": 1, "created_at": 1}
    ).to_list(1000)
    total_revenue = sum(p.get("amount", 0) for p in payments)

    # Revenue by method
    revenue_by_method = {}
    for p in payments:
        m = p.get("payment_method", "unknown")
        revenue_by_method[m] = round(revenue_by_method.get(m, 0) + p.get("amount", 0), 2)

    # Crew utilization: % of crew members who have completed at least 1 job
    active_crew = await db.users.count_documents({"role": "crew", "jobs_completed": {"$gt": 0}})
    crew_utilization = round((active_crew / crew_count * 100) if crew_count > 0 else 0, 1)

    # Online crew count
    online_crew = await db.users.count_documents({"role": "crew", "is_online": True})

    # Job completion rate
    job_completion_rate = round((completed_jobs / total_jobs * 100) if total_jobs > 0 else 0, 1)

    # Top contractors by spend
    top_contractors = await db.payment_transactions.aggregate([
        {"$match": {"payment_status": "paid"}},
        {"$group": {"_id": "$user_id", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
        {"$sort": {"total": -1}},
        {"$limit": 5}
    ]).to_list(5)

    # Enrich with user names
    for c in top_contractors:
        u = await db.users.find_one({"id": c["_id"]}, {"_id": 0, "name": 1, "company_name": 1})
        c["name"] = (u.get("company_name") or u.get("name", "Unknown")) if u else "Unknown"
        c["total"] = round(c["total"], 2)

    # Top crew by jobs completed
    top_crew = await db.users.find(
        {"role": "crew"},
        {"_id": 0, "name": 1, "jobs_completed": 1, "rating": 1, "trade": 1}
    ).sort("jobs_completed", -1).limit(5).to_list(5)

    # Jobs by trade
    jobs_by_trade = await db.jobs.aggregate([
        {"$group": {"_id": "$trade", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 8}
    ]).to_list(8)

    # Recent activity
    recent_users = await db.users.find(
        {}, {"_id": 0, "password_hash": 0}
    ).sort("created_at", -1).to_list(10)

    return {
        "total_users": total_users,
        "crew_count": crew_count,
        "contractor_count": contractor_count,
        "active_jobs": active_jobs,
        "completed_jobs": completed_jobs,
        "total_jobs": total_jobs,
        "active_subscriptions": active_subs,
        "trial_subscriptions": trial_subs,
        "expired_subscriptions": expired_subs,
        "total_revenue": round(total_revenue, 2),
        "revenue_by_method": revenue_by_method,
        "crew_utilization": crew_utilization,
        "online_crew": online_crew,
        "job_completion_rate": job_completion_rate,
        "top_contractors": top_contractors,
        "top_crew": top_crew,
        "jobs_by_trade": [{"trade": j["_id"] or "other", "count": j["count"]} for j in jobs_by_trade],
        "recent_users": recent_users
    }


@router.get("/users")
async def list_users(
    role: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    admin: dict = Depends(require_admin)
):
    query = {}
    if role:
        query["role"] = role
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}}
        ]

    skip = (page - 1) * limit
    users = await db.users.find(query, {"_id": 0, "password_hash": 0}).skip(skip).limit(limit).to_list(limit)
    total = await db.users.count_documents(query)
    return {"users": users, "total": total, "page": page, "pages": (total + limit - 1) // limit}


@router.get("/users/{user_id}")
async def get_user(user_id: str, admin: dict = Depends(require_admin)):
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/users/{user_id}")
async def update_user(user_id: str, data: AdminUserUpdate, admin: dict = Depends(require_admin)):
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = await db.users.update_one({"id": user_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User updated"}


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, admin: dict = Depends(require_admin)):
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted"}


@router.post("/users/{user_id}/suspend")
async def suspend_user(user_id: str, admin: dict = Depends(require_admin)):
    await db.users.update_one({"id": user_id}, {"$set": {"is_active": False}})
    return {"message": "User suspended"}


@router.post("/users/{user_id}/activate")
async def activate_user(user_id: str, admin: dict = Depends(require_admin)):
    await db.users.update_one({"id": user_id}, {"$set": {"is_active": True}})
    return {"message": "User activated"}


@router.put("/users/{user_id}/points")
async def update_user_points(user_id: str, points: int, admin: dict = Depends(require_admin)):
    await db.users.update_one({"id": user_id}, {"$set": {"points": points}})
    return {"message": f"Points set to {points}"}


@router.get("/jobs")
async def list_all_jobs(
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    admin: dict = Depends(require_admin)
):
    query = {}
    if status:
        query["status"] = status
    skip = (page - 1) * limit
    jobs = await db.jobs.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.jobs.count_documents(query)
    return {"jobs": jobs, "total": total, "page": page}


@router.get("/map-data")
async def get_map_data(admin: dict = Depends(require_admin)):
    """Get all active jobs and worker locations for admin map."""
    active_jobs = await db.jobs.find(
        {"status": {"$in": ["open", "fulfilled", "in_progress"]}},
        {"_id": 0}
    ).to_list(500)

    crew_with_location = await db.users.find(
        {"role": "crew", "location": {"$ne": None}, "is_active": True},
        {"_id": 0, "password_hash": 0, "id": 1, "name": 1, "trade": 1, "location": 1, "availability": 1}
    ).to_list(1000)

    return {"jobs": active_jobs, "crew": crew_with_location}


@router.get("/settings")
async def get_settings(admin: dict = Depends(require_admin)):
    settings = await db.settings.find_one({}, {"_id": 0})
    if not settings:
        settings = {
            "daily_price": 4.99,
            "weekly_price": 24.99,
            "monthly_price": 79.99,
            "trial_days": 30,
            "job_visibility_hours": 12
        }
    return settings


@router.put("/settings")
async def update_settings(data: SettingsUpdate, admin: dict = Depends(require_admin)):
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    await db.settings.update_one({}, {"$set": update}, upsert=True)
    return {"message": "Settings updated"}


@router.get("/terms")
async def get_terms(admin: dict = Depends(require_admin)):
    terms = await db.terms.find_one({}, {"_id": 0})
    return terms or {"content": "Terms and Conditions will be added here.", "version": 1}


@router.put("/terms")
async def update_terms(data: TermsUpdate, admin: dict = Depends(require_admin)):
    existing = await db.terms.find_one({})
    version = (existing.get("version", 0) + 1) if existing else 1
    await db.terms.update_one(
        {},
        {"$set": {"content": data.content, "version": version, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    return {"message": "Terms updated", "version": version}


@router.get("/payments")
async def list_payments(admin: dict = Depends(require_admin)):
    payments = await db.payment_transactions.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return payments
