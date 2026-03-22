import importlib
import os
import sys
import uuid
from pathlib import Path

import pytest
from dotenv import load_dotenv
from fastapi.testclient import TestClient
from pymongo import MongoClient


BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


@pytest.fixture(scope="session")
def app_module():
    """Import app after setting test-safe environment values."""
    # Load .env file from backend directory
    env_file = BACKEND_DIR / ".env"
    if env_file.exists():
        load_dotenv(env_file)
    
    mongo_url = os.getenv("TEST_MONGO_URL") or os.getenv("MONGO_URL")
    if not mongo_url:
        pytest.skip("Set TEST_MONGO_URL (or MONGO_URL) to run API tests")

    os.environ["MONGO_URL"] = mongo_url
    os.environ["DB_NAME"] = f"fxpro_test_{uuid.uuid4().hex[:8]}"
    os.environ.setdefault("APP_ENV", "development")
    os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-with-32-plus-length")
    os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "60")
    os.environ.setdefault("AUTH_RATE_LIMIT_PER_MIN", "1000")
    os.environ.setdefault("CORS_ORIGINS", "http://localhost:3000")

    module = importlib.import_module("server")
    return module


@pytest.fixture(scope="session")
def client(app_module):
    with TestClient(app_module.app) as test_client:
        yield test_client


@pytest.fixture(scope="session")
def db(app_module):
    return app_module.db


@pytest.fixture(scope="session")
def sync_db(app_module):
    mongo_url = os.environ.get("MONGO_URL")
    sync_client = MongoClient(mongo_url)
    test_db = sync_client[app_module.db.name]
    yield test_db
    sync_client.close()


@pytest.fixture(autouse=True)
def clean_db(sync_db):
    collections = [
        "users",
        "documents",
        "bank_accounts",
        "wallet_transactions",
        "deposits",
        "withdrawals",
        "trades",
        "payment_settings",
    ]
    for name in collections:
        sync_db[name].delete_many({})
    yield


@pytest.fixture(scope="session", autouse=True)
def drop_test_database(app_module):
    yield
    mongo_url = os.environ.get("MONGO_URL")
    if mongo_url:
        sync_client = MongoClient(mongo_url)
        sync_client.drop_database(app_module.db.name)
        sync_client.close()


@pytest.fixture
def admin_token(client, sync_db):
    from auth import get_password_hash

    admin_doc = {
        "name": "Admin",
        "email": "admin@test.com",
        "password": get_password_hash("AdminPass123!"),
        "role": "admin",
        "walletBalance": 0.0,
        "kycStatus": "approved",
        "isBlocked": False,
    }
    sync_db.users.insert_one(admin_doc)

    res = client.post(
        "/api/auth/login",
        json={"email": "admin@test.com", "password": "AdminPass123!"},
    )
    assert res.status_code == 200, res.text
    return res.json()["token"]


@pytest.fixture
def user_auth(client):
    def _create_user(email: str = "user@test.com", password: str = "UserPass123!"):
        reg = client.post(
            "/api/auth/register",
            json={"name": "User", "email": email, "password": password},
        )
        assert reg.status_code == 200, reg.text
        token = reg.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        return token, headers

    return _create_user
