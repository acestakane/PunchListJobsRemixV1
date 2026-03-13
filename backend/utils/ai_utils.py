import os
import uuid
import logging
from emergentintegrations.llm.chat import LlmChat, UserMessage

logger = logging.getLogger(__name__)

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')


async def get_job_match_score(job: dict, crew_member: dict) -> float:
    """Use AI to score how well a crew member matches a job."""
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=str(uuid.uuid4()),
            system_message="You are a workforce matching assistant. Score the compatibility of a worker with a job from 0.0 to 1.0 based on skills, trade, and experience. Return ONLY a decimal number like 0.85."
        ).with_model("openai", "gpt-4o")

        job_info = f"Job: {job.get('title')}, Trade: {job.get('trade')}, Description: {job.get('description', '')[:200]}"
        worker_info = f"Worker: {crew_member.get('name')}, Trade: {crew_member.get('trade', 'N/A')}, Skills: {', '.join(crew_member.get('skills', []))}, Rating: {crew_member.get('rating', 0)}"

        msg = UserMessage(text=f"{job_info}\n{worker_info}\nReturn match score (0.0-1.0):")
        response = await chat.send_message(msg)
        score = float(response.strip())
        return min(max(score, 0.0), 1.0)
    except Exception as e:
        logger.error(f"AI matching error: {e}")
        return 0.5


async def detect_fraud(activity: dict) -> dict:
    """Analyze user activity for fraud/abuse patterns."""
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=str(uuid.uuid4()),
            system_message="You are a fraud detection system for a workforce marketplace. Analyze the activity and return a JSON with: {\"risk_score\": 0.0-1.0, \"flags\": [list of concerns], \"action\": \"allow|review|block\"}. Return ONLY valid JSON."
        ).with_model("openai", "gpt-4o")

        msg = UserMessage(text=f"Analyze this activity: {str(activity)[:500]}")
        response = await chat.send_message(msg)
        import json
        return json.loads(response.strip())
    except Exception as e:
        logger.error(f"Fraud detection error: {e}")
        return {"risk_score": 0.0, "flags": [], "action": "allow"}


async def generate_smart_job_matches(jobs: list, crew_member: dict) -> list:
    """Sort jobs by AI-predicted match score for a crew member."""
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=str(uuid.uuid4()),
            system_message="You are a smart job matching assistant. Given a list of jobs and a worker profile, return the job IDs ordered from best to worst match. Return ONLY a JSON array of IDs."
        ).with_model("openai", "gpt-4o")

        jobs_summary = [{"id": j["id"], "title": j["title"], "trade": j["trade"]} for j in jobs[:10]]
        worker_info = f"Trade: {crew_member.get('trade', 'N/A')}, Skills: {', '.join(crew_member.get('skills', []))}"
        msg = UserMessage(text=f"Worker: {worker_info}\nJobs: {str(jobs_summary)}\nReturn ordered IDs array:")
        response = await chat.send_message(msg)
        import json
        ordered_ids = json.loads(response.strip())
        id_order = {id: i for i, id in enumerate(ordered_ids)}
        return sorted(jobs, key=lambda j: id_order.get(j["id"], 999))
    except Exception as e:
        logger.error(f"Smart matching error: {e}")
        return jobs
