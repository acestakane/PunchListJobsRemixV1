"""
Backend API tests for TheDayLaborers - covers auth, jobs, admin, payments
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@thedaylaborers.com"
ADMIN_PASSWORD = "Admin@123"
CREW_EMAIL = f"TEST_crew_{int(time.time())}@example.com"
CREW_PASSWORD = "TestPass@123"
CONTRACTOR_EMAIL = f"TEST_contractor_{int(time.time())}@example.com"
CONTRACTOR_PASSWORD = "TestPass@123"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_token(session):
    resp = session.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert resp.status_code == 200, f"Admin login failed: {resp.text}"
    return resp.json()["access_token"]


@pytest.fixture(scope="module")
def crew_token(session):
    """Register and login as crew member"""
    resp = session.post(f"{BASE_URL}/api/auth/register", json={
        "email": CREW_EMAIL,
        "password": CREW_PASSWORD,
        "name": "TEST Crew Member",
        "role": "crew",
        "trade": "Electrician"
    })
    if resp.status_code == 201:
        return resp.json()["access_token"]
    # Try login if already exists
    resp2 = session.post(f"{BASE_URL}/api/auth/login", json={"email": CREW_EMAIL, "password": CREW_PASSWORD})
    assert resp2.status_code == 200
    return resp2.json()["access_token"]


@pytest.fixture(scope="module")
def contractor_token(session):
    """Register and login as contractor"""
    resp = session.post(f"{BASE_URL}/api/auth/register", json={
        "email": CONTRACTOR_EMAIL,
        "password": CONTRACTOR_PASSWORD,
        "name": "TEST Contractor",
        "role": "contractor",
        "company_name": "TEST Corp"
    })
    if resp.status_code == 201:
        return resp.json()["access_token"]
    resp2 = session.post(f"{BASE_URL}/api/auth/login", json={"email": CONTRACTOR_EMAIL, "password": CONTRACTOR_PASSWORD})
    assert resp2.status_code == 200
    return resp2.json()["access_token"]


@pytest.fixture(scope="module")
def job_id(session, contractor_token):
    """Create a test job and return its ID"""
    resp = session.post(
        f"{BASE_URL}/api/jobs/",
        json={
            "title": "TEST Job Electrician",
            "description": "Test job description",
            "trade": "Electrician",
            "crew_needed": 2,
            "start_time": "2026-03-01T08:00:00Z",
            "pay_rate": 25.0,
            "address": "Miami, FL",
            "is_emergency": False
        },
        headers={"Authorization": f"Bearer {contractor_token}"}
    )
    assert resp.status_code == 201, f"Job creation failed: {resp.text}"
    return resp.json()["id"]


# ─── Health Check ─────────────────────────────────────────────────────────────

class TestHealth:
    def test_root_returns_operational(self, session):
        resp = session.get(f"{BASE_URL}/api/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "operational"
        print(f"✓ Health check: {data}")


# ─── Auth ─────────────────────────────────────────────────────────────────────

class TestAuth:
    def test_register_crew(self, session):
        email = f"TEST_crew_new_{int(time.time()*1000)}@example.com"
        resp = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "TestPass@123",
            "name": "TEST New Crew",
            "role": "crew",
            "trade": "Plumber"
        })
        assert resp.status_code == 201
        data = resp.json()
        assert "access_token" in data
        assert data["user"]["role"] == "crew"
        print(f"✓ Crew registered: {data['user']['email']}")

    def test_register_contractor(self, session):
        email = f"TEST_contractor_new_{int(time.time()*1000)}@example.com"
        resp = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "TestPass@123",
            "name": "TEST New Contractor",
            "role": "contractor",
            "company_name": "TEST New Corp"
        })
        assert resp.status_code == 201
        data = resp.json()
        assert "access_token" in data
        assert data["user"]["role"] == "contractor"
        print(f"✓ Contractor registered: {data['user']['email']}")

    def test_register_duplicate_email(self, session, crew_token):
        resp = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": CREW_EMAIL,
            "password": "TestPass@123",
            "name": "Dup",
            "role": "crew"
        })
        assert resp.status_code == 400
        print(f"✓ Duplicate email rejected")

    def test_login_success(self, session):
        resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["user"]["role"] == "admin"
        print(f"✓ Admin login: {data['user']['email']}")

    def test_login_invalid_credentials(self, session):
        resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "notexist@example.com", "password": "wrong"
        })
        assert resp.status_code == 401
        print(f"✓ Invalid credentials rejected")


# ─── Jobs ─────────────────────────────────────────────────────────────────────

class TestJobs:
    def test_create_job_as_contractor(self, session, contractor_token, job_id):
        # job_id fixture already created it; just verify it's a string
        assert isinstance(job_id, str)
        print(f"✓ Job created: {job_id}")

    def test_create_job_forbidden_for_crew(self, session, crew_token):
        resp = session.post(
            f"{BASE_URL}/api/jobs/",
            json={
                "title": "Should fail",
                "description": "desc",
                "trade": "Electrician",
                "crew_needed": 1,
                "start_time": "2026-03-01T08:00:00Z",
                "pay_rate": 20.0,
                "address": "Miami, FL",
                "is_emergency": False
            },
            headers={"Authorization": f"Bearer {crew_token}"}
        )
        assert resp.status_code == 403
        print(f"✓ Crew cannot create jobs")

    def test_list_jobs(self, session, crew_token):
        resp = session.get(
            f"{BASE_URL}/api/jobs/",
            headers={"Authorization": f"Bearer {crew_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        print(f"✓ Jobs list: {len(data)} jobs")

    def test_get_job_by_id(self, session, crew_token, job_id):
        resp = session.get(
            f"{BASE_URL}/api/jobs/{job_id}",
            headers={"Authorization": f"Bearer {crew_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == job_id
        print(f"✓ Get job by id: {data['title']}")

    def test_accept_job_as_crew(self, session, crew_token, job_id):
        resp = session.post(
            f"{BASE_URL}/api/jobs/{job_id}/accept",
            headers={"Authorization": f"Bearer {crew_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "status" in data
        print(f"✓ Job accepted: {data}")

    def test_cannot_accept_twice(self, session, crew_token, job_id):
        resp = session.post(
            f"{BASE_URL}/api/jobs/{job_id}/accept",
            headers={"Authorization": f"Bearer {crew_token}"}
        )
        assert resp.status_code == 400
        print(f"✓ Cannot accept job twice")

    def test_list_jobs_no_auth(self, session):
        resp = session.get(f"{BASE_URL}/api/jobs/")
        assert resp.status_code == 401
        print(f"✓ Auth required for job list")


# ─── Admin ────────────────────────────────────────────────────────────────────

class TestAdmin:
    def test_get_analytics(self, session, admin_token):
        resp = session.get(
            f"{BASE_URL}/api/admin/analytics",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "total_users" in data
        assert "active_jobs" in data
        print(f"✓ Analytics: {data['total_users']} users, {data['active_jobs']} active jobs")

    def test_analytics_forbidden_for_crew(self, session, crew_token):
        resp = session.get(
            f"{BASE_URL}/api/admin/analytics",
            headers={"Authorization": f"Bearer {crew_token}"}
        )
        assert resp.status_code == 403
        print(f"✓ Crew cannot access admin analytics")

    def test_list_users(self, session, admin_token):
        resp = session.get(
            f"{BASE_URL}/api/admin/users",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "users" in data
        print(f"✓ Admin user list: {data['total']} users")


# ─── Payments ─────────────────────────────────────────────────────────────────

class TestPayments:
    def test_get_plans(self, session):
        resp = session.get(f"{BASE_URL}/api/payments/plans")
        assert resp.status_code == 200
        data = resp.json()
        assert "daily" in data
        assert "weekly" in data
        assert "monthly" in data
        print(f"✓ Plans: daily={data['daily']['amount']}, weekly={data['weekly']['amount']}, monthly={data['monthly']['amount']}")

    def test_subscription_status(self, session, crew_token):
        resp = session.get(
            f"{BASE_URL}/api/payments/subscription/status",
            headers={"Authorization": f"Bearer {crew_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "status" in data
        print(f"✓ Subscription status: {data['status']}")
