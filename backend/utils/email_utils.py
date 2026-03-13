import resend
import asyncio
import os
import logging

logger = logging.getLogger(__name__)

resend.api_key = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')


async def send_email(to: str, subject: str, html: str) -> bool:
    try:
        params = {"from": SENDER_EMAIL, "to": [to], "subject": subject, "html": html}
        await asyncio.to_thread(resend.Emails.send, params)
        return True
    except Exception as e:
        logger.error(f"Email send failed: {e}")
        return False


async def send_welcome_email(name: str, email: str, role: str):
    html = f"""
    <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;background:#050A30;padding:40px;border-radius:12px">
      <h1 style="color:#7EC8E3;font-size:28px;margin-bottom:8px">Welcome to TheDayLaborers!</h1>
      <p style="color:#fff;font-size:16px">Hi {name},</p>
      <p style="color:#ccc">Your account as a <strong style="color:#7EC8E3">{role.title()}</strong> has been created successfully.</p>
      <p style="color:#ccc">You have a <strong style="color:#FFD700">30-day free trial</strong> to explore the platform.</p>
      <a href="https://thedaylaborers.com" style="display:inline-block;background:#0000FF;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:16px">Get Started</a>
      <p style="color:#666;margin-top:32px;font-size:12px">TheDayLaborers &mdash; A Blue Collar ME Company</p>
    </div>
    """
    await send_email(email, "Welcome to TheDayLaborers!", html)


async def send_job_notification_email(crew_email: str, crew_name: str, job_title: str, pay_rate: float, location: str):
    html = f"""
    <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;background:#050A30;padding:40px;border-radius:12px">
      <h1 style="color:#FFD700;font-size:24px">New Job Available!</h1>
      <p style="color:#fff">Hi {crew_name},</p>
      <p style="color:#ccc">A new job matching your skills is available:</p>
      <div style="background:#000C66;border-radius:8px;padding:20px;margin:16px 0">
        <h2 style="color:#7EC8E3;margin:0 0 8px">{job_title}</h2>
        <p style="color:#fff;margin:4px 0">Pay Rate: <strong>${pay_rate}/hr</strong></p>
        <p style="color:#fff;margin:4px 0">Location: {location}</p>
      </div>
      <a href="https://thedaylaborers.com/crew/dashboard" style="display:inline-block;background:#0000FF;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">View Job</a>
    </div>
    """
    await send_email(crew_email, f"New Job: {job_title}", html)


async def send_job_completion_email(contractor_email: str, contractor_name: str, job_title: str):
    html = f"""
    <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;background:#050A30;padding:40px;border-radius:12px">
      <h1 style="color:#10B981;font-size:24px">Job Completed!</h1>
      <p style="color:#fff">Hi {contractor_name},</p>
      <p style="color:#ccc">Your job <strong style="color:#7EC8E3">{job_title}</strong> has been marked as complete by the crew.</p>
      <p style="color:#ccc">Please verify completion from your dashboard.</p>
      <a href="https://thedaylaborers.com/contractor/dashboard" style="display:inline-block;background:#0000FF;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Verify Completion</a>
    </div>
    """
    await send_email(contractor_email, f"Job Completed: {job_title}", html)


async def send_subscription_email(email: str, name: str, plan: str, end_date: str):
    html = f"""
    <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;background:#050A30;padding:40px;border-radius:12px">
      <h1 style="color:#10B981;font-size:24px">Subscription Activated!</h1>
      <p style="color:#fff">Hi {name},</p>
      <p style="color:#ccc">Your <strong style="color:#7EC8E3">{plan.title()}</strong> subscription is now active.</p>
      <p style="color:#ccc">Access expires: <strong>{end_date}</strong></p>
      <a href="https://thedaylaborers.com" style="display:inline-block;background:#0000FF;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Go to Dashboard</a>
    </div>
    """
    await send_email(email, "Subscription Activated - TheDayLaborers", html)
