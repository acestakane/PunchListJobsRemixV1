import os
import uuid
import httpx
import base64
import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request, Depends
from database import db
from auth import get_current_user
from models import CheckoutRequest
from utils.email_utils import send_subscription_email
from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout, CheckoutSessionRequest, CheckoutSessionResponse, CheckoutStatusResponse
)

router = APIRouter()
logger = logging.getLogger(__name__)

STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "sk_test_emergent")
PAYPAL_CLIENT_ID = os.environ.get("PAYPAL_CLIENT_ID", "")
PAYPAL_SECRET = os.environ.get("PAYPAL_SECRET", "")
PAYPAL_MODE = os.environ.get("PAYPAL_MODE", "sandbox")
PAYPAL_BASE_URL = "https://api-m.sandbox.paypal.com" if PAYPAL_MODE == "sandbox" else "https://api-m.paypal.com"
SQUARE_ACCESS_TOKEN = os.environ.get("SQUARE_ACCESS_TOKEN", "")
SQUARE_LOCATION_ID = os.environ.get("SQUARE_LOCATION_ID", "")

# Subscription plans (prices defined server-side for security)
PLANS = {
    "daily": {"amount": 4.99, "days": 1, "label": "Daily Pass"},
    "weekly": {"amount": 24.99, "days": 7, "label": "Weekly Pass"},
    "monthly": {"amount": 79.99, "days": 30, "label": "Monthly Pass"},
    "annual": {"amount": 699.99, "days": 365, "label": "Annual Pass"},
}


def now_str():
    return datetime.now(timezone.utc).isoformat()


async def get_paypal_token() -> str:
    credentials = base64.b64encode(f"{PAYPAL_CLIENT_ID}:{PAYPAL_SECRET}".encode()).decode()
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{PAYPAL_BASE_URL}/v1/oauth2/token",
            headers={"Authorization": f"Basic {credentials}", "Content-Type": "application/x-www-form-urlencoded"},
            data={"grant_type": "client_credentials"}
        )
        resp.raise_for_status()
        return resp.json()["access_token"]


async def update_subscription(user_id: str, plan: str, days: int, payment_method: str, amount: float):
    """Update user subscription after successful payment."""
    now = datetime.now(timezone.utc)
    sub_end = (now + timedelta(days=days)).isoformat()
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "subscription_status": "active",
            "subscription_plan": plan,
            "subscription_end": sub_end
        }}
    )
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if user:
        await send_subscription_email(user["email"], user["name"], plan, sub_end)
    return sub_end


@router.get("/plans")
async def get_plans():
    settings = await db.settings.find_one({}, {"_id": 0})
    if settings:
        PLANS["daily"]["amount"] = settings.get("daily_price", PLANS["daily"]["amount"])
        PLANS["weekly"]["amount"] = settings.get("weekly_price", PLANS["weekly"]["amount"])
        PLANS["monthly"]["amount"] = settings.get("monthly_price", PLANS["monthly"]["amount"])
    return PLANS


# ─── Stripe ──────────────────────────────────────────────────────────────────

@router.post("/stripe/create-session")
async def stripe_create_session(data: CheckoutRequest, current_user: dict = Depends(get_current_user)):
    if data.plan not in PLANS:
        raise HTTPException(status_code=400, detail="Invalid plan")

    plan_info = PLANS[data.plan]
    # Refresh prices from settings
    settings = await db.settings.find_one({}, {"_id": 0})
    if settings:
        plan_info = {
            "daily": {"amount": settings.get("daily_price", 4.99), "days": 1, "label": "Daily Pass"},
            "weekly": {"amount": settings.get("weekly_price", 24.99), "days": 7, "label": "Weekly Pass"},
            "monthly": {"amount": settings.get("monthly_price", 79.99), "days": 30, "label": "Monthly Pass"},
        }.get(data.plan, plan_info)

    origin = data.origin_url.rstrip("/")
    success_url = f"{origin}/subscription?session_id={{CHECKOUT_SESSION_ID}}&method=stripe"
    cancel_url = f"{origin}/subscription"

    stripe = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=f"{origin}/api/payments/stripe/webhook")
    req = CheckoutSessionRequest(
        amount=float(plan_info["amount"]),
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={"user_id": current_user["id"], "plan": data.plan, "payment_method": "stripe"}
    )
    session = await stripe.create_checkout_session(req)

    # Record pending transaction
    tx = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "session_id": session.session_id,
        "amount": float(plan_info["amount"]),
        "currency": "usd",
        "plan": data.plan,
        "payment_method": "stripe",
        "payment_status": "pending",
        "created_at": now_str()
    }
    await db.payment_transactions.insert_one(tx)

    return {"url": session.url, "session_id": session.session_id}


@router.get("/stripe/status/{session_id}")
async def stripe_payment_status(session_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    stripe = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=f"{str(request.base_url)}api/payments/stripe/webhook")

    # Check if already processed
    tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if tx and tx.get("payment_status") == "paid":
        return {"status": "complete", "payment_status": "paid", "already_processed": True}

    status = await stripe.get_checkout_status(session_id)

    if status.payment_status == "paid" and (not tx or tx.get("payment_status") != "paid"):
        plan = status.metadata.get("plan", "monthly")
        user_id = status.metadata.get("user_id", current_user["id"])
        plan_info = PLANS.get(plan, PLANS["monthly"])
        sub_end = await update_subscription(user_id, plan, plan_info["days"], "stripe", status.amount_total / 100)

        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"payment_status": "paid", "updated_at": now_str()}}
        )

    return {"status": status.status, "payment_status": status.payment_status}


@router.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    try:
        body = await request.body()
        stripe = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url="")
        event = await stripe.handle_webhook(body, request.headers.get("Stripe-Signature", ""))
        if event.payment_status == "paid":
            await db.payment_transactions.update_one(
                {"session_id": event.session_id},
                {"$set": {"payment_status": "paid", "updated_at": now_str()}}
            )
    except Exception as e:
        logger.warning(f"Stripe webhook error: {e}")
    return {"status": "ok"}


# ─── PayPal ──────────────────────────────────────────────────────────────────

@router.post("/paypal/create-order")
async def paypal_create_order(data: CheckoutRequest, current_user: dict = Depends(get_current_user)):
    if data.plan not in PLANS:
        raise HTTPException(status_code=400, detail="Invalid plan")

    plan_info = PLANS[data.plan]
    settings = await db.settings.find_one({}, {"_id": 0})
    if settings:
        plan_info = {
            "daily": {"amount": settings.get("daily_price", 4.99), "days": 1},
            "weekly": {"amount": settings.get("weekly_price", 24.99), "days": 7},
            "monthly": {"amount": settings.get("monthly_price", 79.99), "days": 30},
        }.get(data.plan, plan_info)

    access_token = await get_paypal_token()

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{PAYPAL_BASE_URL}/v2/checkout/orders",
            headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
            json={
                "intent": "CAPTURE",
                "purchase_units": [{
                    "reference_id": f"{current_user['id']}_{data.plan}",
                    "description": f"TheDayLaborers {data.plan.title()} Subscription",
                    "amount": {"currency_code": "USD", "value": f"{plan_info['amount']:.2f}"}
                }],
                "application_context": {
                    "return_url": f"{data.origin_url}/subscription?method=paypal&plan={data.plan}",
                    "cancel_url": f"{data.origin_url}/subscription"
                }
            }
        )
        resp.raise_for_status()
        order = resp.json()

    # Record pending transaction
    order_id = order["id"]
    tx = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "session_id": order_id,
        "amount": float(plan_info["amount"]),
        "currency": "usd",
        "plan": data.plan,
        "payment_method": "paypal",
        "payment_status": "pending",
        "created_at": now_str()
    }
    await db.payment_transactions.insert_one(tx)

    approve_url = next((l["href"] for l in order["links"] if l["rel"] == "approve"), None)
    return {"order_id": order_id, "approve_url": approve_url}


@router.post("/paypal/capture/{order_id}")
async def paypal_capture(order_id: str, plan: str, current_user: dict = Depends(get_current_user)):
    # Check already processed
    tx = await db.payment_transactions.find_one({"session_id": order_id}, {"_id": 0})
    if tx and tx.get("payment_status") == "paid":
        return {"status": "COMPLETED", "already_processed": True}

    access_token = await get_paypal_token()

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{PAYPAL_BASE_URL}/v2/checkout/orders/{order_id}/capture",
            headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
        )
        resp.raise_for_status()
        result = resp.json()

    status = result.get("status")
    if status == "COMPLETED":
        plan_info = PLANS.get(plan, PLANS["monthly"])
        await update_subscription(current_user["id"], plan, plan_info["days"], "paypal", plan_info["amount"])
        await db.payment_transactions.update_one(
            {"session_id": order_id},
            {"$set": {"payment_status": "paid", "updated_at": now_str()}}
        )

    return {"status": status, "order_id": order_id}


# ─── Subscription Status ─────────────────────────────────────────────────────

@router.get("/subscription/status")
async def subscription_status(current_user: dict = Depends(get_current_user)):
    from datetime import datetime, timezone
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    sub_status = user.get("subscription_status", "trial")
    sub_end = user.get("subscription_end")
    trial_end = user.get("trial_end_date")

    days_left = 0
    if sub_status == "active" and sub_end:
        try:
            end = datetime.fromisoformat(sub_end)
            days_left = max(0, (end - datetime.now(timezone.utc)).days)
            if days_left == 0:
                await db.users.update_one({"id": current_user["id"]}, {"$set": {"subscription_status": "expired"}})
                sub_status = "expired"
        except Exception:
            pass
    elif sub_status == "trial" and trial_end:
        try:
            end = datetime.fromisoformat(trial_end)
            days_left = max(0, (end - datetime.now(timezone.utc)).days)
            if days_left == 0:
                await db.users.update_one({"id": current_user["id"]}, {"$set": {"subscription_status": "expired"}})
                sub_status = "expired"
        except Exception:
            pass

    return {
        "status": sub_status,
        "plan": user.get("subscription_plan"),
        "days_remaining": days_left,
        "subscription_end": sub_end or trial_end
    }


# ─── Square / CashApp Pay ─────────────────────────────────────────────────────

def get_square_client():
    from square import Square
    from square.environment import SquareEnvironment
    return Square(token=SQUARE_ACCESS_TOKEN, environment=SquareEnvironment.PRODUCTION)


@router.post("/square/create-link")
async def square_create_link(data: CheckoutRequest, current_user: dict = Depends(get_current_user)):
    if data.plan not in PLANS:
        raise HTTPException(status_code=400, detail="Invalid plan")
    if not SQUARE_ACCESS_TOKEN or not SQUARE_LOCATION_ID:
        raise HTTPException(status_code=500, detail="Square not configured")

    plan_info = PLANS[data.plan]
    settings = await db.settings.find_one({}, {"_id": 0})
    if settings:
        plan_info = {
            "daily": {"amount": settings.get("daily_price", 4.99), "days": 1, "label": "Daily Pass"},
            "weekly": {"amount": settings.get("weekly_price", 24.99), "days": 7, "label": "Weekly Pass"},
            "monthly": {"amount": settings.get("monthly_price", 79.99), "days": 30, "label": "Monthly Pass"},
            "annual": {"amount": settings.get("annual_price", 699.99), "days": 365, "label": "Annual Pass"},
        }.get(data.plan, plan_info)

    amount_cents = int(plan_info["amount"] * 100)
    origin = data.origin_url.rstrip("/")
    redirect_url = f"{origin}/subscription?method=square&plan={data.plan}&user_id={current_user['id']}"
    idempotency_key = str(uuid.uuid4())

    try:
        client = get_square_client()
        resp = client.checkout.payment_links.create(
            idempotency_key=idempotency_key,
            description=f"TheDayLaborers {plan_info['label']}",
            quick_pay={
                "name": f"TheDayLaborers {plan_info['label']}",
                "price_money": {"amount": amount_cents, "currency": "USD"},
                "location_id": SQUARE_LOCATION_ID,
            },
            checkout_options={
                "redirect_url": redirect_url,
                "ask_for_shipping_address": False,
            },
        )

        if resp.errors:
            raise HTTPException(status_code=400, detail=f"Square error: {resp.errors}")

        link = resp.payment_link
        tx = {
            "id": str(uuid.uuid4()),
            "user_id": current_user["id"],
            "session_id": link.id,
            "order_id": link.order_id,
            "amount": float(plan_info["amount"]),
            "currency": "usd",
            "plan": data.plan,
            "payment_method": "square",
            "payment_status": "pending",
            "created_at": now_str(),
        }
        await db.payment_transactions.insert_one(tx)
        return {"url": link.url, "link_id": link.id, "order_id": link.order_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Square payment link error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create Square payment link: {str(e)}")


@router.get("/square/status/{order_id}")
async def square_payment_status(order_id: str, plan: str, user_id: str, current_user: dict = Depends(get_current_user)):
    # Check if already processed
    tx = await db.payment_transactions.find_one({"order_id": order_id}, {"_id": 0})
    if tx and tx.get("payment_status") == "paid":
        return {"status": "COMPLETED", "already_processed": True}

    if not SQUARE_ACCESS_TOKEN:
        raise HTTPException(status_code=500, detail="Square not configured")

    try:
        client = get_square_client()
        resp = client.orders.get(order_id=order_id)
        if resp.errors:
            raise HTTPException(status_code=400, detail=str(resp.errors))

        order = resp.order
        state = order.state if order else "UNKNOWN"

        if state == "COMPLETED" and (not tx or tx.get("payment_status") != "paid"):
            actual_user_id = user_id or (tx["user_id"] if tx else current_user["id"])
            if plan in PLANS:
                plan_info = PLANS[plan]
                await update_subscription(actual_user_id, plan, plan_info["days"], "square", plan_info["amount"])
            await db.payment_transactions.update_one(
                {"order_id": order_id},
                {"$set": {"payment_status": "paid", "updated_at": now_str()}},
                upsert=True
            )

        return {"status": state, "order_id": order_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Square status check error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
