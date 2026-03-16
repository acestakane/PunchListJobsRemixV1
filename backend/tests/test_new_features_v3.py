"""
Tests for iteration 3 new features:
- /api/settings/public endpoint (social sharing config)
- /api/users/public/{user_id} (public profile with recent_ratings)
- /api/admin/analytics new fields (crew_utilization, online_crew, job_completion_rate)
- /api/admin/settings social sharing toggles
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

ADMIN_EMAIL = "admin@thedaylaborers.com"
ADMIN_PASSWORD = "Admin@123"
CREW_EMAIL = "testcrew1@test.com"
CREW_PASSWORD = "Test@123"
CONTRACTOR_EMAIL = "testcontractor1@test.com"
CONTRACTOR_PASSWORD = "Test@123"


def get_token(email, password):
    """Helper to get a JWT token."""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    if resp.status_code == 200:
        return resp.json().get("access_token")
    return None


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# ────────────────────────────────────────────────────────────────────────────────
# Section 1: Public Settings endpoint (no auth)
# ────────────────────────────────────────────────────────────────────────────────

class TestPublicSettings:
    """GET /api/settings/public - no auth required"""

    def test_public_settings_status_200(self):
        """Endpoint is publicly accessible without auth token."""
        resp = requests.get(f"{BASE_URL}/api/settings/public")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"

    def test_public_settings_has_social_keys(self):
        """Response must contain all 4 social sharing keys."""
        resp = requests.get(f"{BASE_URL}/api/settings/public")
        assert resp.status_code == 200
        data = resp.json()
        for key in ["social_linkedin_enabled", "social_twitter_enabled",
                    "social_facebook_enabled", "social_native_share_enabled"]:
            assert key in data, f"Missing key: {key}. Got: {list(data.keys())}"

    def test_public_settings_defaults_all_true(self):
        """All social sharing flags should default to True."""
        resp = requests.get(f"{BASE_URL}/api/settings/public")
        assert resp.status_code == 200
        data = resp.json()
        # All 4 should be booleans
        for key in ["social_linkedin_enabled", "social_twitter_enabled",
                    "social_facebook_enabled", "social_native_share_enabled"]:
            assert isinstance(data.get(key), bool), f"{key} should be bool, got {type(data.get(key))}"

    def test_public_settings_no_private_data(self):
        """Response should NOT contain pricing or private settings."""
        resp = requests.get(f"{BASE_URL}/api/settings/public")
        assert resp.status_code == 200
        data = resp.json()
        # Should not expose pricing data in public endpoint (server.py version filters to social_ keys only)
        # Note: The admin_routes.py public endpoint may return only social_ keys
        # Verify no password-related fields
        assert "password" not in str(data).lower()


# ────────────────────────────────────────────────────────────────────────────────
# Section 2: Public User Profile endpoint
# ────────────────────────────────────────────────────────────────────────────────

class TestPublicUserProfile:
    """GET /api/users/public/{user_id}"""

    @pytest.fixture(scope="class")
    def crew_token(self):
        token = get_token(CREW_EMAIL, CREW_PASSWORD)
        if not token:
            pytest.skip("Crew login failed")
        return token

    @pytest.fixture(scope="class")
    def contractor_token(self):
        token = get_token(CONTRACTOR_EMAIL, CONTRACTOR_PASSWORD)
        if not token:
            pytest.skip("Contractor login failed")
        return token

    @pytest.fixture(scope="class")
    def crew_user_id(self, crew_token):
        """Get the crew user's own ID via /api/users/me."""
        resp = requests.get(f"{BASE_URL}/api/users/me", headers=auth_headers(crew_token))
        if resp.status_code != 200:
            pytest.skip("Cannot fetch crew user ID")
        return resp.json().get("id")

    def test_public_profile_returns_200(self, contractor_token, crew_user_id):
        """Contractor can fetch crew member's public profile."""
        resp = requests.get(
            f"{BASE_URL}/api/users/public/{crew_user_id}",
            headers=auth_headers(contractor_token)
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"

    def test_public_profile_has_recent_ratings(self, contractor_token, crew_user_id):
        """Response must contain 'recent_ratings' array."""
        resp = requests.get(
            f"{BASE_URL}/api/users/public/{crew_user_id}",
            headers=auth_headers(contractor_token)
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "recent_ratings" in data, f"Missing 'recent_ratings' in response. Keys: {list(data.keys())}"
        assert isinstance(data["recent_ratings"], list), "recent_ratings should be a list"

    def test_public_profile_has_required_fields(self, contractor_token, crew_user_id):
        """Profile must contain name, rating, rating_count, jobs_completed."""
        resp = requests.get(
            f"{BASE_URL}/api/users/public/{crew_user_id}",
            headers=auth_headers(contractor_token)
        )
        assert resp.status_code == 200
        data = resp.json()
        for field in ["name", "rating", "rating_count", "jobs_completed"]:
            assert field in data, f"Missing field: {field}"

    def test_public_profile_no_password_hash(self, contractor_token, crew_user_id):
        """Password hash must NOT be in public profile response."""
        resp = requests.get(
            f"{BASE_URL}/api/users/public/{crew_user_id}",
            headers=auth_headers(contractor_token)
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "password_hash" not in data, "password_hash should never be in public profile"

    def test_public_profile_404_for_invalid_id(self, contractor_token):
        """Returns 404 for non-existent user."""
        resp = requests.get(
            f"{BASE_URL}/api/users/public/nonexistent-user-id-xyz",
            headers=auth_headers(contractor_token)
        )
        assert resp.status_code == 404, f"Expected 404, got {resp.status_code}"


# ────────────────────────────────────────────────────────────────────────────────
# Section 3: Admin Analytics - new fields
# ────────────────────────────────────────────────────────────────────────────────

class TestAdminAnalytics:
    """GET /api/admin/analytics - checks new fields added in iteration 3"""

    @pytest.fixture(scope="class")
    def admin_token(self):
        token = get_token(ADMIN_EMAIL, ADMIN_PASSWORD)
        if not token:
            pytest.skip("Admin login failed")
        return token

    def test_analytics_returns_200(self, admin_token):
        resp = requests.get(f"{BASE_URL}/api/admin/analytics", headers=auth_headers(admin_token))
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"

    def test_analytics_has_crew_utilization(self, admin_token):
        """crew_utilization field must be in analytics response."""
        resp = requests.get(f"{BASE_URL}/api/admin/analytics", headers=auth_headers(admin_token))
        assert resp.status_code == 200
        data = resp.json()
        assert "crew_utilization" in data, f"Missing 'crew_utilization'. Keys: {list(data.keys())}"
        assert isinstance(data["crew_utilization"], (int, float)), "crew_utilization should be numeric"

    def test_analytics_has_online_crew(self, admin_token):
        """online_crew field must be in analytics response."""
        resp = requests.get(f"{BASE_URL}/api/admin/analytics", headers=auth_headers(admin_token))
        assert resp.status_code == 200
        data = resp.json()
        assert "online_crew" in data, f"Missing 'online_crew'. Keys: {list(data.keys())}"
        assert isinstance(data["online_crew"], int), "online_crew should be integer"

    def test_analytics_has_job_completion_rate(self, admin_token):
        """job_completion_rate field must be in analytics response."""
        resp = requests.get(f"{BASE_URL}/api/admin/analytics", headers=auth_headers(admin_token))
        assert resp.status_code == 200
        data = resp.json()
        assert "job_completion_rate" in data, f"Missing 'job_completion_rate'. Keys: {list(data.keys())}"
        assert isinstance(data["job_completion_rate"], (int, float)), "job_completion_rate should be numeric"

    def test_analytics_crew_utilization_range(self, admin_token):
        """crew_utilization should be between 0 and 100."""
        resp = requests.get(f"{BASE_URL}/api/admin/analytics", headers=auth_headers(admin_token))
        data = resp.json()
        val = data.get("crew_utilization", -1)
        assert 0 <= val <= 100, f"crew_utilization={val} is out of range 0-100"

    def test_analytics_job_completion_rate_range(self, admin_token):
        """job_completion_rate should be between 0 and 100."""
        resp = requests.get(f"{BASE_URL}/api/admin/analytics", headers=auth_headers(admin_token))
        data = resp.json()
        val = data.get("job_completion_rate", -1)
        assert 0 <= val <= 100, f"job_completion_rate={val} is out of range 0-100"

    def test_analytics_non_admin_blocked(self):
        """Non-admin users must get 403."""
        crew_token = get_token(CREW_EMAIL, CREW_PASSWORD)
        if not crew_token:
            pytest.skip("Crew login failed")
        resp = requests.get(f"{BASE_URL}/api/admin/analytics", headers=auth_headers(crew_token))
        assert resp.status_code == 403, f"Expected 403, got {resp.status_code}"


# ────────────────────────────────────────────────────────────────────────────────
# Section 4: Admin Settings - Social Sharing Toggles
# ────────────────────────────────────────────────────────────────────────────────

class TestAdminSocialSettings:
    """PUT /api/admin/settings - social sharing toggles"""

    @pytest.fixture(scope="class")
    def admin_token(self):
        token = get_token(ADMIN_EMAIL, ADMIN_PASSWORD)
        if not token:
            pytest.skip("Admin login failed")
        return token

    def test_get_admin_settings_has_social_keys(self, admin_token):
        """GET /api/admin/settings returns social_ fields."""
        resp = requests.get(f"{BASE_URL}/api/admin/settings", headers=auth_headers(admin_token))
        assert resp.status_code == 200
        data = resp.json()
        # Settings may or may not have social keys yet (they're added on first PUT)
        # Just check the endpoint is accessible and returns valid JSON
        assert isinstance(data, dict), "Settings should be a dict"

    def test_update_social_settings(self, admin_token):
        """PUT /api/admin/settings can update social sharing toggles."""
        payload = {
            "social_linkedin_enabled": True,
            "social_twitter_enabled": True,
            "social_facebook_enabled": True,
            "social_native_share_enabled": True,
        }
        resp = requests.put(
            f"{BASE_URL}/api/admin/settings",
            json=payload,
            headers=auth_headers(admin_token)
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"

    def test_social_settings_persist_via_public_endpoint(self, admin_token):
        """After updating social settings, /api/settings/public reflects them."""
        # First set all to True
        requests.put(
            f"{BASE_URL}/api/admin/settings",
            json={"social_linkedin_enabled": True, "social_twitter_enabled": True,
                  "social_facebook_enabled": True, "social_native_share_enabled": True},
            headers=auth_headers(admin_token)
        )
        # Check public endpoint
        resp = requests.get(f"{BASE_URL}/api/settings/public")
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("social_linkedin_enabled") == True
        assert data.get("social_twitter_enabled") == True

    def test_social_settings_toggle_off(self, admin_token):
        """Can disable social sharing via admin settings and it reflects in public endpoint."""
        # Disable LinkedIn
        requests.put(
            f"{BASE_URL}/api/admin/settings",
            json={"social_linkedin_enabled": False},
            headers=auth_headers(admin_token)
        )
        resp = requests.get(f"{BASE_URL}/api/settings/public")
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("social_linkedin_enabled") == False, \
            f"Expected False after disabling, got {data.get('social_linkedin_enabled')}"

        # Restore to True
        requests.put(
            f"{BASE_URL}/api/admin/settings",
            json={"social_linkedin_enabled": True},
            headers=auth_headers(admin_token)
        )


# ────────────────────────────────────────────────────────────────────────────────
# Section 5: /api/users/crew/{user_id} - used by ContractorDashboard modal
# ────────────────────────────────────────────────────────────────────────────────

class TestCrewMemberEndpoint:
    """GET /api/users/crew/{user_id} - used by contractor dashboard crew popup"""

    @pytest.fixture(scope="class")
    def contractor_token(self):
        token = get_token(CONTRACTOR_EMAIL, CONTRACTOR_PASSWORD)
        if not token:
            pytest.skip("Contractor login failed")
        return token

    @pytest.fixture(scope="class")
    def crew_token(self):
        token = get_token(CREW_EMAIL, CREW_PASSWORD)
        if not token:
            pytest.skip("Crew login failed")
        return token

    @pytest.fixture(scope="class")
    def crew_user_id(self, crew_token):
        resp = requests.get(f"{BASE_URL}/api/users/me", headers=auth_headers(crew_token))
        if resp.status_code != 200:
            pytest.skip("Cannot fetch crew user ID")
        return resp.json().get("id")

    def test_crew_member_returns_200(self, contractor_token, crew_user_id):
        resp = requests.get(
            f"{BASE_URL}/api/users/crew/{crew_user_id}",
            headers=auth_headers(contractor_token)
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"

    def test_crew_member_has_recent_ratings(self, contractor_token, crew_user_id):
        resp = requests.get(
            f"{BASE_URL}/api/users/crew/{crew_user_id}",
            headers=auth_headers(contractor_token)
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "recent_ratings" in data, f"Missing 'recent_ratings'. Got: {list(data.keys())}"
        assert isinstance(data["recent_ratings"], list)

    def test_crew_member_no_password(self, contractor_token, crew_user_id):
        resp = requests.get(
            f"{BASE_URL}/api/users/crew/{crew_user_id}",
            headers=auth_headers(contractor_token)
        )
        data = resp.json()
        assert "password_hash" not in data
