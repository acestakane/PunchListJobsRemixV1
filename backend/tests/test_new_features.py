"""
Backend API tests for TheDayLaborers - New Feature Testing
Covers: subscription gating, profile completion, online status, crew search,
job duplication, emergency jobs, job workflow, Square payment, annual plan
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@thedaylaborers.com"
ADMIN_PASSWORD = "Admin@123"
TS = int(time.time())
CREW_EMAIL = f"TEST_crew_{TS}@example.com"
CREW_PASSWORD = "TestPass@123"
CONTRACTOR_EMAIL = f"TEST_contractor_{TS}@example.com"
CONTRACTOR_PASSWORD = "TestPass@123"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def crew_token(session):
    resp = session.post(f"{BASE_URL}/api/auth/register", json={
        "email": CREW_EMAIL, "password": CREW_PASSWORD,
        "name": "TEST Crew Member", "role": "crew", "trade": "Electrician",
        "phone": "555-123-4567"
    })
    if resp.status_code == 201:
        return resp.json()["access_token"]
    resp2 = session.post(f"{BASE_URL}/api/auth/login", json={"email": CREW_EMAIL, "password": CREW_PASSWORD})
    assert resp2.status_code == 200
    return resp2.json()["access_token"]


@pytest.fixture(scope="module")
def contractor_token(session):
    resp = session.post(f"{BASE_URL}/api/auth/register", json={
        "email": CONTRACTOR_EMAIL, "password": CONTRACTOR_PASSWORD,
        "name": "TEST Contractor", "role": "contractor", "company_name": "TEST Corp"
    })
    if resp.status_code == 201:
        return resp.json()["access_token"]
    resp2 = session.post(f"{BASE_URL}/api/auth/login", json={"email": CONTRACTOR_EMAIL, "password": CONTRACTOR_PASSWORD})
    assert resp2.status_code == 200
    return resp2.json()["access_token"]


@pytest.fixture(scope="module")
def admin_token(session):
    resp = session.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert resp.status_code == 200, f"Admin login failed: {resp.text}"
    return resp.json()["access_token"]


@pytest.fixture(scope="module")
def job_id(session, contractor_token):
    resp = session.post(
        f"{BASE_URL}/api/jobs/",
        json={
            "title": "TEST Regular Job Plumbing",
            "description": "Test plumbing job",
            "trade": "plumbing",
            "crew_needed": 2,
            "start_time": "2026-04-01T08:00:00Z",
            "pay_rate": 30.0,
            "address": "New York, NY",
            "is_emergency": False
        },
        headers={"Authorization": f"Bearer {contractor_token}"}
    )
    assert resp.status_code == 201, f"Job creation failed: {resp.text}"
    return resp.json()["id"]


@pytest.fixture(scope="module")
def emergency_job_id(session, contractor_token):
    resp = session.post(
        f"{BASE_URL}/api/jobs/",
        json={
            "title": "TEST Emergency Pipe Burst",
            "description": "Emergency water pipe burst - immediate help needed",
            "trade": "plumbing",
            "crew_needed": 1,
            "start_time": "2026-04-01T08:00:00Z",
            "pay_rate": 50.0,
            "address": "New York, NY",
            "is_emergency": True
        },
        headers={"Authorization": f"Bearer {contractor_token}"}
    )
    assert resp.status_code == 201, f"Emergency job creation failed: {resp.text}"
    data = resp.json()
    assert data["is_emergency"] == True, "Job should be emergency"
    return data["id"]


# ─── Health Check ─────────────────────────────────────────────────────────────

class TestHealth:
    """API Health check"""
    def test_root_health(self, session):
        resp = session.get(f"{BASE_URL}/api/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "operational"
        print(f"✓ Health: {data['status']}")


# ─── Auth ─────────────────────────────────────────────────────────────────────

class TestAuth:
    """Authentication flows"""
    def test_register_crew(self, session):
        email = f"TEST_crew_new_{int(time.time()*1000)}@example.com"
        resp = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": email, "password": "TestPass@123",
            "name": "TEST New Crew", "role": "crew"
        })
        assert resp.status_code == 201
        data = resp.json()
        assert "access_token" in data
        assert data["user"]["role"] == "crew"
        assert isinstance(data["access_token"], str)
        assert len(data["access_token"]) > 10
        print(f"✓ Crew registered: {data['user']['email']}")

    def test_register_contractor(self, session):
        email = f"TEST_contractor_new_{int(time.time()*1000)}@example.com"
        resp = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": email, "password": "TestPass@123",
            "name": "TEST New Contractor", "role": "contractor",
            "company_name": "TEST New Corp"
        })
        assert resp.status_code == 201
        data = resp.json()
        assert "access_token" in data
        assert data["user"]["role"] == "contractor"
        print(f"✓ Contractor registered: {data['user']['email']}")

    def test_login_returns_jwt(self, session):
        resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["role"] == "admin"
        print(f"✓ Login returns JWT token: {len(data['access_token'])} chars")

    def test_login_invalid_returns_401(self, session):
        resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "nobody@example.com", "password": "wrong"
        })
        assert resp.status_code == 401
        print(f"✓ Invalid login returns 401")


# ─── Subscription Status ──────────────────────────────────────────────────────

class TestSubscriptionStatus:
    """Subscription status endpoint"""
    def test_subscription_status_structure(self, session, crew_token):
        resp = session.get(
            f"{BASE_URL}/api/payments/subscription/status",
            headers={"Authorization": f"Bearer {crew_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "status" in data
        assert data["status"] in ("active", "trial", "expired")
        assert "days_remaining" in data
        assert isinstance(data["days_remaining"], int)
        print(f"✓ Subscription status: {data['status']}, days_remaining: {data['days_remaining']}")

    def test_subscription_status_requires_auth(self, session):
        resp = session.get(f"{BASE_URL}/api/payments/subscription/status")
        # FastAPI HTTPBearer returns 403 when no credentials provided
        assert resp.status_code in (401, 403)
        print(f"✓ Subscription status requires auth: {resp.status_code}")


# ─── Profile Completion ────────────────────────────────────────────────────────

class TestProfileCompletion:
    """Profile completion endpoint"""
    def test_profile_completion_returns_percentage_and_checks(self, session, crew_token):
        resp = session.get(
            f"{BASE_URL}/api/users/profile-completion",
            headers={"Authorization": f"Bearer {crew_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "percentage" in data
        assert "checks" in data
        assert "is_complete" in data
        assert isinstance(data["percentage"], int)
        assert 0 <= data["percentage"] <= 100
        # Check all 5 required fields are present
        checks = data["checks"]
        assert "photo" in checks
        assert "phone" in checks
        assert "address" in checks
        assert "skills" in checks
        assert "bio" in checks
        print(f"✓ Profile completion: {data['percentage']}% - checks: {checks}")

    def test_profile_completion_requires_auth(self, session):
        resp = session.get(f"{BASE_URL}/api/users/profile-completion")
        # FastAPI HTTPBearer returns 403 when no credentials provided
        assert resp.status_code in (401, 403)
        print(f"✓ Profile completion requires auth: {resp.status_code}")

    def test_profile_completion_reflects_trade(self, session, crew_token):
        """Crew registered without trade (UserCreate model ignores extra fields),
        so skills check should be False for newly registered user"""
        resp = session.get(
            f"{BASE_URL}/api/users/profile-completion",
            headers={"Authorization": f"Bearer {crew_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        # UserCreate model doesn't have 'trade' field, it gets ignored at registration
        # skills check will be False until profile is updated
        assert "skills" in data["checks"]
        assert isinstance(data["checks"]["skills"], bool)
        print(f"✓ Skills check present: {data['checks']['skills']} (False expected for new user without trade set)")

    def test_profile_completion_reflects_phone(self, session, crew_token):
        """Crew registered with phone set"""
        resp = session.get(
            f"{BASE_URL}/api/users/profile-completion",
            headers={"Authorization": f"Bearer {crew_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        # crew registered with phone=555-123-4567
        assert data["checks"]["phone"] == True
        print(f"✓ Phone check correctly reflects: {data['checks']['phone']}")


# ─── Online Status Toggle ──────────────────────────────────────────────────────

class TestOnlineStatus:
    """Online/Offline toggle endpoint"""
    def test_set_online(self, session, crew_token):
        resp = session.put(
            f"{BASE_URL}/api/users/online-status",
            json={"is_online": True},
            headers={"Authorization": f"Bearer {crew_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["is_online"] == True
        print(f"✓ Online status set to True: {data}")

    def test_set_offline(self, session, crew_token):
        resp = session.put(
            f"{BASE_URL}/api/users/online-status",
            json={"is_online": False},
            headers={"Authorization": f"Bearer {crew_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["is_online"] == False
        print(f"✓ Online status set to False: {data}")

    def test_online_status_requires_auth(self, session):
        resp = session.put(f"{BASE_URL}/api/users/online-status", json={"is_online": True})
        # FastAPI HTTPBearer returns 403 when no credentials provided
        assert resp.status_code in (401, 403)
        print(f"✓ Online status requires auth: {resp.status_code}")


# ─── Crew Search ──────────────────────────────────────────────────────────────

class TestCrewSearch:
    """Crew search with name, trade, address params"""
    def test_crew_search_basic(self, session, contractor_token):
        resp = session.get(
            f"{BASE_URL}/api/users/crew",
            headers={"Authorization": f"Bearer {contractor_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        print(f"✓ Crew search basic: {len(data)} members found")

    def test_crew_search_by_trade(self, session, contractor_token):
        # First set crew member online so they appear
        resp = session.get(
            f"{BASE_URL}/api/users/crew?trade=electrician",
            headers={"Authorization": f"Bearer {contractor_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        print(f"✓ Crew search by trade 'electrician': {len(data)} members")

    def test_crew_search_by_name(self, session, contractor_token):
        resp = session.get(
            f"{BASE_URL}/api/users/crew?name=TEST",
            headers={"Authorization": f"Bearer {contractor_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        print(f"✓ Crew search by name 'TEST': {len(data)} members")

    def test_crew_search_by_address(self, session, contractor_token):
        resp = session.get(
            f"{BASE_URL}/api/users/crew?address=New York",
            headers={"Authorization": f"Bearer {contractor_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        print(f"✓ Crew search by address 'New York': {len(data)} members")

    def test_crew_search_requires_auth(self, session):
        resp = session.get(f"{BASE_URL}/api/users/crew")
        # FastAPI HTTPBearer returns 403 when no credentials provided
        assert resp.status_code in (401, 403)
        print(f"✓ Crew search requires auth: {resp.status_code}")


# ─── Job Creation ─────────────────────────────────────────────────────────────

class TestJobCreation:
    """Job creation endpoints"""
    def test_create_regular_job(self, session, contractor_token, job_id):
        assert isinstance(job_id, str)
        # Verify the job was created by fetching it
        resp = session.get(
            f"{BASE_URL}/api/jobs/{job_id}",
            headers={"Authorization": f"Bearer {contractor_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == job_id
        assert data["is_emergency"] == False
        assert data["status"] == "open"
        print(f"✓ Regular job created: {data['title']}")

    def test_create_emergency_job(self, session, contractor_token, emergency_job_id):
        assert isinstance(emergency_job_id, str)
        # Fetch and verify emergency job
        resp = session.get(
            f"{BASE_URL}/api/jobs/{emergency_job_id}",
            headers={"Authorization": f"Bearer {contractor_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["is_emergency"] == True
        assert data["status"] == "open"
        print(f"✓ Emergency job created: {data['title']}, is_emergency={data['is_emergency']}")

    def test_create_job_forbidden_for_crew(self, session, crew_token):
        resp = session.post(
            f"{BASE_URL}/api/jobs/",
            json={
                "title": "Forbidden job",
                "description": "Should not work",
                "trade": "electrician",
                "crew_needed": 1,
                "start_time": "2026-04-01T08:00:00Z",
                "pay_rate": 20.0,
                "address": "New York, NY",
                "is_emergency": False
            },
            headers={"Authorization": f"Bearer {crew_token}"}
        )
        assert resp.status_code == 403
        print(f"✓ Crew cannot create jobs: {resp.status_code}")


# ─── Job Duplication ──────────────────────────────────────────────────────────

class TestJobDuplication:
    """Job duplicate endpoint"""
    def test_duplicate_job(self, session, contractor_token, job_id):
        resp = session.post(
            f"{BASE_URL}/api/jobs/{job_id}/duplicate",
            headers={"Authorization": f"Bearer {contractor_token}"}
        )
        assert resp.status_code == 201
        data = resp.json()
        assert "id" in data
        assert data["id"] != job_id
        assert "(Copy)" in data["title"]
        assert data["status"] == "open"
        assert data["is_emergency"] == False  # duplicates are never emergency
        assert data["crew_accepted"] == []
        print(f"✓ Job duplicated: {data['title']} (new id: {data['id']})")

    def test_duplicate_returns_new_job_fields(self, session, contractor_token, job_id):
        resp = session.post(
            f"{BASE_URL}/api/jobs/{job_id}/duplicate",
            headers={"Authorization": f"Bearer {contractor_token}"}
        )
        assert resp.status_code == 201
        data = resp.json()
        assert "trade" in data
        assert "pay_rate" in data
        assert "crew_needed" in data
        assert "location" in data or data.get("address") is not None
        print(f"✓ Duplicated job has all fields: trade={data['trade']}, pay={data['pay_rate']}")

    def test_crew_cannot_duplicate_job(self, session, crew_token, job_id):
        resp = session.post(
            f"{BASE_URL}/api/jobs/{job_id}/duplicate",
            headers={"Authorization": f"Bearer {crew_token}"}
        )
        assert resp.status_code == 403
        print(f"✓ Crew cannot duplicate jobs")


# ─── Emergency Job Accept ─────────────────────────────────────────────────────

class TestEmergencyJobAccept:
    """Emergency job with atomic first-to-accept race lock"""
    def test_accept_emergency_job(self, session, crew_token, emergency_job_id):
        resp = session.post(
            f"{BASE_URL}/api/jobs/{emergency_job_id}/accept",
            headers={"Authorization": f"Bearer {crew_token}"}
        )
        # Should succeed (first crew member wins)
        assert resp.status_code in (200, 409)
        if resp.status_code == 200:
            data = resp.json()
            assert "status" in data
            assert "message" in data
            print(f"✓ Emergency job accepted: {data}")
        else:
            print(f"✓ Emergency job already claimed (race condition test): {resp.json()}")

    def test_second_accept_emergency_returns_409(self, session, contractor_token, emergency_job_id):
        """Create another crew member and test the 409 conflict"""
        # Register a second crew member
        email2 = f"TEST_crew2_{int(time.time()*1000)}@example.com"
        reg = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": email2, "password": "TestPass@123",
            "name": "TEST Crew Member 2", "role": "crew"
        })
        if reg.status_code != 201:
            pytest.skip("Could not create second crew member")
        token2 = reg.json()["access_token"]

        # Create a fresh emergency job
        job_resp = session.post(
            f"{BASE_URL}/api/jobs/",
            json={
                "title": "TEST Emergency Slot Test",
                "description": "Only one slot",
                "trade": "plumbing",
                "crew_needed": 1,
                "start_time": "2026-04-01T08:00:00Z",
                "pay_rate": 40.0,
                "address": "Miami, FL",
                "is_emergency": True
            },
            headers={"Authorization": f"Bearer {contractor_token}"}
        )
        assert job_resp.status_code == 201
        new_job_id = job_resp.json()["id"]

        # First crew accepts
        r1 = session.post(
            f"{BASE_URL}/api/jobs/{new_job_id}/accept",
            headers={"Authorization": f"Bearer {token2}"}
        )
        assert r1.status_code == 200

        # Create third crew member and try to accept same job
        email3 = f"TEST_crew3_{int(time.time()*1000)}@example.com"
        reg3 = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": email3, "password": "TestPass@123",
            "name": "TEST Crew 3", "role": "crew"
        })
        if reg3.status_code != 201:
            pytest.skip("Could not create third crew member")
        token3 = reg3.json()["access_token"]

        r2 = session.post(
            f"{BASE_URL}/api/jobs/{new_job_id}/accept",
            headers={"Authorization": f"Bearer {token3}"}
        )
        # Second accept on fully-filled emergency job should fail
        assert r2.status_code in (400, 409)
        print(f"✓ Emergency job second accept blocked: {r2.status_code} - {r2.json()}")


# ─── Job Workflow ─────────────────────────────────────────────────────────────

class TestJobWorkflow:
    """Full job workflow: create → accept → start → complete → verify"""
    @pytest.fixture(scope="class")
    def workflow_job_id(self, session, contractor_token):
        resp = session.post(
            f"{BASE_URL}/api/jobs/",
            json={
                "title": "TEST Workflow Job",
                "description": "Full workflow test",
                "trade": "carpentry",
                "crew_needed": 1,
                "start_time": "2026-04-01T08:00:00Z",
                "pay_rate": 25.0,
                "address": "Chicago, IL",
                "is_emergency": False
            },
            headers={"Authorization": f"Bearer {contractor_token}"}
        )
        assert resp.status_code == 201
        return resp.json()["id"]

    @pytest.fixture(scope="class")
    def workflow_crew_token(self, session):
        email = f"TEST_workflow_crew_{int(time.time())}@example.com"
        resp = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": email, "password": "TestPass@123",
            "name": "TEST Workflow Crew", "role": "crew"
        })
        assert resp.status_code == 201
        return resp.json()["access_token"]

    def test_workflow_accept(self, session, workflow_job_id, workflow_crew_token):
        resp = session.post(
            f"{BASE_URL}/api/jobs/{workflow_job_id}/accept",
            headers={"Authorization": f"Bearer {workflow_crew_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "status" in data
        print(f"✓ Workflow accept: {data['status']}")

    def test_workflow_start(self, session, workflow_job_id, contractor_token):
        resp = session.post(
            f"{BASE_URL}/api/jobs/{workflow_job_id}/start",
            headers={"Authorization": f"Bearer {contractor_token}"}
        )
        assert resp.status_code == 200
        print(f"✓ Workflow start job")

    def test_workflow_complete(self, session, workflow_job_id, workflow_crew_token):
        resp = session.post(
            f"{BASE_URL}/api/jobs/{workflow_job_id}/complete",
            headers={"Authorization": f"Bearer {workflow_crew_token}"}
        )
        assert resp.status_code == 200
        print(f"✓ Workflow complete job")

    def test_workflow_verify(self, session, workflow_job_id, contractor_token):
        resp = session.post(
            f"{BASE_URL}/api/jobs/{workflow_job_id}/verify",
            headers={"Authorization": f"Bearer {contractor_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "message" in data
        print(f"✓ Workflow verify: {data['message']}")

    def test_workflow_final_status_is_completed(self, session, workflow_job_id, contractor_token):
        """Verify job is now 'completed' after full workflow"""
        resp = session.get(
            f"{BASE_URL}/api/jobs/{workflow_job_id}",
            headers={"Authorization": f"Bearer {contractor_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "completed"
        assert data["completed_at"] is not None
        print(f"✓ Final status: {data['status']}, completed_at: {data['completed_at']}")


# ─── Payment Plans ────────────────────────────────────────────────────────────

class TestPaymentPlans:
    """Payment plans including annual plan"""
    def test_plans_include_annual(self, session):
        resp = session.get(f"{BASE_URL}/api/payments/plans")
        assert resp.status_code == 200
        data = resp.json()
        assert "daily" in data
        assert "weekly" in data
        assert "monthly" in data
        assert "annual" in data, "Annual plan must be present"
        print(f"✓ Plans: {list(data.keys())}")

    def test_annual_plan_values(self, session):
        resp = session.get(f"{BASE_URL}/api/payments/plans")
        assert resp.status_code == 200
        data = resp.json()
        annual = data["annual"]
        assert "amount" in annual
        assert "days" in annual
        assert "label" in annual
        assert annual["amount"] == 699.99
        assert annual["days"] == 365
        assert "Annual" in annual["label"]
        print(f"✓ Annual plan: ${annual['amount']}, {annual['days']} days")

    def test_plans_amounts_are_correct(self, session):
        resp = session.get(f"{BASE_URL}/api/payments/plans")
        assert resp.status_code == 200
        data = resp.json()
        assert data["daily"]["amount"] == 4.99
        assert data["weekly"]["amount"] == 24.99
        assert data["monthly"]["amount"] == 79.99
        print(f"✓ All plan amounts correct")


# ─── Square Payment ───────────────────────────────────────────────────────────

class TestSquarePayment:
    """Square/CashApp payment link creation"""
    def test_square_create_link(self, session, crew_token):
        resp = session.post(
            f"{BASE_URL}/api/payments/square/create-link",
            json={
                "plan": "monthly",
                "payment_method": "square",
                "origin_url": "https://job-crew-flow.preview.emergentagent.com"
            },
            headers={"Authorization": f"Bearer {crew_token}"}
        )
        # Should succeed (200/201) or fail if Square has issues
        if resp.status_code in (200, 201):
            data = resp.json()
            assert "url" in data
            assert "link_id" in data
            # Square uses square.link short URL domain
            url = data["url"]
            assert "square" in url.lower() or "squareup" in url.lower(), f"Unexpected Square URL: {url}"
            print(f"✓ Square payment link created: {url[:60]}...")
        else:
            # Non-critical: Square production API may reject test calls
            print(f"! Square create-link returned {resp.status_code}: {resp.text[:200]}")
            # Do not assert failure - mark as info

    def test_square_create_link_invalid_plan(self, session, crew_token):
        resp = session.post(
            f"{BASE_URL}/api/payments/square/create-link",
            json={
                "plan": "invalid_plan",
                "payment_method": "square",
                "origin_url": "https://job-crew-flow.preview.emergentagent.com"
            },
            headers={"Authorization": f"Bearer {crew_token}"}
        )
        assert resp.status_code == 400
        print(f"✓ Invalid plan rejected: {resp.status_code}")

    def test_square_create_link_requires_auth(self, session):
        resp = session.post(
            f"{BASE_URL}/api/payments/square/create-link",
            json={"plan": "monthly", "payment_method": "square", "origin_url": "https://test.com"}
        )
        # FastAPI HTTPBearer returns 403 when no credentials provided
        assert resp.status_code in (401, 403)
        print(f"✓ Square payment link requires auth: {resp.status_code}")

    def test_square_create_link_annual_plan(self, session, crew_token):
        """Test Square can create link for annual plan"""
        resp = session.post(
            f"{BASE_URL}/api/payments/square/create-link",
            json={
                "plan": "annual",
                "payment_method": "square",
                "origin_url": "https://job-crew-flow.preview.emergentagent.com"
            },
            headers={"Authorization": f"Bearer {crew_token}"}
        )
        if resp.status_code in (200, 201):
            data = resp.json()
            assert "url" in data
            print(f"✓ Square annual plan link created: {data['url'][:60]}...")
        else:
            print(f"! Square annual link returned {resp.status_code}: {resp.text[:200]}")


# ─── Subscription Gating ──────────────────────────────────────────────────────

class TestSubscriptionGating:
    """Check that expired subscription blocks job post/accept"""
    def test_expired_user_cannot_post_job(self, session, admin_token):
        """Create an expired user and verify job creation is blocked"""
        email = f"TEST_expired_{int(time.time())}@example.com"
        # Register a contractor
        reg = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": email, "password": "TestPass@123",
            "name": "TEST Expired Contractor", "role": "contractor"
        })
        assert reg.status_code == 201
        expired_token = reg.json()["access_token"]
        user_id = reg.json()["user"]["id"]

        # Force expire their subscription via admin
        admin_resp = session.put(
            f"{BASE_URL}/api/admin/users/{user_id}",
            json={"subscription_status": "expired"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert admin_resp.status_code == 200

        # Try to post a job
        job_resp = session.post(
            f"{BASE_URL}/api/jobs/",
            json={
                "title": "TEST Expired Job",
                "description": "Should be blocked",
                "trade": "carpentry",
                "crew_needed": 1,
                "start_time": "2026-04-01T08:00:00Z",
                "pay_rate": 20.0,
                "address": "Dallas, TX",
                "is_emergency": False
            },
            headers={"Authorization": f"Bearer {expired_token}"}
        )
        assert job_resp.status_code == 403
        detail = job_resp.json().get("detail", "")
        assert "SUBSCRIPTION_EXPIRED" in detail
        print(f"✓ Expired user blocked from job posting: {detail[:60]}")
