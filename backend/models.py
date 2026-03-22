from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Literal
from datetime import datetime
from bson import ObjectId

class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid objectid")
        return ObjectId(v)

    @classmethod
    def __get_pydantic_json_schema__(cls, field_schema):
        field_schema.update(type="string")

# User Models
class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

class ForgotPassword(BaseModel):
    email: EmailStr

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    walletBalance: float
    kycStatus: str
    createdAt: datetime

# Profile Models
class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None

# KYC Models
class DocumentUpload(BaseModel):
    type: Literal["pan", "idproof"]
    fileData: str = Field(min_length=32, max_length=3000000)  # base64

class DocumentResponse(BaseModel):
    id: str
    type: str
    status: str
    uploadedAt: datetime

# Bank Account Models
class BankAccountCreate(BaseModel):
    accountName: str
    accountNumber: str
    iban: Optional[str] = None
    swiftCode: Optional[str] = None
    bankName: str
    bankAddress: str
    isDefault: bool = False

class BankAccountResponse(BaseModel):
    id: str
    accountName: str
    accountNumber: str
    iban: Optional[str]
    swiftCode: Optional[str]
    bankName: str
    bankAddress: str
    isDefault: bool

# Wallet Models
class WalletResponse(BaseModel):
    balance: float

class TransactionResponse(BaseModel):
    id: str
    type: str
    amount: float
    status: str
    description: str
    createdAt: datetime

# Deposit Models
class DepositCreate(BaseModel):
    amount: float = Field(gt=0)
    method: Literal["upi", "qr"]
    screenshot: str = Field(min_length=32, max_length=3000000)  # base64

class DepositResponse(BaseModel):
    id: str
    amount: float
    method: str
    status: str
    createdAt: datetime

# Withdrawal Models
class WithdrawalCreate(BaseModel):
    amount: float = Field(gt=0)
    bankAccountId: str

class WithdrawalResponse(BaseModel):
    id: str
    amount: float
    bankAccountId: str
    status: str
    createdAt: datetime

# Trade Models
class TradeExecute(BaseModel):
    symbol: str
    type: Literal["buy", "sell"]
    quantity: float = Field(gt=0)
    leverage: float = Field(ge=1.0, le=200.0, default=1.0)

class TradeResponse(BaseModel):
    id: str
    symbol: str
    type: str
    entryPrice: float
    currentPrice: Optional[float]
    quantity: float
    leverage: float
    margin: float
    profitLoss: float
    status: str
    openTime: datetime
    closeTime: Optional[datetime]

# Market Data Models
class MarketQuote(BaseModel):
    symbol: str
    price: float
    change24h: float
    changePercent24h: float
    high24h: float
    low24h: float
    volume24h: float

# Calendar Models
class CalendarEvent(BaseModel):
    id: str
    title: str
    description: str
    impact: Literal["low", "medium", "high"]
    date: datetime
    currency: str

# Admin Models
class AdminDashboard(BaseModel):
    totalUsers: int
    totalDeposits: float
    totalWithdrawals: float
    totalTrades: int
    pendingKYC: int
    pendingDeposits: int
    pendingWithdrawals: int

class UserManage(BaseModel):
    userId: str
    action: Literal["block", "unblock"]

class KYCReview(BaseModel):
    documentId: str
    action: Literal["approve", "reject"]
    note: Optional[str] = None

class DepositReview(BaseModel):
    depositId: str
    action: Literal["approve", "reject"]
    note: Optional[str] = None

class WithdrawalReview(BaseModel):
    withdrawalId: str
    action: Literal["approve", "reject"]
    note: Optional[str] = None

class PaymentSettings(BaseModel):
    upiId: Optional[str] = None
    qrCodeBase64: Optional[str] = None

class PaymentSettingsResponse(BaseModel):
    id: str
    upiId: Optional[str]
    qrCodeBase64: Optional[str]
    isActive: bool
    updatedAt: datetime


class AdminWalletUpdate(BaseModel):
    userId: str
    action: Literal["add", "deduct"]
    amount: float = Field(gt=0)
    note: Optional[str] = None


class AdminTradeCreate(BaseModel):
    userId: str
    symbol: str
    type: Literal["buy", "sell"]
    entryPrice: float = Field(gt=0)
    quantity: float = Field(gt=0, default=1)
    leverage: float = Field(ge=1.0, le=200.0, default=1.0)


class AdminTradeUpdate(BaseModel):
    entryPrice: Optional[float] = Field(default=None, gt=0)
    quantity: Optional[float] = Field(default=None, gt=0)
    leverage: Optional[float] = Field(default=None, ge=1.0, le=200.0)
    stopLoss: Optional[float] = Field(default=None, gt=0)
    takeProfit: Optional[float] = Field(default=None, gt=0)


class AdminTradeClose(BaseModel):
    exitPrice: Optional[float] = Field(default=None, gt=0)
