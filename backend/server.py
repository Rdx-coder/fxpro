from fastapi import FastAPI, APIRouter, Depends, HTTPException, status, Request, Query
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
from bson import ObjectId
from datetime import datetime, timezone, timedelta
from contextlib import asynccontextmanager
import os
import logging
import asyncio
import time
import uuid
import httpx
from collections import defaultdict, deque
from typing import Optional
from pymongo import ReturnDocument

# Load .env FIRST before importing modules that depend on environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from models import *
from auth import (
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_user,
    validate_auth_config,
)
from binance_client import binance_client

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'fxpro_trading')]

def utc_now() -> datetime:
    return datetime.now(timezone.utc)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    validate_auth_config()
    await init_indexes()
    await init_admin()
    await init_payment_settings()
    logger.info("Application started")
    try:
        yield
    finally:
        await binance_client.close()
        client.close()
        logger.info("Application shutdown")


# Create the main app
app = FastAPI(lifespan=lifespan)
api_router = APIRouter(prefix="/api")

# Configure logging
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger(__name__)

SLOW_REQUEST_THRESHOLD_MS = int(os.getenv("SLOW_REQUEST_THRESHOLD_MS", "500"))
AUTH_RATE_LIMIT_LOGIN_PER_MIN = int(os.getenv("AUTH_RATE_LIMIT_LOGIN_PER_MIN", os.getenv("AUTH_RATE_LIMIT_PER_MIN", "20")))
AUTH_RATE_LIMIT_REGISTER_PER_MIN = int(os.getenv("AUTH_RATE_LIMIT_REGISTER_PER_MIN", os.getenv("AUTH_RATE_LIMIT_PER_MIN", "20")))
AUTH_RATE_LIMIT_FORGOT_PASSWORD_PER_MIN = int(os.getenv("AUTH_RATE_LIMIT_FORGOT_PASSWORD_PER_MIN", os.getenv("AUTH_RATE_LIMIT_PER_MIN", "10")))
AUTH_RATE_LIMIT_WINDOW_SEC = 60
_auth_rate_window = defaultdict(deque)
_auth_rate_lock = asyncio.Lock()
ENABLE_HSTS = os.getenv("ENABLE_HSTS", "true").lower() == "true"
ECONOMIC_CALENDAR_PROVIDER = os.getenv("ECONOMIC_CALENDAR_PROVIDER", "tradingeconomics").lower()
ECONOMIC_CALENDAR_TIMEOUT_SEC = int(os.getenv("ECONOMIC_CALENDAR_TIMEOUT_SEC", "12"))
TRADING_ECONOMICS_API_KEY = os.getenv("TRADING_ECONOMICS_API_KEY")
TRADING_ECONOMICS_API_SECRET = os.getenv("TRADING_ECONOMICS_API_SECRET")
DEFAULT_FOREX_CALENDAR_CURRENCIES = {"USD", "EUR", "GBP", "JPY", "CHF", "AUD", "CAD", "NZD"}
IMPACT_ORDER = {"low": 1, "medium": 2, "high": 3}


def parse_object_id(id_value: str, field_name: str = "id") -> ObjectId:
    try:
        return ObjectId(id_value)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid {field_name}") from exc


async def get_active_user(current_user: dict = Depends(get_current_user)):
    user_id = parse_object_id(current_user["id"], "userId")
    user = await db.users.find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=401, detail="User does not exist")
    if user.get("isBlocked", False):
        raise HTTPException(status_code=403, detail="Account is blocked")

    return {"id": str(user["_id"]), "role": user.get("role", "user")}


async def get_active_admin(current_user: dict = Depends(get_active_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def _get_auth_limit(path: str) -> int:
    if path == "/api/auth/login":
        return AUTH_RATE_LIMIT_LOGIN_PER_MIN
    if path == "/api/auth/register":
        return AUTH_RATE_LIMIT_REGISTER_PER_MIN
    return AUTH_RATE_LIMIT_FORGOT_PASSWORD_PER_MIN


def _get_client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for", "")
    if xff:
        return xff.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


@app.middleware("http")
async def auth_rate_limit_middleware(request: Request, call_next):
    path = request.url.path
    if request.method == "POST" and path in {"/api/auth/login", "/api/auth/register", "/api/auth/forgot-password"}:
        now = time.time()
        key = f"{_get_client_ip(request)}:{path}"
        limit = _get_auth_limit(path)
        async with _auth_rate_lock:
            window = _auth_rate_window[key]
            while window and now - window[0] > AUTH_RATE_LIMIT_WINDOW_SEC:
                window.popleft()
            if len(window) >= limit:
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Too many requests. Please try again later."},
                )
            window.append(now)

    return await call_next(request)


@app.middleware("http")
async def log_slow_requests(request, call_next):
    """Log only slow requests to keep runtime overhead and log volume low."""
    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        duration_ms = (time.perf_counter() - start) * 1000
        if duration_ms > SLOW_REQUEST_THRESHOLD_MS:
            logger.warning(
                "SLOW_REQUEST request_id=%s method=%s path=%s status=%s duration_ms=%.2f",
                getattr(request.state, "request_id", "n/a"),
                request.method,
                request.url.path,
                500,
                duration_ms,
            )
        raise

    duration_ms = (time.perf_counter() - start) * 1000
    if duration_ms > SLOW_REQUEST_THRESHOLD_MS:
        logger.warning(
            "SLOW_REQUEST request_id=%s method=%s path=%s status=%s duration_ms=%.2f",
            getattr(request.state, "request_id", "n/a"),
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
        )
    return response


@app.middleware("http")
async def request_context_and_security_headers(request: Request, call_next):
    request_id = request.headers.get("x-request-id", str(uuid.uuid4()))
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if ENABLE_HSTS:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# Helper functions
def serialize_doc(doc):
    """Convert MongoDB document to JSON-serializable format"""
    if doc is None:
        return None
    if isinstance(doc, list):
        return [serialize_doc(item) for item in doc]
    if not isinstance(doc, dict):
        return doc
    
    result = {}
    for key, value in doc.items():
        if key == '_id':
            result['id'] = str(value)
        elif isinstance(value, ObjectId):
            result[key] = str(value)
        elif isinstance(value, dict):
            result[key] = serialize_doc(value)
        elif isinstance(value, list):
            result[key] = [serialize_doc(item) if isinstance(item, dict) else item for item in value]
        else:
            result[key] = value
    return result

async def init_admin():
    """Initialize admin user if not exists"""
    admin_email = os.getenv("ADMIN_BOOTSTRAP_EMAIL", "admin@fxpro.com")
    admin_password = os.getenv("ADMIN_BOOTSTRAP_PASSWORD")

    if not admin_password:
        logger.warning("ADMIN_BOOTSTRAP_PASSWORD is not set; skipping admin bootstrap")
        return

    admin = await db.users.find_one({"email": admin_email})
    if not admin:
        admin_data = {
            "name": "Admin",
            "email": admin_email,
            "password": get_password_hash(admin_password),
            "role": "admin",
            "walletBalance": 0.0,
            "kycStatus": "approved",
            "isBlocked": False,
            "createdAt": utc_now(),
            "updatedAt": utc_now()
        }
        await db.users.insert_one(admin_data)
        logger.info(f"Admin user created: {admin_email}")

async def init_payment_settings():
    """Initialize payment settings if not exists"""
    settings = await db.payment_settings.find_one()
    if not settings:
        settings_data = {
            "upiId": None,
            "qrCodeBase64": None,
            "isActive": False,
            "updatedAt": utc_now()
        }
        await db.payment_settings.insert_one(settings_data)
        logger.info("Payment settings initialized")

async def init_indexes():
    """Create indexes for common filtered/sorted queries."""
    await db.users.create_index("email", unique=True)
    await db.users.create_index("role")

    await db.documents.create_index([("userId", 1), ("uploadedAt", -1)])
    await db.documents.create_index("status")

    await db.bank_accounts.create_index("userId")

    await db.wallet_transactions.create_index([("userId", 1), ("createdAt", -1)])
    await db.wallet_transactions.create_index([("userId", 1), ("type", 1), ("status", 1)])

    await db.deposits.create_index([("userId", 1), ("createdAt", -1)])
    await db.deposits.create_index("status")

    await db.withdrawals.create_index([("userId", 1), ("createdAt", -1)])
    await db.withdrawals.create_index("status")

    await db.trades.create_index([("userId", 1), ("status", 1), ("openTime", -1)])
    await db.trades.create_index([("userId", 1), ("status", 1), ("closeTime", -1)])
    await db.trades.create_index([("openTime", -1)])

    logger.info("Database indexes initialized")


def _parse_event_datetime(value) -> Optional[datetime]:
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc) if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if not value:
        return None

    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(value, tz=timezone.utc)
        except Exception:
            return None

    if isinstance(value, str):
        candidate = value.strip()
        if not candidate:
            return None

        if candidate.endswith("Z"):
            candidate = candidate[:-1] + "+00:00"

        try:
            parsed = datetime.fromisoformat(candidate)
            return parsed.astimezone(timezone.utc) if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except Exception:
            pass

        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"):
            try:
                return datetime.strptime(candidate, fmt).replace(tzinfo=timezone.utc)
            except Exception:
                continue

    return None


def _normalize_impact(value) -> str:
    if isinstance(value, (int, float)):
        if value >= 3:
            return "high"
        if value >= 2:
            return "medium"
        return "low"

    text = str(value or "").strip().lower()
    if "high" in text or text == "3":
        return "high"
    if "medium" in text or text == "2" or "moderate" in text:
        return "medium"
    return "low"


async def _fetch_tradingeconomics_calendar(from_dt: datetime, to_dt: datetime, currencies: set[str]) -> list[dict]:
    credentials = "guest:guest"
    if TRADING_ECONOMICS_API_KEY and TRADING_ECONOMICS_API_SECRET:
        credentials = f"{TRADING_ECONOMICS_API_KEY}:{TRADING_ECONOMICS_API_SECRET}"

    url = "https://api.tradingeconomics.com/calendar"
    params = {
        "f": "json",
        "c": credentials,
    }

    async with httpx.AsyncClient(timeout=ECONOMIC_CALENDAR_TIMEOUT_SEC) as client_http:
        response = await client_http.get(url, params=params)
        response.raise_for_status()
        payload = response.json()

    if isinstance(payload, dict):
        raw_items = payload.get("data", [])
    elif isinstance(payload, list):
        raw_items = payload
    else:
        raw_items = []

    items = []
    for item in raw_items:
        event_dt = _parse_event_datetime(item.get("Date") or item.get("date"))
        if not event_dt:
            continue
        if event_dt < from_dt or event_dt > to_dt:
            continue

        currency = str(item.get("Currency") or item.get("currency") or "").upper().strip()
        if not currency or currency not in currencies:
            continue

        event_id = item.get("CalendarId") or item.get("id") or f"te-{currency}-{int(event_dt.timestamp())}"
        title = str(item.get("Event") or item.get("title") or item.get("Category") or "Economic Event")
        description = str(item.get("Category") or item.get("Reference") or item.get("description") or title)
        impact = _normalize_impact(item.get("Importance") or item.get("importance") or item.get("impact"))

        items.append(
            {
                "id": str(event_id),
                "title": title,
                "description": description,
                "impact": impact,
                "date": event_dt,
                "currency": currency,
            }
        )

    return items


def _fallback_calendar_events(now: datetime) -> list[dict]:
    return [
        {
            "id": "fallback-1",
            "title": "US Non-Farm Payrolls",
            "description": "US employment change excluding farm workers.",
            "impact": "high",
            "date": now + timedelta(hours=6),
            "currency": "USD",
        },
        {
            "id": "fallback-2",
            "title": "ECB Interest Rate Decision",
            "description": "European Central Bank benchmark rate decision.",
            "impact": "high",
            "date": now + timedelta(days=1, hours=3),
            "currency": "EUR",
        },
        {
            "id": "fallback-3",
            "title": "UK CPI",
            "description": "United Kingdom consumer inflation data.",
            "impact": "medium",
            "date": now + timedelta(days=2),
            "currency": "GBP",
        },
    ]

# ==================== AUTH ROUTES ====================
@api_router.post("/auth/register")
async def register(user: UserRegister):
    # Check if user exists
    existing = await db.users.find_one({"email": user.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_data = {
        "name": user.name,
        "email": user.email,
        "password": get_password_hash(user.password),
        "role": "user",
        "walletBalance": 0.0,
        "kycStatus": "pending",
        "isBlocked": False,
        "createdAt": utc_now(),
        "updatedAt": utc_now()
    }
    result = await db.users.insert_one(user_data)
    
    # Create token
    token = create_access_token({"sub": str(result.inserted_id), "role": "user"})
    
    return {
        "token": token,
        "user": {
            "id": str(result.inserted_id),
            "name": user.name,
            "email": user.email,
            "role": "user",
            "walletBalance": 0.0,
            "kycStatus": "pending"
        }
    }

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if user.get("isBlocked", False):
        raise HTTPException(status_code=403, detail="Account is blocked")
    
    token = create_access_token({"sub": str(user["_id"]), "role": user["role"]})
    
    return {
        "token": token,
        "user": {
            "id": str(user["_id"]),
            "name": user["name"],
            "email": user["email"],
            "role": user["role"],
            "walletBalance": user["walletBalance"],
            "kycStatus": user["kycStatus"]
        }
    }

@api_router.post("/auth/forgot-password")
async def forgot_password(data: ForgotPassword):
    user = await db.users.find_one({"email": data.email})
    if not user:
        # Don't reveal if email exists
        return {"message": "If email exists, password reset link has been sent"}
    
    # Mock email - just log
    logger.info(f"Password reset requested for: {data.email}")
    logger.info(f"[MOCK EMAIL] Reset link would be sent to {data.email}")
    
    return {"message": "If email exists, password reset link has been sent"}

# ==================== PROFILE ROUTES ====================
@api_router.get("/profile")
async def get_profile(current_user: dict = Depends(get_active_user)):
    user = await db.users.find_one({"_id": ObjectId(current_user["id"])})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "id": str(user["_id"]),
        "name": user["name"],
        "email": user["email"],
        "phone": user.get("phone"),
        "role": user["role"],
        "walletBalance": user["walletBalance"],
        "kycStatus": user["kycStatus"],
        "createdAt": user["createdAt"]
    }

@api_router.put("/profile")
async def update_profile(data: ProfileUpdate, current_user: dict = Depends(get_active_user)):
    update_data = {"updatedAt": utc_now()}
    if data.name:
        update_data["name"] = data.name
    if data.phone:
        update_data["phone"] = data.phone
    
    await db.users.update_one(
        {"_id": ObjectId(current_user["id"])},
        {"$set": update_data}
    )
    
    return {"message": "Profile updated successfully"}

# ==================== KYC ROUTES ====================
@api_router.post("/kyc/upload")
async def upload_kyc_document(doc: DocumentUpload, current_user: dict = Depends(get_active_user)):
    doc_data = {
        "userId": ObjectId(current_user["id"]),
        "type": doc.type,
        "fileData": doc.fileData,
        "status": "pending",
        "uploadedAt": utc_now()
    }
    result = await db.documents.insert_one(doc_data)
    
    # Update user KYC status to pending if both documents uploaded
    doc_count = await db.documents.count_documents({"userId": ObjectId(current_user["id"])})
    if doc_count >= 2:
        await db.users.update_one(
            {"_id": ObjectId(current_user["id"])},
            {"$set": {"kycStatus": "pending"}}
        )
    
    return {"message": "Document uploaded successfully", "id": str(result.inserted_id)}

@api_router.get("/kyc/documents")
async def get_kyc_documents(current_user: dict = Depends(get_active_user)):
    docs = await db.documents.find({"userId": ObjectId(current_user["id"])}).to_list(100)
    return [serialize_doc(doc) for doc in docs]

@api_router.get("/kyc/status")
async def get_kyc_status(current_user: dict = Depends(get_active_user)):
    user = await db.users.find_one({"_id": ObjectId(current_user["id"])})
    return {"kycStatus": user["kycStatus"]}

# ==================== BANK ACCOUNT ROUTES ====================
@api_router.post("/bank-accounts")
async def create_bank_account(account: BankAccountCreate, current_user: dict = Depends(get_active_user)):
    # If this is set as default, unset others
    if account.isDefault:
        await db.bank_accounts.update_many(
            {"userId": ObjectId(current_user["id"])},
            {"$set": {"isDefault": False}}
        )
    
    account_data = {
        "userId": ObjectId(current_user["id"]),
        **account.model_dump(),
        "createdAt": utc_now()
    }
    result = await db.bank_accounts.insert_one(account_data)
    
    return {"message": "Bank account added successfully", "id": str(result.inserted_id)}

@api_router.get("/bank-accounts")
async def get_bank_accounts(current_user: dict = Depends(get_active_user)):
    accounts = await db.bank_accounts.find({"userId": ObjectId(current_user["id"])}).to_list(100)
    return [serialize_doc(acc) for acc in accounts]

@api_router.delete("/bank-accounts/{account_id}")
async def delete_bank_account(account_id: str, current_user: dict = Depends(get_active_user)):
    account_oid = parse_object_id(account_id, "account_id")
    result = await db.bank_accounts.delete_one({
        "_id": account_oid,
        "userId": ObjectId(current_user["id"])
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bank account not found")
    return {"message": "Bank account deleted successfully"}

# ==================== WALLET ROUTES ====================
@api_router.get("/wallet/balance")
async def get_wallet_balance(current_user: dict = Depends(get_active_user)):
    user = await db.users.find_one({"_id": ObjectId(current_user["id"])})
    return {"balance": user["walletBalance"]}

@api_router.get("/wallet/transactions")
async def get_wallet_transactions(current_user: dict = Depends(get_active_user)):
    transactions = await db.wallet_transactions.find(
        {"userId": ObjectId(current_user["id"])}
    ).sort("createdAt", -1).to_list(100)
    return [serialize_doc(tx) for tx in transactions]

# ==================== DEPOSIT ROUTES ====================
@api_router.post("/deposits")
async def create_deposit(deposit: DepositCreate, current_user: dict = Depends(get_active_user)):
    deposit_data = {
        "userId": ObjectId(current_user["id"]),
        "amount": deposit.amount,
        "method": deposit.method,
        "screenshot": deposit.screenshot,
        "status": "pending",
        "createdAt": utc_now()
    }
    result = await db.deposits.insert_one(deposit_data)
    
    # Create transaction record
    tx_data = {
        "userId": ObjectId(current_user["id"]),
        "type": "deposit",
        "amount": deposit.amount,
        "status": "pending",
        "description": f"Deposit via {deposit.method.upper()}",
        "createdAt": utc_now()
    }
    await db.wallet_transactions.insert_one(tx_data)
    
    return {"message": "Deposit request submitted", "id": str(result.inserted_id)}

@api_router.get("/deposits")
async def get_deposits(current_user: dict = Depends(get_active_user)):
    deposits = await db.deposits.find(
        {"userId": ObjectId(current_user["id"])}
    ).sort("createdAt", -1).to_list(100)
    return [serialize_doc(dep) for dep in deposits]

# ==================== WITHDRAWAL ROUTES ====================
@api_router.post("/withdrawals")
async def create_withdrawal(withdrawal: WithdrawalCreate, current_user: dict = Depends(get_active_user)):
    user_oid = ObjectId(current_user["id"])
    bank_oid = parse_object_id(withdrawal.bankAccountId, "bankAccountId")

    bank = await db.bank_accounts.find_one({"_id": bank_oid, "userId": user_oid})
    if not bank:
        raise HTTPException(status_code=404, detail="Bank account not found")

    # Atomic balance deduction prevents race conditions on concurrent withdrawals.
    updated_user = await db.users.find_one_and_update(
        {"_id": user_oid, "walletBalance": {"$gte": withdrawal.amount}},
        {"$inc": {"walletBalance": -withdrawal.amount}},
        return_document=ReturnDocument.AFTER,
    )
    if not updated_user:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    # Create withdrawal record
    withdrawal_data = {
        "userId": user_oid,
        "amount": withdrawal.amount,
        "bankAccountId": bank_oid,
        "status": "pending",
        "createdAt": utc_now()
    }
    try:
        result = await db.withdrawals.insert_one(withdrawal_data)
        tx_data = {
            "userId": user_oid,
            "type": "withdraw",
            "amount": withdrawal.amount,
            "status": "pending",
            "description": "Withdrawal request",
            "createdAt": utc_now()
        }
        await db.wallet_transactions.insert_one(tx_data)
    except Exception:
        # Best-effort compensation if downstream write fails.
        await db.users.update_one({"_id": user_oid}, {"$inc": {"walletBalance": withdrawal.amount}})
        raise
    
    return {"message": "Withdrawal request submitted", "id": str(result.inserted_id)}

@api_router.get("/withdrawals")
async def get_withdrawals(current_user: dict = Depends(get_active_user)):
    withdrawals = await db.withdrawals.find(
        {"userId": ObjectId(current_user["id"])}
    ).sort("createdAt", -1).to_list(100)
    return [serialize_doc(w) for w in withdrawals]

# ==================== MARKET DATA ROUTES ====================
@api_router.get("/market/quotes")
async def get_market_quotes():
    try:
        tickers = await binance_client.get_all_tickers()
        return tickers
    except Exception as e:
        logger.error(f"Error fetching market quotes: {str(e)}")
        raise HTTPException(status_code=500, detail="Error fetching market data")

@api_router.get("/market/symbols")
async def get_market_symbols():
    from binance_client import SYMBOLS
    return {"symbols": SYMBOLS}

@api_router.get("/market/price/{symbol}")
async def get_symbol_price(symbol: str):
    price = await binance_client.get_price(symbol)
    if price is None:
        raise HTTPException(status_code=404, detail="Symbol not found")
    return {"symbol": symbol, "price": price}

@api_router.get("/market/price/{from_currency}/{to_currency}")
async def get_forex_price(from_currency: str, to_currency: str):
    """Special endpoint for forex pairs with slash separator"""
    symbol = f"{from_currency}/{to_currency}"
    price = await binance_client.get_price(symbol)
    if price is None:
        raise HTTPException(status_code=404, detail="Symbol not found")
    return {"symbol": symbol, "price": price}

# ==================== TRADE ROUTES ====================
@api_router.post("/trades/execute")
async def execute_trade(trade: TradeExecute, current_user: dict = Depends(get_active_user)):
    user_oid = ObjectId(current_user["id"])
    
    # Get current price
    current_price = await binance_client.get_price(trade.symbol)
    if not current_price:
        raise HTTPException(status_code=400, detail="Unable to fetch price")
    
    # Calculate margin required
    margin = (current_price * trade.quantity) / trade.leverage
    
    # Check balance
    updated_user = await db.users.find_one_and_update(
        {"_id": user_oid, "walletBalance": {"$gte": margin}},
        {"$inc": {"walletBalance": -margin}},
        return_document=ReturnDocument.AFTER,
    )
    if not updated_user:
        raise HTTPException(status_code=400, detail="Insufficient balance for margin")
    
    # Create trade
    trade_data = {
        "userId": user_oid,
        "symbol": trade.symbol,
        "type": trade.type,
        "entryPrice": current_price,
        "exitPrice": None,
        "quantity": trade.quantity,
        "leverage": trade.leverage,
        "margin": margin,
        "profitLoss": 0.0,
        "status": "open",
        "openTime": utc_now(),
        "closeTime": None
    }
    try:
        result = await db.trades.insert_one(trade_data)
    except Exception:
        await db.users.update_one({"_id": user_oid}, {"$inc": {"walletBalance": margin}})
        raise
    
    return {"message": "Trade executed successfully", "id": str(result.inserted_id), "entryPrice": current_price}

@api_router.get("/trades/open")
async def get_open_trades(current_user: dict = Depends(get_active_user)):
    trades = await db.trades.find({
        "userId": ObjectId(current_user["id"]),
        "status": "open"
    }).to_list(100)

    # Fetch once per symbol to avoid repeated network calls.
    symbols = list({trade["symbol"] for trade in trades})
    prices = await asyncio.gather(*(binance_client.get_price(symbol) for symbol in symbols)) if symbols else []
    symbol_price_map = dict(zip(symbols, prices))

    # Update P&L with current prices
    for trade in trades:
        current_price = symbol_price_map.get(trade["symbol"])
        if current_price:
            if trade["type"] == "buy":
                pnl = (current_price - trade["entryPrice"]) * trade["quantity"] * trade["leverage"]
            else:  # sell
                pnl = (trade["entryPrice"] - current_price) * trade["quantity"] * trade["leverage"]
            trade["profitLoss"] = pnl
            trade["currentPrice"] = current_price
    
    return [serialize_doc(trade) for trade in trades]

@api_router.post("/trades/{trade_id}/close")
async def close_trade(trade_id: str, current_user: dict = Depends(get_active_user)):
    trade_oid = parse_object_id(trade_id, "trade_id")
    trade = await db.trades.find_one({
        "_id": trade_oid,
        "userId": ObjectId(current_user["id"]),
        "status": "open"
    })
    
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    
    # Get current price
    current_price = await binance_client.get_price(trade["symbol"])
    if not current_price:
        raise HTTPException(status_code=400, detail="Unable to fetch price")
    
    # Calculate P&L
    if trade["type"] == "buy":
        pnl = (current_price - trade["entryPrice"]) * trade["quantity"] * trade["leverage"]
    else:
        pnl = (trade["entryPrice"] - current_price) * trade["quantity"] * trade["leverage"]
    
    # Update trade
    await db.trades.update_one(
        {"_id": trade_oid},
        {"$set": {
            "exitPrice": current_price,
            "profitLoss": pnl,
            "status": "closed",
            "closeTime": utc_now()
        }}
    )
    
    # Return margin + P&L to wallet
    await db.users.update_one(
        {"_id": ObjectId(current_user["id"])},
        {"$inc": {"walletBalance": trade["margin"] + pnl}}
    )
    
    # Create transaction record
    tx_data = {
        "userId": ObjectId(current_user["id"]),
        "type": "trade_profit" if pnl > 0 else "trade_loss",
        "amount": abs(pnl),
        "status": "completed",
        "description": f"Trade closed: {trade['symbol']} ({trade['type']})",
        "createdAt": utc_now()
    }
    await db.wallet_transactions.insert_one(tx_data)
    
    return {"message": "Trade closed successfully", "profitLoss": pnl}

@api_router.get("/trades/history")
async def get_trade_history(current_user: dict = Depends(get_active_user)):
    trades = await db.trades.find({
        "userId": ObjectId(current_user["id"]),
        "status": "closed"
    }).sort("closeTime", -1).to_list(100)
    return [serialize_doc(trade) for trade in trades]

# ==================== CALENDAR ROUTES ====================
@api_router.get("/calendar/events")
async def get_calendar_events(
    daysAhead: int = Query(default=7, ge=1, le=31),
    currencies: Optional[str] = Query(default=None, description="Comma-separated list like USD,EUR,GBP"),
    minImpact: str = Query(default="low", pattern="^(low|medium|high)$"),
):
    now = utc_now()
    from_dt = now - timedelta(hours=1)
    to_dt = now + timedelta(days=daysAhead)

    if currencies:
        parsed_currencies = {
            token.strip().upper()
            for token in currencies.split(",")
            if token and token.strip()
        }
        currency_filter = parsed_currencies or set(DEFAULT_FOREX_CALENDAR_CURRENCIES)
    else:
        currency_filter = set(DEFAULT_FOREX_CALENDAR_CURRENCIES)

    events: list[dict] = []
    if ECONOMIC_CALENDAR_PROVIDER == "tradingeconomics":
        try:
            events = await _fetch_tradingeconomics_calendar(from_dt, to_dt, currency_filter)
        except Exception as exc:
            logger.warning("Economic calendar provider failed (%s): %s", ECONOMIC_CALENDAR_PROVIDER, exc)

    if not events:
        events = _fallback_calendar_events(now)

    min_impact_order = IMPACT_ORDER.get(minImpact, 1)
    filtered = [event for event in events if IMPACT_ORDER.get(event.get("impact", "low"), 1) >= min_impact_order]
    filtered.sort(key=lambda event: event.get("date", now))
    return filtered[:200]

# ==================== ADMIN ROUTES ====================
@api_router.get("/admin/dashboard")
async def get_admin_dashboard(current_user: dict = Depends(get_active_admin)):
    total_users = await db.users.count_documents({"role": "user"})
    
    # Calculate total deposits
    deposits_pipeline = [
        {"$match": {"status": "approved"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    deposits_result = await db.deposits.aggregate(deposits_pipeline).to_list(1)
    total_deposits = deposits_result[0]["total"] if deposits_result else 0
    
    # Calculate total withdrawals
    withdrawals_pipeline = [
        {"$match": {"status": "approved"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    withdrawals_result = await db.withdrawals.aggregate(withdrawals_pipeline).to_list(1)
    total_withdrawals = withdrawals_result[0]["total"] if withdrawals_result else 0
    
    total_trades = await db.trades.count_documents({})
    pending_kyc = await db.documents.count_documents({"status": "pending"})
    pending_deposits = await db.deposits.count_documents({"status": "pending"})
    pending_withdrawals = await db.withdrawals.count_documents({"status": "pending"})
    
    return {
        "totalUsers": total_users,
        "totalDeposits": total_deposits,
        "totalWithdrawals": total_withdrawals,
        "totalTrades": total_trades,
        "pendingKYC": pending_kyc,
        "pendingDeposits": pending_deposits,
        "pendingWithdrawals": pending_withdrawals
    }

@api_router.get("/admin/users")
async def get_all_users(current_user: dict = Depends(get_active_admin)):
    users = await db.users.find({"role": "user"}).to_list(1000)
    return [serialize_doc(user) for user in users]

@api_router.post("/admin/users/manage")
async def manage_user(data: UserManage, current_user: dict = Depends(get_active_admin)):
    user_oid = parse_object_id(data.userId, "userId")
    is_blocked = data.action == "block"
    result = await db.users.update_one(
        {"_id": user_oid},
        {"$set": {"isBlocked": is_blocked}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": f"User {data.action}ed successfully"}

# Admin Wallet Control - Add/Deduct balance
@api_router.post("/admin/users/wallet")
async def admin_update_wallet(data: AdminWalletUpdate, current_user: dict = Depends(get_active_admin)):
    """Admin endpoint to manually add or deduct user wallet balance"""
    user_oid = parse_object_id(data.userId, "userId")
    note = data.note or ""

    user = await db.users.find_one({"_id": user_oid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    current_balance = user.get("walletBalance", 0.0)

    if data.action == "add":
        await db.users.update_one(
            {"_id": user_oid},
            {"$inc": {"walletBalance": data.amount}, "$set": {"updatedAt": utc_now()}},
        )
        new_balance = current_balance + data.amount
    elif data.action == "deduct":
        updated = await db.users.find_one_and_update(
            {"_id": user_oid, "walletBalance": {"$gte": data.amount}},
            {"$inc": {"walletBalance": -data.amount}, "$set": {"updatedAt": utc_now()}},
            return_document=ReturnDocument.AFTER,
        )
        if not updated:
            raise HTTPException(status_code=400, detail=f"Insufficient balance. User has ${current_balance:.2f}")
        new_balance = updated.get("walletBalance", current_balance - data.amount)
    else:
        raise HTTPException(status_code=400, detail="Action must be 'add' or 'deduct'")
    
    # Create transaction record
    tx_data = {
        "userId": user_oid,
        "type": f"admin_{data.action}",
        "amount": data.amount,
        "status": "completed",
        "description": f"Admin {data.action}: {note}" if note else f"Admin wallet {data.action}",
        "adminId": current_user["id"],
        "createdAt": utc_now()
    }
    await db.wallet_transactions.insert_one(tx_data)
    
    return {
        "message": f"Successfully {data.action}ed ${data.amount:.2f} {'to' if data.action == 'add' else 'from'} user wallet",
        "previousBalance": current_balance,
        "newBalance": new_balance
    }

@api_router.get("/admin/kyc/pending")
async def get_pending_kyc(current_user: dict = Depends(get_active_admin)):
    docs = await db.documents.find({"status": "pending"}).to_list(1000)
    user_ids = list({doc["userId"] for doc in docs})
    users = await db.users.find({"_id": {"$in": user_ids}}).to_list(len(user_ids)) if user_ids else []
    users_map = {user["_id"]: user for user in users}

    result = []
    for doc in docs:
        user = users_map.get(doc["userId"], {})
        doc_data = serialize_doc(doc)
        doc_data["userName"] = user.get("name", "Unknown")
        doc_data["userEmail"] = user.get("email", "Unknown")
        result.append(doc_data)
    return result

@api_router.post("/admin/kyc/review")
async def review_kyc(data: KYCReview, current_user: dict = Depends(get_active_admin)):
    doc_oid = parse_object_id(data.documentId, "documentId")
    doc = await db.documents.find_one({"_id": doc_oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    new_status = "approved" if data.action == "approve" else "rejected"
    await db.documents.update_one(
        {"_id": doc_oid},
        {"$set": {"status": new_status, "reviewedAt": utc_now()}}
    )
    
    # Update user KYC status if all documents approved
    user_docs = await db.documents.find({"userId": doc["userId"]}).to_list(100)
    all_approved = all(d["status"] == "approved" or d["_id"] == doc_oid for d in user_docs)
    
    if data.action == "approve" and all_approved and len(user_docs) >= 2:
        await db.users.update_one(
            {"_id": doc["userId"]},
            {"$set": {"kycStatus": "approved"}}
        )
    elif data.action == "reject":
        await db.users.update_one(
            {"_id": doc["userId"]},
            {"$set": {"kycStatus": "rejected"}}
        )
    
    return {"message": f"Document {data.action}d successfully"}

@api_router.get("/admin/deposits/pending")
async def get_pending_deposits(current_user: dict = Depends(get_active_admin)):
    deposits = await db.deposits.find({"status": "pending"}).to_list(1000)
    user_ids = list({dep["userId"] for dep in deposits})
    users = await db.users.find({"_id": {"$in": user_ids}}).to_list(len(user_ids)) if user_ids else []
    users_map = {user["_id"]: user for user in users}

    result = []
    for dep in deposits:
        user = users_map.get(dep["userId"], {})
        dep_data = serialize_doc(dep)
        dep_data["userName"] = user.get("name", "Unknown")
        dep_data["userEmail"] = user.get("email", "Unknown")
        result.append(dep_data)
    return result

@api_router.post("/admin/deposits/review")
async def review_deposit(data: DepositReview, current_user: dict = Depends(get_active_admin)):
    deposit_oid = parse_object_id(data.depositId, "depositId")
    deposit = await db.deposits.find_one({"_id": deposit_oid})
    if not deposit:
        raise HTTPException(status_code=404, detail="Deposit not found")
    
    # Prevent duplicate approval - check if already processed
    if deposit["status"] != "pending":
        raise HTTPException(
            status_code=400, 
            detail=f"Deposit already {deposit['status']}. Cannot process again."
        )
    
    new_status = "approved" if data.action == "approve" else "rejected"
    await db.deposits.update_one(
        {"_id": deposit_oid},
        {"$set": {"status": new_status, "adminNote": data.note, "reviewedAt": utc_now(), "reviewedBy": current_user["id"]}}
    )
    
    # Update wallet transaction
    await db.wallet_transactions.update_one(
        {"userId": deposit["userId"], "type": "deposit", "amount": deposit["amount"], "status": "pending"},
        {"$set": {"status": new_status}}
    )
    
    # If approved, add balance
    if data.action == "approve":
        user = await db.users.find_one({"_id": deposit["userId"]})
        new_balance = user["walletBalance"] + deposit["amount"]
        await db.users.update_one(
            {"_id": deposit["userId"]},
            {"$set": {"walletBalance": new_balance}}
        )
    
    return {"message": f"Deposit {data.action}d successfully"}

@api_router.get("/admin/withdrawals/pending")
async def get_pending_withdrawals(current_user: dict = Depends(get_active_admin)):
    withdrawals = await db.withdrawals.find({"status": "pending"}).to_list(1000)
    user_ids = list({w["userId"] for w in withdrawals})
    bank_ids = list({w["bankAccountId"] for w in withdrawals if w.get("bankAccountId")})

    users = await db.users.find({"_id": {"$in": user_ids}}).to_list(len(user_ids)) if user_ids else []
    banks = await db.bank_accounts.find({"_id": {"$in": bank_ids}}).to_list(len(bank_ids)) if bank_ids else []
    users_map = {user["_id"]: user for user in users}
    banks_map = {bank["_id"]: bank for bank in banks}

    result = []
    for w in withdrawals:
        user = users_map.get(w["userId"], {})
        bank = banks_map.get(w.get("bankAccountId"))
        w_data = serialize_doc(w)
        w_data["userName"] = user.get("name", "Unknown")
        w_data["userEmail"] = user.get("email", "Unknown")
        w_data["bankDetails"] = serialize_doc(bank) if bank else None
        result.append(w_data)
    return result

@api_router.post("/admin/withdrawals/review")
async def review_withdrawal(data: WithdrawalReview, current_user: dict = Depends(get_active_admin)):
    withdrawal_oid = parse_object_id(data.withdrawalId, "withdrawalId")
    withdrawal = await db.withdrawals.find_one({"_id": withdrawal_oid})
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    
    new_status = "approved" if data.action == "approve" else "rejected"
    await db.withdrawals.update_one(
        {"_id": withdrawal_oid},
        {"$set": {"status": new_status, "adminNote": data.note, "processedAt": utc_now()}}
    )
    
    # Update wallet transaction
    await db.wallet_transactions.update_one(
        {"userId": withdrawal["userId"], "type": "withdraw", "amount": withdrawal["amount"], "status": "pending"},
        {"$set": {"status": new_status}}
    )
    
    # If rejected, refund balance
    if data.action == "reject":
        await db.users.update_one(
            {"_id": withdrawal["userId"]},
            {"$inc": {"walletBalance": withdrawal["amount"]}}
        )
    
    return {"message": f"Withdrawal {data.action}d successfully"}

@api_router.get("/admin/trades")
async def get_all_trades(current_user: dict = Depends(get_active_admin)):
    trades = await db.trades.find().sort("openTime", -1).limit(500).to_list(500)
    user_ids = list({trade["userId"] for trade in trades})
    users = await db.users.find({"_id": {"$in": user_ids}}).to_list(len(user_ids)) if user_ids else []
    users_map = {user["_id"]: user for user in users}

    result = []
    for trade in trades:
        user = users_map.get(trade["userId"], {})
        trade_data = serialize_doc(trade)
        trade_data["userName"] = user.get("name", "Unknown")
        trade_data["userEmail"] = user.get("email", "Unknown")
        result.append(trade_data)
    return result

# Admin Trade CRUD Operations
@api_router.post("/admin/trades/create")
async def admin_create_trade(data: AdminTradeCreate, current_user: dict = Depends(get_active_admin)):
    """Admin endpoint to create a trade on behalf of a user"""
    user_oid = parse_object_id(data.userId, "userId")
    user = await db.users.find_one({"_id": user_oid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Calculate margin
    margin = (data.entryPrice * data.quantity) / data.leverage
    
    updated_user = await db.users.find_one_and_update(
        {"_id": user_oid, "walletBalance": {"$gte": margin}},
        {"$inc": {"walletBalance": -margin}},
        return_document=ReturnDocument.AFTER,
    )
    if not updated_user:
        raise HTTPException(status_code=400, detail=f"User has insufficient balance. Required: ${margin:.2f}, Available: ${user['walletBalance']:.2f}")
    
    # Create trade
    trade_data = {
        "userId": user_oid,
        "symbol": data.symbol,
        "type": data.type,
        "entryPrice": data.entryPrice,
        "exitPrice": None,
        "quantity": data.quantity,
        "leverage": data.leverage,
        "margin": margin,
        "profitLoss": 0.0,
        "status": "open",
        "openTime": utc_now(),
        "closeTime": None,
        "createdBy": "admin",
        "adminId": current_user["id"]
    }
    try:
        result = await db.trades.insert_one(trade_data)
    except Exception:
        await db.users.update_one({"_id": user_oid}, {"$inc": {"walletBalance": margin}})
        raise
    
    return {
        "message": "Trade created successfully",
        "id": str(result.inserted_id),
        "entryPrice": data.entryPrice,
        "margin": margin
    }

@api_router.put("/admin/trades/{trade_id}")
async def admin_update_trade(trade_id: str, data: AdminTradeUpdate, current_user: dict = Depends(get_active_admin)):
    """Admin endpoint to update an open trade"""
    trade_oid = parse_object_id(trade_id, "trade_id")
    trade = await db.trades.find_one({"_id": trade_oid})
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    
    if trade["status"] != "open":
        raise HTTPException(status_code=400, detail="Can only update open trades")
    
    update_fields = data.model_dump(exclude_none=True)
    
    if not update_fields:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    update_fields["updatedAt"] = utc_now()
    update_fields["updatedBy"] = current_user["id"]
    
    await db.trades.update_one(
        {"_id": trade_oid},
        {"$set": update_fields}
    )
    
    return {"message": "Trade updated successfully"}

@api_router.post("/admin/trades/{trade_id}/close")
async def admin_close_trade(trade_id: str, data: AdminTradeClose, current_user: dict = Depends(get_active_admin)):
    """Admin endpoint to close a trade with specified exit price"""
    trade_oid = parse_object_id(trade_id, "trade_id")
    trade = await db.trades.find_one({"_id": trade_oid})
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    
    if trade["status"] != "open":
        raise HTTPException(status_code=400, detail="Trade is already closed")
    
    exit_price = data.exitPrice
    if not exit_price:
        # Try to get current market price
        current_price = await binance_client.get_price(trade["symbol"])
        if current_price:
            exit_price = current_price
        else:
            raise HTTPException(status_code=400, detail="exitPrice required (could not fetch market price)")
    
    # Calculate P&L
    if trade["type"] == "buy":
        pnl = (exit_price - trade["entryPrice"]) * trade["quantity"] * trade["leverage"]
    else:
        pnl = (trade["entryPrice"] - exit_price) * trade["quantity"] * trade["leverage"]
    
    # Update trade
    await db.trades.update_one(
        {"_id": trade_oid},
        {"$set": {
            "exitPrice": exit_price,
            "profitLoss": pnl,
            "status": "closed",
            "closeTime": utc_now(),
            "closedBy": "admin",
            "adminId": current_user["id"]
        }}
    )
    
    # Return margin + P&L to user wallet
    await db.users.update_one(
        {"_id": trade["userId"]},
        {"$inc": {"walletBalance": trade["margin"] + pnl}}
    )
    
    # Create transaction record
    tx_data = {
        "userId": trade["userId"],
        "type": "trade_profit" if pnl > 0 else "trade_loss",
        "amount": abs(pnl),
        "status": "completed",
        "description": f"Trade closed by admin: {trade['symbol']} ({trade['type']})",
        "createdAt": utc_now()
    }
    await db.wallet_transactions.insert_one(tx_data)
    
    return {
        "message": "Trade closed successfully",
        "profitLoss": pnl,
        "exitPrice": exit_price
    }

# PUBLIC endpoint for users to fetch payment settings
@api_router.get("/payment-settings")
async def get_public_payment_settings():
    """Public endpoint for users to view payment settings"""
    settings = await db.payment_settings.find_one()
    if not settings:
        return {"upiId": None, "qrCodeBase64": None, "isActive": False}
    return serialize_doc(settings)

@api_router.get("/admin/payment-settings")
async def get_payment_settings(current_user: dict = Depends(get_active_admin)):
    settings = await db.payment_settings.find_one()
    if not settings:
        return {"upiId": None, "qrCodeBase64": None, "isActive": False}
    return serialize_doc(settings)

@api_router.put("/admin/payment-settings")
async def update_payment_settings(data: PaymentSettings, current_user: dict = Depends(get_active_admin)):
    settings = await db.payment_settings.find_one()
    
    update_data = {"updatedAt": utc_now()}
    if data.upiId is not None:
        update_data["upiId"] = data.upiId
        update_data["isActive"] = True
    if data.qrCodeBase64 is not None:
        update_data["qrCodeBase64"] = data.qrCodeBase64
        update_data["isActive"] = True
    
    if settings:
        await db.payment_settings.update_one(
            {"_id": settings["_id"]},
            {"$set": update_data}
        )
    else:
        update_data["isActive"] = True
        await db.payment_settings.insert_one(update_data)
    
    return {"message": "Payment settings updated successfully"}

# Health check
@api_router.get("/health")
async def health_check():
    return {"status": "ok"}


@api_router.get("/ready")
async def readiness_check():
    try:
        await db.command("ping")
        return {"status": "ok", "db": "up"}
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")

# Include router
app.include_router(api_router)

# CORS
cors_origins_env = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173")
cors_origins = [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=cors_origins,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin"],
)

