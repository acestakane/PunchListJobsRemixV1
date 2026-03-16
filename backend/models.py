import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, EmailStr


def utc_now_str() -> str:
    return datetime.now(timezone.utc).isoformat()


def trial_end_str(days: int = 30) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()


# ─── Auth Models ─────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: str  # crew, contractor, admin
    name: str
    phone: Optional[str] = None
    trade: Optional[str] = None
    bio: Optional[str] = None
    referral_code_used: Optional[str] = None
    company_name: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict


# ─── User Models ─────────────────────────────────────────────────────────────

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    bio: Optional[str] = None
    trade: Optional[str] = None
    skills: Optional[List[str]] = None
    availability: Optional[bool] = None
    is_online: Optional[bool] = None
    location: Optional[Dict] = None
    address: Optional[str] = None
    company_name: Optional[str] = None
    hide_location: Optional[bool] = None


class OnlineStatusUpdate(BaseModel):
    is_online: bool


class LocationUpdate(BaseModel):
    lat: float
    lng: float
    city: Optional[str] = None


# ─── Job Models ──────────────────────────────────────────────────────────────

class JobCreate(BaseModel):
    title: str
    description: str
    trade: str
    crew_needed: int
    start_time: str
    pay_rate: float
    address: str
    is_emergency: bool = False


class JobUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    trade: Optional[str] = None
    crew_needed: Optional[int] = None
    start_time: Optional[str] = None
    pay_rate: Optional[float] = None
    is_emergency: Optional[bool] = None


# ─── Rating Models ───────────────────────────────────────────────────────────

class RatingCreate(BaseModel):
    rated_id: str
    job_id: str
    stars: int  # 1-5
    review: Optional[str] = None


# ─── Payment Models ──────────────────────────────────────────────────────────

class CheckoutRequest(BaseModel):
    plan: str  # daily, weekly, monthly, annual
    payment_method: str  # stripe, paypal, square
    origin_url: str


class PayPalCaptureRequest(BaseModel):
    order_id: str
    plan: str
    user_id: str


# ─── Admin Models ────────────────────────────────────────────────────────────

class AdminUserUpdate(BaseModel):
    is_active: Optional[bool] = None
    is_verified: Optional[bool] = None
    role: Optional[str] = None
    points: Optional[int] = None
    subscription_status: Optional[str] = None


class TermsUpdate(BaseModel):
    content: str


class SettingsUpdate(BaseModel):
    daily_price: Optional[float] = None
    weekly_price: Optional[float] = None
    monthly_price: Optional[float] = None
    trial_days: Optional[int] = None
    job_visibility_hours: Optional[int] = None


# ─── Referral / Points ───────────────────────────────────────────────────────

class RedeemPoints(BaseModel):
    points: int  # points to redeem for subscription days
